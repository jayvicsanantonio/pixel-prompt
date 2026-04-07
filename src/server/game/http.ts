import { randomUUID } from "node:crypto";

import { after } from "next/server";
import type { AnalyticsEvent } from "@/lib/analytics";
import { captureServerAnalyticsEvents } from "@/server/analytics";
import { levels } from "@/content";
import type { Level } from "@/lib/game";
import { buildLandingExperience, recordAttempt, resolveResumeLevel, type RecordAttemptResult } from "@/server/game/session-state";
import type { ProviderFailure, ProviderModelRef } from "@/server/providers";
import { getImageGenerationProvider, getImageScoringProvider } from "@/server/providers";

import {
  buildPromptValidationFailedAnalyticsEvent,
  buildResumeProgressAnalyticsEvents,
  buildSubmitAttemptAnalyticsEvents,
} from "./analytics";
import { buildAttemptResultFromScore, mapProviderFailureToAttemptResult } from "./mock-attempt-evaluator";
import { countPromptCharacters } from "./session-persistence";
import { getOrCreateSession, getSessionByToken, getSessionCookieAttributes, mutateSession, SESSION_COOKIE_NAME } from "./session-store";
import { createSubmissionDedupKey, withPendingSubmissionDedup } from "./submission-idempotency";

interface SubmissionPreparation {
  activeLevel: Level;
  attemptCycle: number;
  attemptId: string;
  attemptNumber: number;
  sessionToken: string;
}

interface ScoredSubmissionEvaluation {
  generationDurationMs: number;
  generationModelRef: ProviderModelRef;
  generationResult:
    | {
        ok: true;
        assetKey: string;
        createdAt: string;
        provider: ProviderModelRef;
        seed?: string | null;
        revisedPrompt?: string | null;
      }
    | ProviderFailure;
  scoringDurationMs: number;
  scoringModelRef: ProviderModelRef;
  scoringResult:
    | {
        ok: true;
        createdAt: string;
        provider: ProviderModelRef;
        score: {
          raw: number;
          normalized: number;
          threshold: number;
          passed: boolean;
          breakdown: Record<string, number> | Partial<Record<string, number>>;
          scorer: {
            provider: string;
            model: string;
            version?: string;
          };
        };
        reasoning?: string;
      }
    | ProviderFailure
    | null;
}

function sanitizeAttemptForResponse(attemptResult: RecordAttemptResult["attempt"]) {
  return {
    ...attemptResult,
    result: {
      ...attemptResult.result,
      scoringReasoning: undefined,
    },
  };
}

function resolveSubmissionPreparation(input: {
  attemptId?: string;
  levelId: string;
  session: Awaited<ReturnType<typeof getOrCreateSession>>["session"];
  sessionToken: string;
}) {
  const activeLevel = resolveResumeLevel(input.session.progress, levels);

  if (!activeLevel || input.session.progress.currentLevelId == null) {
    throw new Error("No active level is available for submission.");
  }

  const activeLevelProgress = input.session.progress.levels.find((levelProgress) => levelProgress.levelId === activeLevel.id);

  if (activeLevel.id !== input.levelId) {
    throw new Error("The current level changed while this submission was being processed.");
  }

  if (activeLevelProgress?.status === "failed") {
    throw new Error("This level has no attempts left. Restart it before submitting again.");
  }

  const attemptCycle = activeLevelProgress?.currentAttemptCycle ?? 1;
  const attemptsForCurrentCycle = input.session.attempts.filter(
    (attempt) => attempt.levelId === activeLevel.id && attempt.attemptCycle === attemptCycle,
  );

  return {
    activeLevel,
    attemptCycle,
    attemptId: input.attemptId ?? randomUUID(),
    attemptNumber: attemptsForCurrentCycle.length + 1,
    sessionToken: input.sessionToken,
  } satisfies SubmissionPreparation;
}

async function evaluateSubmissionWithProviders(input: {
  activeLevel: Level;
  attemptId: string;
  attemptNumber: number;
  promptText: string;
  runId: string;
}) {
  const generationProvider = getImageGenerationProvider();
  const scoringProvider = getImageScoringProvider();
  const generationStartedAt = Date.now();
  const generationResult = await generationProvider.generateImage({
    prompt: input.promptText,
    context: {
      runId: input.runId,
      levelId: input.activeLevel.id,
      attemptId: input.attemptId,
      attemptNumber: input.attemptNumber,
    },
  });
  const generationDurationMs = Date.now() - generationStartedAt;
  const scoringStartedAt = Date.now();
  const scoringResult =
    generationResult.ok
      ? await scoringProvider.scoreImageMatch({
          prompt: input.promptText,
          generatedImageAssetKey: generationResult.assetKey,
          targetImage: input.activeLevel.targetImage,
          threshold: input.activeLevel.threshold,
          context: {
            runId: input.runId,
            levelId: input.activeLevel.id,
            attemptId: input.attemptId,
            attemptNumber: input.attemptNumber,
          },
        })
      : null;
  const scoringDurationMs = generationResult.ok ? Date.now() - scoringStartedAt : 0;

  return {
    generationDurationMs,
    generationModelRef: generationProvider.modelRef,
    generationResult,
    scoringDurationMs,
    scoringModelRef: scoringProvider.modelRef,
    scoringResult,
  } satisfies ScoredSubmissionEvaluation;
}

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

