import { describe, expect, it } from "vitest";

import { createGameSession, recordAttempt } from "@/server/game/session-state";
import { buildLiveActiveLevelState } from "@/server/game/live-state";

describe("buildLiveActiveLevelState", () => {
  function toAttemptTimestamp(attemptNumber: number) {
    return `2026-04-07T08:${String(attemptNumber).padStart(2, "0")}:00.000Z`;
  }

  it("hydrates the current in-progress level from saved session data", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: "2026-04-07T08:00:00.000Z",
    });
    const progressedSession = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "warm still life on a wooden table",
      createdAt: "2026-04-07T08:05:00.000Z",
      result: {
        status: "scored",
        outcome: "failed",
        tipIds: ["tip-composition-specificity"],
        score: {
          raw: 0.41,
          normalized: 41,
          threshold: 50,
          passed: false,
          breakdown: {
            composition: 38,
          },
          scorer: {
            provider: "mock",
            model: "fixture",
          },
        },
      },
    }).session;

    expect(
      buildLiveActiveLevelState({
        session: progressedSession,
        preferResume: true,
      }),
    ).toMatchObject({
      level: {
        id: "level-1",
      },
      attemptsUsed: 1,
      attemptsRemaining: 2,
      promptDraft: "warm still life on a wooden table",
      initialScreenMode: "active",
      resultPreview: {
        score: {
          normalized: 41,
        },
      },
      failurePreview: {
        strongestAttemptScore: 41,
      },
    });
  });

  it("boots a failed saved level directly into the failure screen", () => {
    let session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: "2026-04-07T08:00:00.000Z",
    });

    for (const [index, normalizedScore] of [31, 44, 46].entries()) {
      session = recordAttempt({
        session,
        levelId: "level-1",
        attemptId: `attempt-${index + 1}`,
        promptText: `still life draft ${index + 1}`,
        createdAt: toAttemptTimestamp(index + 1),
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: ["tip-context-specificity"],
          score: {
            raw: normalizedScore / 100,
            normalized: normalizedScore,
            threshold: 50,
            passed: false,
            breakdown: {
              context: normalizedScore - 5,
            },
            scorer: {
              provider: "mock",
              model: "fixture",
            },
          },
        },
      }).session;
    }

    expect(
      buildLiveActiveLevelState({
        session,
        preferResume: true,
      }),
    ).toMatchObject({
      attemptsUsed: 3,
      attemptsRemaining: 0,
      promptDraft: "still life draft 3",
      initialScreenMode: "failure",
      resultPreview: {
        score: {
          normalized: 46,
        },
      },
      failurePreview: {
        strongestAttemptScore: 46,
      },
    });
  });

  it("falls back to the resumable level when a locked level is requested directly", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: "2026-04-07T08:00:00.000Z",
    });

    expect(
      buildLiveActiveLevelState({
        session,
        requestedLevelNumber: 2,
      }),
    ).toMatchObject({
      level: {
        id: "level-1",
        number: 1,
      },
    });
  });

  it("falls back to the active resumable level when an older level is requested directly", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: "2026-04-07T08:00:00.000Z",
    });
    const passedLevelOneSession = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-07T08:05:00.000Z",
      result: {
        status: "scored",
        outcome: "passed",
        tipIds: [],
        score: {
          raw: 0.74,
          normalized: 74,
          threshold: 50,
          passed: true,
          breakdown: {
            subject: 78,
          },
          scorer: {
            provider: "mock",
            model: "fixture",
          },
        },
      },
    }).session;

    expect(
      buildLiveActiveLevelState({
        session: passedLevelOneSession,
        requestedLevelNumber: 1,
      }),
    ).toMatchObject({
      level: {
        id: "level-2",
        number: 2,
      },
    });
  });

  it("recovers the nearest valid active level when the stored currentLevelId is unavailable", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: "2026-04-07T08:00:00.000Z",
    });
    const passedLevelOneSession = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-07T08:05:00.000Z",
      result: {
        status: "scored",
        outcome: "passed",
        tipIds: [],
        score: {
          raw: 0.74,
          normalized: 74,
          threshold: 50,
          passed: true,
          breakdown: {
            subject: 78,
          },
          scorer: {
            provider: "mock",
            model: "fixture",
          },
        },
      },
    }).session;
    const orphanedSession = {
      ...passedLevelOneSession,
      progress: {
        ...passedLevelOneSession.progress,
        currentLevelId: "removed-level",
      },
    };

    expect(
      buildLiveActiveLevelState({
        session: orphanedSession,
        preferResume: true,
        requestedLevelNumber: 1,
      }),
    ).toMatchObject({
      level: {
        id: "level-2",
        number: 2,
      },
      attemptsUsed: 0,
      attemptsRemaining: 3,
      initialScreenMode: "active",
    });
  });
});
