import { randomUUID } from "node:crypto";

import type { AnalyticsEvent } from "@/lib/analytics";
import { captureServerAnalyticsEvents } from "@/server/analytics";
import { levels } from "@/content";
import { buildLandingExperience, recordAttempt, resolveResumeLevel, type RecordAttemptResult } from "@/server/game/session-state";

import {
  buildPromptValidationFailedAnalyticsEvent,
  buildResumeProgressAnalyticsEvents,
  buildSubmitAttemptAnalyticsEvents,
} from "./analytics";
import { evaluateMockAttempt } from "./mock-attempt-evaluator";
import { countPromptCharacters } from "./session-persistence";
import { getSessionByToken, getSessionCookieAttributes, mutateSession, SESSION_COOKIE_NAME } from "./session-store";
import { createSubmissionDedupKey, withPendingSubmissionDedup } from "./submission-idempotency";

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

async function captureAnalytics(events: Array<AnalyticsEvent | null>) {
  const filteredEvents = events.filter((event): event is AnalyticsEvent => event != null);

  if (filteredEvents.length === 0) {
    return;
  }

  try {
    await captureServerAnalyticsEvents(filteredEvents);
  } catch {
    // Analytics failures must never block gameplay responses.
  }
}

type SubmitAttemptOutcome =
  | {
      status: 200;
      token: string | undefined;
      attemptResult: RecordAttemptResult;
    }
  | {
      status: 409;
      body: {
        ok: false;
        code: "run_complete" | "level_changed" | "restart_required";
        message: string;
      };
    };

function buildSubmitAttemptResponse(sessionToken: string | undefined, attemptResult: RecordAttemptResult) {
  const response = Response.json({
    ok: true,
    transition: attemptResult.transition,
    attempt: attemptResult.attempt,
    currentLevel: resolveResumeLevel(attemptResult.session.progress, levels),
    landing: buildLandingExperience(attemptResult.session, levels),
    progress: attemptResult.session.progress,
  });

  if (sessionToken) {
    response.headers.append(
      "set-cookie",
      `${getSessionCookieAttributes().name}=${sessionToken}; Max-Age=${getSessionCookieAttributes().maxAge}; Path=/; HttpOnly; SameSite=Lax${
        getSessionCookieAttributes().secure ? "; Secure" : ""
      }`,
    );
  }

  return response;
}

function buildSubmitAttemptOutcomeResponse(outcome: SubmitAttemptOutcome) {
  if (outcome.status !== 200) {
    return Response.json(outcome.body, {
      status: outcome.status,
    });
  }

  return buildSubmitAttemptResponse(outcome.token, outcome.attemptResult);
}

export async function handleResumeProgress(request: Request) {
  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const session = sessionToken ? await getSessionByToken(sessionToken) : null;
  const occurredAt = new Date().toISOString();
  const currentLevel = session ? resolveResumeLevel(session.progress, levels) : (levels[0] ?? null);

  if (!session) {
    await captureAnalytics(buildResumeProgressAnalyticsEvents({ occurredAt, currentLevel, session: null }));

    return Response.json({
      ok: true,
      landing: buildLandingExperience(null, levels),
      currentLevel: levels[0] ?? null,
      progress: null,
    });
  }

  await captureAnalytics(buildResumeProgressAnalyticsEvents({ occurredAt, currentLevel, session }));

  const response = Response.json({
    ok: true,
    landing: buildLandingExperience(session, levels),
    currentLevel,
    progress: session.progress,
  });

  response.headers.append(
    "set-cookie",
    `${getSessionCookieAttributes().name}=${sessionToken}; Max-Age=${getSessionCookieAttributes().maxAge}; Path=/; HttpOnly; SameSite=Lax${
      getSessionCookieAttributes().secure ? "; Secure" : ""
    }`,
  );

  return response;
}

