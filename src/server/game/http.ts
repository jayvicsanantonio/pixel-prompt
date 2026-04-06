import { randomUUID } from "node:crypto";

import { levels } from "@/content";
import { buildLandingExperience, recordAttempt, resolveResumeLevel } from "@/server/game/session-state";

import { evaluateMockAttempt } from "./mock-attempt-evaluator";
import { countPromptCharacters } from "./session-persistence";
import { getOrCreateSession, getSessionCookieAttributes, mutateSession, SESSION_COOKIE_NAME } from "./session-store";

function getCookieValue(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const cookie = entry.trim();

    if (!cookie) {
      continue;
    }

    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    if (cookie.slice(0, separatorIndex) !== cookieName) {
      continue;
    }

    return cookie.slice(separatorIndex + 1);
  }

  return null;
}

export async function handleResumeProgress(request: Request) {
  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const { token, session } = await getOrCreateSession(sessionToken);
  const response = Response.json({
    ok: true,
    landing: buildLandingExperience(session, levels),
    currentLevel: resolveResumeLevel(session.progress, levels),
    progress: session.progress,
  });

  response.headers.append(
    "set-cookie",
    `${getSessionCookieAttributes().name}=${token}; Max-Age=${getSessionCookieAttributes().maxAge}; Path=/; HttpOnly; SameSite=Lax${
      getSessionCookieAttributes().secure ? "; Secure" : ""
    }`,
  );

  return response;
}

export async function handleSubmitAttempt(request: Request) {
  let body: {
    levelId?: string;
    promptText?: string;
  };
  try {
    body = (await request.json()) as {
      levelId?: string;
      promptText?: string;
    };
  } catch {
    return Response.json(
      {
        ok: false,
        code: "invalid_json",
        message: "The request body must be valid JSON.",
      },
      {
        status: 400,
      },
    );
  }
  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const { token, session } = await getOrCreateSession(sessionToken);
  const currentLevel = resolveResumeLevel(session.progress, levels);

  if (!body.levelId || !body.promptText) {
    return Response.json(
      {
        ok: false,
        code: "invalid_request",
        message: "Both levelId and promptText are required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!currentLevel || session.progress.currentLevelId == null) {
    return Response.json(
      {
        ok: false,
        code: "run_complete",
        message: "No active level is available for submission.",
      },
      {
        status: 409,
      },
    );
  }

  if (body.levelId !== currentLevel.id) {
    return Response.json(
      {
        ok: false,
        code: "level_mismatch",
        message: "Submissions are only accepted for the current active level.",
      },
      {
        status: 409,
      },
    );
  }

  const currentLevelProgress = session.progress.levels.find((levelProgress) => levelProgress.levelId === currentLevel.id);

  if (currentLevelProgress?.status === "failed") {
    return Response.json(
      {
        ok: false,
        code: "restart_required",
        message: "This level has no attempts left. Restart the level before submitting again.",
      },
      {
        status: 409,
      },
    );
  }

  const trimmedPrompt = body.promptText.trim();

  const promptCharacterCount = countPromptCharacters(trimmedPrompt);

  if (promptCharacterCount === 0) {
    return Response.json(
      {
        ok: false,
        code: "empty_prompt",
        message: "Write a prompt before submitting.",
      },
      {
        status: 400,
      },
    );
  }

  if (promptCharacterCount > currentLevel.promptCharacterLimit) {
    return Response.json(
      {
        ok: false,
        code: "prompt_too_long",
        message: `Keep the prompt at ${currentLevel.promptCharacterLimit} characters or fewer.`,
      },
      {
        status: 400,
      },
    );
  }

  let mutation;
  try {
    mutation = await mutateSession(token, async (activeSession) => {
      const activeLevel = resolveResumeLevel(activeSession.progress, levels);

      if (!activeLevel || activeSession.progress.currentLevelId == null) {
        throw new Error("No active level is available for submission.");
      }

      const activeLevelProgress = activeSession.progress.levels.find(
        (levelProgress) => levelProgress.levelId === activeLevel.id,
      );

      if (activeLevel.id !== currentLevel.id) {
        throw new Error("The current level changed while this submission was being processed.");
      }

      if (activeLevelProgress?.status === "failed") {
        throw new Error("This level has no attempts left. Restart it before submitting again.");
      }

      const attemptId = randomUUID();
      const evaluatedAttempt = evaluateMockAttempt(activeLevel, trimmedPrompt, attemptId);
      const attemptResult = recordAttempt({
        session: activeSession,
        levelId: activeLevel.id,
        attemptId,
        promptText: trimmedPrompt,
        result: evaluatedAttempt.result,
        generation: evaluatedAttempt.generation,
      });

      return {
        session: attemptResult.session,
        value: attemptResult,
      };
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "No active level is available for submission.") {
        return Response.json(
          {
            ok: false,
            code: "run_complete",
            message: error.message,
          },
          {
            status: 409,
          },
        );
      }

      if (error.message === "The current level changed while this submission was being processed.") {
        return Response.json(
          {
            ok: false,
            code: "level_changed",
            message: error.message,
          },
          {
            status: 409,
          },
        );
      }

      if (error.message === "This level has no attempts left. Restart it before submitting again.") {
        return Response.json(
          {
            ok: false,
            code: "restart_required",
            message: error.message,
          },
          {
            status: 409,
          },
        );
      }
    }

    throw error;
  }
  const attemptResult = mutation.value;

  const response = Response.json({
    ok: true,
    transition: attemptResult.transition,
    attempt: attemptResult.attempt,
    currentLevel: resolveResumeLevel(attemptResult.session.progress, levels),
    landing: buildLandingExperience(attemptResult.session, levels),
    progress: attemptResult.session.progress,
  });

  response.headers.append(
    "set-cookie",
    `${getSessionCookieAttributes().name}=${token}; Max-Age=${getSessionCookieAttributes().maxAge}; Path=/; HttpOnly; SameSite=Lax${
      getSessionCookieAttributes().secure ? "; Secure" : ""
    }`,
  );

  return response;
}