function scheduleAnalyticsCapture(events: Array<AnalyticsEvent | null>) {
  const filteredEvents = events.filter((event): event is AnalyticsEvent => event != null);

  if (filteredEvents.length === 0) {
    return;
  }

  const task = () => captureAnalytics(filteredEvents);

  try {
    after(task);
  } catch {
    setTimeout(() => {
      void task();
    }, 0);
  }
}

type SubmitAttemptOutcome =
  | {
      status: 200;
      token: string | undefined;
      attemptResult: RecordAttemptResult;
      analyticsLevel: Level;
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
    attempt: sanitizeAttemptForResponse(attemptResult.attempt),
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
    scheduleAnalyticsCapture(buildResumeProgressAnalyticsEvents({ occurredAt, currentLevel, session: null }));

    return Response.json({
      ok: true,
      landing: buildLandingExperience(null, levels),
      currentLevel: levels[0] ?? null,
      progress: null,
    });
  }

  scheduleAnalyticsCapture(buildResumeProgressAnalyticsEvents({ occurredAt, currentLevel, session }));

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
    scheduleAnalyticsCapture([
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
    scheduleAnalyticsCapture([
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
    createSubmissionDedupKey({
      sessionToken,
      request,
      levelId,
      promptText: trimmedPrompt,
    }),
    async (): Promise<SubmitAttemptOutcome> => {
      const submissionStartedAt = Date.now();
      const preparedSession = await getOrCreateSession(sessionToken);
      let preparation: SubmissionPreparation;

      try {
        preparation = resolveSubmissionPreparation({
          levelId,
          session: preparedSession.session,
          sessionToken: preparedSession.token,
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

      const evaluatedSubmission = await evaluateSubmissionWithProviders({
        activeLevel: preparation.activeLevel,
        attemptId: preparation.attemptId,
        attemptNumber: preparation.attemptNumber,
        promptText: trimmedPrompt,
        runId: preparedSession.session.progress.runId,
      });

      let mutation;

      try {
        mutation = await mutateSession(preparation.sessionToken, async (activeSession) => {
          const refreshedPreparation = resolveSubmissionPreparation({
            attemptId: preparation.attemptId,
            levelId,
            session: activeSession,
            sessionToken: preparation.sessionToken,
          });

          if (
            activeSession.progress.runId !== preparedSession.session.progress.runId ||
            refreshedPreparation.activeLevel.id !== preparation.activeLevel.id ||
            refreshedPreparation.attemptCycle !== preparation.attemptCycle ||
            refreshedPreparation.attemptNumber !== preparation.attemptNumber
          ) {
            throw new Error("The current level changed while this submission was being processed.");
          }

          const attemptResult = recordAttempt({
            session: activeSession,
            levelId: preparation.activeLevel.id,
            attemptId: preparation.attemptId,
            promptText: trimmedPrompt,
            result: !evaluatedSubmission.generationResult.ok
              ? mapProviderFailureToAttemptResult(evaluatedSubmission.generationResult)
              : evaluatedSubmission.scoringResult?.ok
                ? buildAttemptResultFromScore(
                    evaluatedSubmission.scoringResult.score,
                    evaluatedSubmission.scoringResult.reasoning,
                  )
                : mapProviderFailureToAttemptResult(
                    evaluatedSubmission.scoringResult ?? {
                      ok: false,
                      kind: "technical_failure",
                      code: "scoring_result_missing",
                      message: "Scoring did not return a result.",
                      retryable: true,
                      consumeAttempt: false,
                    },
                  ),
            generation: evaluatedSubmission.generationResult.ok
              ? {
                  provider: evaluatedSubmission.generationResult.provider.provider,
                  model: evaluatedSubmission.generationResult.provider.model,
                  assetKey: evaluatedSubmission.generationResult.assetKey,
                  seed: evaluatedSubmission.generationResult.seed ?? undefined,
                  revisedPrompt: evaluatedSubmission.generationResult.revisedPrompt ?? undefined,
                }
              : {
                  provider: evaluatedSubmission.generationModelRef.provider,
                  model: evaluatedSubmission.generationModelRef.model,
                },
          });

          return {
            session: attemptResult.session,
            value: {
              attemptResult,
              analyticsLevel: preparation.activeLevel,
              generationDurationMs: evaluatedSubmission.generationDurationMs,
              scoringDurationMs: evaluatedSubmission.scoringDurationMs,
              scoringModelRef: evaluatedSubmission.scoringModelRef,
            },
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

      const { attemptResult, analyticsLevel, generationDurationMs, scoringDurationMs, scoringModelRef } = mutation.value;
      const occurredAt = new Date().toISOString();
      const totalDurationMs = Date.now() - submissionStartedAt;

      scheduleAnalyticsCapture(
        buildSubmitAttemptAnalyticsEvents({
          attemptResult,
          level: analyticsLevel,
          occurredAt,
          generationDurationMs,
          promptLength: promptCharacterCount,
          scoringModelRef,
          scoringDurationMs,
          totalDurationMs,
        }),
      );

      return {
        status: 200,
        token: mutation.token,
        attemptResult,
        analyticsLevel,
      };
    },
  );

  return buildSubmitAttemptOutcomeResponse(submission);
}
