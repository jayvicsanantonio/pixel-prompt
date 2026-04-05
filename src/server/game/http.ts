import { levels } from "@/content";
import { buildLandingExperience, recordAttempt, resolveResumeLevel } from "@/server/game/session-state";

import { evaluateMockAttempt } from "./mock-attempt-evaluator";
import { getOrCreateSession, getSessionCookieAttributes, saveSession, SESSION_COOKIE_NAME } from "./session-store";

function getCookieValue(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  const matchingCookie = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));

  if (!matchingCookie) {
    return null;
  }

  return matchingCookie.slice(cookieName.length + 1);
}

export async function handleResumeProgress(request: Request) {
  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const { token, session } = getOrCreateSession(sessionToken);
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
  const body = (await request.json()) as {
    levelId?: string;
    promptText?: string;
  };
  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const { token, session } = getOrCreateSession(sessionToken);
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

  const trimmedPrompt = body.promptText.trim();

  if (trimmedPrompt.length === 0) {
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

  if (trimmedPrompt.length > currentLevel.promptCharacterLimit) {
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

  const attemptId = crypto.randomUUID();
  const evaluatedAttempt = evaluateMockAttempt(currentLevel, trimmedPrompt, attemptId);
  const attemptResult = recordAttempt({
    session,
    levelId: currentLevel.id,
    attemptId,
    promptText: trimmedPrompt,
    result: evaluatedAttempt.result,
    generation: evaluatedAttempt.generation,
  });

  saveSession(token, attemptResult.session);

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