export async function handleSubmitAttempt(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
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

  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return Response.json(
      {
        ok: false,
        code: "invalid_request",
        message: "Request body must be a JSON object.",
      },
      {
        status: 400,
      },
    );
  }

  const { levelId, promptText } = rawBody as Record<string, unknown>;

  if (typeof levelId !== "string" || typeof promptText !== "string") {
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

  const requestedLevel = levels.find((level) => level.id === levelId);

  if (!requestedLevel) {
    return Response.json(
      {
        ok: false,
        code: "invalid_request",
        message: "The request references an unknown level.",
      },
      {
        status: 400,
      },
    );
  }

  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME) ?? undefined;
  const existingSession = sessionToken ? await getSessionByToken(sessionToken) : null;
  const trimmedPrompt = promptText.trim();
  const promptCharacterCount = countPromptCharacters(trimmedPrompt);

  if (promptCharacterCount === 0) {
    await captureAnalytics([
      buildPromptValidationFailedAnalyticsEvent({
        occurredAt: new Date().toISOString(),
        level: requestedLevel,
        promptLength: promptCharacterCount,
        reason: "empty",
        session: existingSession,
      }),
    ]);

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

  if (promptCharacterCount > requestedLevel.promptCharacterLimit) {
    await captureAnalytics([
      buildPromptValidationFailedAnalyticsEvent({
        occurredAt: new Date().toISOString(),
        level: requestedLevel,
        promptLength: promptCharacterCount,
        reason: "over_limit",
        session: existingSession,
      }),
    ]);

    return Response.json(
      {
        ok: false,
        code: "prompt_too_long",
        message: `Keep the prompt at ${requestedLevel.promptCharacterLimit} characters or fewer.`,
      },
      {
        status: 400,
      },
    );
  }

  const currentLevel = existingSession ? resolveResumeLevel(existingSession.progress, levels) : (levels[0] ?? null);

  if (!currentLevel || (existingSession && existingSession.progress.currentLevelId == null)) {
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

  if (levelId !== currentLevel.id) {
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

  const currentLevelProgress = existingSession?.progress.levels.find(
    (levelProgress) => levelProgress.levelId === currentLevel.id,
  );

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

  const submission = await withPendingSubmissionDedup(
    createSubmissionDedupKey(sessionToken, levelId, trimmedPrompt),
    async (): Promise<SubmitAttemptOutcome> => {
      let mutation;
      const submissionStartedAt = Date.now();

      try {
        mutation = await mutateSession(sessionToken, async (activeSession) => {
          const activeLevel = resolveResumeLevel(activeSession.progress, levels);

          if (!activeLevel || activeSession.progress.currentLevelId == null) {
            throw new Error("No active level is available for submission.");
          }

          const activeLevelProgress = activeSession.progress.levels.find(
            (levelProgress) => levelProgress.levelId === activeLevel.id,
          );

          if (activeLevel.id !== levelId) {
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
            return {
              status: 409,
              body: {
                ok: false,
                code: "run_complete",
                message: error.message,
              },
            };
          }

          if (error.message === "The current level changed while this submission was being processed.") {
            return {
              status: 409,
              body: {
                ok: false,
                code: "level_changed",
                message: error.message,
              },
            };
          }

          if (error.message === "This level has no attempts left. Restart it before submitting again.") {
            return {
              status: 409,
              body: {
                ok: false,
                code: "restart_required",
                message: error.message,
              },
            };
          }
        }

        throw error;
      }

      const attemptResult = mutation.value;
      const occurredAt = new Date().toISOString();
      const totalDurationMs = Date.now() - submissionStartedAt;

      await captureAnalytics(
        buildSubmitAttemptAnalyticsEvents({
          attemptResult,
          level: requestedLevel,
          occurredAt,
          promptLength: promptCharacterCount,
          totalDurationMs,
        }),
      );

      return {
        status: 200,
        token: mutation.token,
        attemptResult,
      };
    },
  );

  return buildSubmitAttemptOutcomeResponse(submission);
}
