import { describe, expect, it } from "vitest";

import { levels } from "@/content";
import { buildLandingExperience, createGameSession, recordAttempt, replayLevel, restartFailedLevel } from "@/server/game/session-state";

describe("session-state", () => {
  const startedAt = "2026-04-04T00:00:00.000Z";

  it("creates a new run with the first level active and later levels locked", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    expect(session.progress.currentLevelId).toBe("level-1");
    expect(session.progress.highestUnlockedLevelNumber).toBe(1);
    expect(session.progress.totalAttemptsUsed).toBe(0);
    expect(session.progress.canResume).toBe(false);
    expect(session.progress.levels).toEqual([
      expect.objectContaining({
        levelId: "level-1",
        status: "in_progress",
        currentAttemptCycle: 1,
        attemptsUsed: 0,
        attemptsRemaining: 3,
        unlockedAt: startedAt,
      }),
      expect.objectContaining({
        levelId: "level-2",
        status: "locked",
        currentAttemptCycle: 1,
        attemptsUsed: 0,
        attemptsRemaining: 3,
      }),
      expect.objectContaining({
        levelId: "level-3",
        status: "locked",
        currentAttemptCycle: 1,
        attemptsUsed: 0,
        attemptsRemaining: 3,
      }),
    ]);
  });

  it("consumes scored failures, keeps the current level active, and exposes resume state", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    const attempt = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "warm still life on a wooden table",
      createdAt: "2026-04-04T00:05:00.000Z",
      result: {
        status: "scored",
        outcome: "failed",
        tipIds: ["tip-composition"],
        score: {
          raw: 0.41,
          normalized: 41,
          threshold: 50,
          passed: false,
          breakdown: {
            composition: 38,
          },
          scorer: {
            provider: "openai",
            model: "gpt-5.4-mini",
          },
        },
      },
    });

    expect(attempt.transition).toBe("retry");
    expect(attempt.attempt).toMatchObject({
      attemptCycle: 1,
      attemptNumber: 1,
      consumedAttempt: true,
      result: {
        strongestAttemptScore: 41,
      },
    });
    expect(attempt.session.progress.totalAttemptsUsed).toBe(1);
    expect(attempt.session.progress.canResume).toBe(true);
    expect(attempt.session.progress.currentLevelId).toBe("level-1");
    expect(attempt.session.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      status: "in_progress",
      attemptsUsed: 1,
      attemptsRemaining: 2,
      bestScore: 41,
      strongestAttemptId: "attempt-1",
    });

    expect(buildLandingExperience(attempt.session, levels)).toEqual({
      startHref: "/play?level=1",
      resume: {
        available: true,
        href: "/play?level=1&resume=1",
        currentLevelNumber: 1,
        currentLevelTitle: "Sunlit Still Life",
        levelsCleared: 0,
        attemptsRemaining: 2,
        bestScore: 41,
        helperText: "Pick up the same run without replaying cleared progress.",
      },
    });
  });

  it("does not consume attempts for provider-side failures", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    const failedAttempt = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "warm still life on a wooden table",
      createdAt: "2026-04-04T00:05:00.000Z",
      result: {
        status: "technical_failure",
        outcome: "error",
        tipIds: [],
        errorCode: "openai_timeout",
        errorMessage: "The generation request timed out.",
      },
    });

    expect(failedAttempt.transition).toBe("error");
    expect(failedAttempt.attempt).toMatchObject({
      attemptCycle: 1,
      attemptNumber: 1,
      consumedAttempt: false,
    });
    expect(failedAttempt.session.progress.totalAttemptsUsed).toBe(0);
    expect(failedAttempt.session.progress.levels[0]).toMatchObject({
      status: "in_progress",
      attemptsUsed: 0,
      attemptsRemaining: 3,
      bestScore: null,
    });
  });

  it("unlocks the next level on first clear and preserves replay-safe progress after a replay run", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    const passedLevelOne = recordAttempt({
      session,
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-04T00:05:00.000Z",
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
            provider: "openai",
            model: "gpt-5.4-mini",
          },
        },
      },
    });

    expect(passedLevelOne.transition).toBe("passed");
    expect(passedLevelOne.session.progress.currentLevelId).toBe("level-2");
    expect(passedLevelOne.session.progress.highestUnlockedLevelNumber).toBe(2);
    expect(passedLevelOne.session.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      status: "passed",
      attemptsUsed: 1,
      attemptsRemaining: 2,
      completedAt: "2026-04-04T00:05:00.000Z",
      lastCompletedAt: "2026-04-04T00:05:00.000Z",
    });
    expect(passedLevelOne.session.progress.levels[1]).toMatchObject({
      levelId: "level-2",
      status: "in_progress",
      unlockedAt: "2026-04-04T00:05:00.000Z",
    });

    const replay = replayLevel({
      session: passedLevelOne.session,
      levelId: "level-1",
      now: "2026-04-04T00:10:00.000Z",
    });

    expect(replay.progress.currentLevelId).toBe("level-1");
    expect(replay.progress.highestUnlockedLevelNumber).toBe(2);
    expect(replay.progress.totalAttemptsUsed).toBe(1);
    expect(replay.progress.levels[0]).toMatchObject({
      status: "in_progress",
      currentAttemptCycle: 2,
      attemptsUsed: 0,
      attemptsRemaining: 3,
      completedAt: "2026-04-04T00:05:00.000Z",
    });

    const replayPass = recordAttempt({
      session: replay,
      levelId: "level-1",
      attemptId: "attempt-2",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-04T00:12:00.000Z",
      result: {
        status: "scored",
        outcome: "passed",
        tipIds: [],
        score: {
          raw: 0.81,
          normalized: 81,
          threshold: 50,
          passed: true,
          breakdown: {
            subject: 84,
          },
          scorer: {
            provider: "openai",
            model: "gpt-5.4-mini",
          },
        },
      },
    });

    expect(replayPass.transition).toBe("passed");
    expect(replayPass.session.progress.currentLevelId).toBe("level-2");
    expect(replayPass.session.progress.highestUnlockedLevelNumber).toBe(2);
    expect(replayPass.session.progress.totalAttemptsUsed).toBe(2);
    expect(replayPass.session.progress.levels[0]).toMatchObject({
      status: "passed",
      bestScore: 81,
      strongestAttemptId: "attempt-2",
      currentAttemptCycle: 2,
    });
  });

  it("marks a level as failed on the final scored miss and restarts it with a fresh cycle", () => {
    let session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    for (const attemptId of ["attempt-1", "attempt-2", "attempt-3"]) {
      session = recordAttempt({
        session,
        levelId: "level-1",
        attemptId,
        promptText: "too generic still life prompt",
        createdAt: "2026-04-04T00:05:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: ["tip-materials"],
          score: {
            raw: 0.33,
            normalized: 33,
            threshold: 50,
            passed: false,
            breakdown: {
              materials: 22,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }).session;
    }

    expect(session.progress.levels[0]).toMatchObject({
      status: "failed",
      currentAttemptCycle: 1,
      attemptsUsed: 3,
      attemptsRemaining: 0,
      bestScore: 33,
    });

    const restarted = restartFailedLevel({
      session,
      levelId: "level-1",
      now: "2026-04-04T00:15:00.000Z",
    });

    expect(restarted.progress.currentLevelId).toBe("level-1");
    expect(restarted.progress.totalAttemptsUsed).toBe(3);
    expect(restarted.progress.levels[0]).toMatchObject({
      status: "in_progress",
      currentAttemptCycle: 2,
      attemptsUsed: 0,
      attemptsRemaining: 3,
      bestScore: 33,
    });
    expect(restarted.attempts).toHaveLength(3);
  });

  it("rejects new scored attempts after a level is already failed", () => {
    let session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });

    for (const attemptId of ["attempt-1", "attempt-2", "attempt-3"]) {
      session = recordAttempt({
        session,
        levelId: "level-1",
        attemptId,
        promptText: "too generic still life prompt",
        createdAt: "2026-04-04T00:05:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: ["tip-materials"],
          score: {
            raw: 0.33,
            normalized: 33,
            threshold: 50,
            passed: false,
            breakdown: {
              materials: 22,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }).session;
    }

    expect(() =>
      recordAttempt({
        session,
        levelId: "level-1",
        attemptId: "attempt-4",
        promptText: "still generic",
        createdAt: "2026-04-04T00:10:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: [],
          score: {
            raw: 0.3,
            normalized: 30,
            threshold: 50,
            passed: false,
            breakdown: {
              subject: 30,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }),
    ).toThrow('Cannot record attempts for failed level "level-1" without restarting it first.');
  });

  it("rejects attempts against a non-current level", () => {
    const passedLevelOne = recordAttempt({
      session: createGameSession({
        playerId: "player-1",
        runId: "run-1",
        now: startedAt,
      }),
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-04T00:05:00.000Z",
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
            provider: "openai",
            model: "gpt-5.4-mini",
          },
        },
      },
    }).session;

    expect(() =>
      recordAttempt({
        session: passedLevelOne,
        levelId: "level-1",
        attemptId: "attempt-2",
        promptText: "another still life",
        createdAt: "2026-04-04T00:10:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: [],
          score: {
            raw: 0.33,
            normalized: 33,
            threshold: 50,
            passed: false,
            breakdown: {
              subject: 30,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }),
    ).toThrow('Cannot record attempts for non-current level "level-1".');
  });

  it("rejects attempts for a passed level until it is replayed", () => {
    const session = createGameSession({
      playerId: "player-1",
      runId: "run-1",
      now: startedAt,
    });
    const passedLevel = {
      ...session,
      progress: {
        ...session.progress,
        currentLevelId: "level-1",
        levels: session.progress.levels.map((levelProgress) =>
          levelProgress.levelId === "level-1"
            ? {
                ...levelProgress,
                status: "passed" as const,
                completedAt: "2026-04-04T00:05:00.000Z",
                lastCompletedAt: "2026-04-04T00:05:00.000Z",
              }
            : levelProgress,
        ),
      },
    };

    expect(() =>
      recordAttempt({
        session: passedLevel,
        levelId: "level-1",
        attemptId: "attempt-2",
        promptText: "another still life",
        createdAt: "2026-04-04T00:10:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: [],
          score: {
            raw: 0.33,
            normalized: 33,
            threshold: 50,
            passed: false,
            breakdown: {
              subject: 30,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }),
    ).toThrow('Cannot record attempts for passed level "level-1" without replaying it first.');
  });

  it("does not allow replay when a previously cleared level is currently failed", () => {
    const passedLevel = recordAttempt({
      session: createGameSession({
        playerId: "player-1",
        runId: "run-1",
        now: startedAt,
      }),
      levelId: "level-1",
      attemptId: "attempt-1",
      promptText: "sunlit pears and bottle on a wooden table",
      createdAt: "2026-04-04T00:05:00.000Z",
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
            provider: "openai",
            model: "gpt-5.4-mini",
          },
        },
      },
    }).session;

    let replayed = replayLevel({
      session: passedLevel,
      levelId: "level-1",
      now: "2026-04-04T00:10:00.000Z",
    });

    for (const attemptId of ["attempt-2", "attempt-3", "attempt-4"]) {
      replayed = recordAttempt({
        session: replayed,
        levelId: "level-1",
        attemptId,
        promptText: "too generic still life prompt",
        createdAt: "2026-04-04T00:15:00.000Z",
        result: {
          status: "scored",
          outcome: "failed",
          tipIds: ["tip-materials"],
          score: {
            raw: 0.33,
            normalized: 33,
            threshold: 50,
            passed: false,
            breakdown: {
              materials: 22,
            },
            scorer: {
              provider: "openai",
              model: "gpt-5.4-mini",
            },
          },
        },
      }).session;
    }

    expect(replayed.progress.levels[0].completedAt).toBe("2026-04-04T00:05:00.000Z");
    expect(replayed.progress.levels[0].status).toBe("failed");
    expect(() =>
      replayLevel({
        session: replayed,
        levelId: "level-1",
        now: "2026-04-04T00:20:00.000Z",
      }),
    ).toThrow('Only currently completed levels can be replayed. Received "failed".');
  });
});
