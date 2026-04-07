import { describe, expect, it } from "vitest";

import { levels } from "@/content";
import type { RecordAttemptResult } from "@/server/game/session-state";
import { buildSubmitAttemptAnalyticsEvents } from "@/server/game/analytics";

function createScoringFailureAttemptResult(): RecordAttemptResult {
  return {
    transition: "error",
    attempt: {
      id: "attempt-1",
      runId: "run-1",
      levelId: "level-1",
      attemptCycle: 1,
      attemptNumber: 1,
      promptText: "sunlit still life",
      createdAt: "2026-04-06T10:00:00.000Z",
      consumedAttempt: false,
      generation: {
        provider: "openai",
        model: "gpt-image-1.5",
        assetKey: "generated/openai/level-1/attempt-1.png",
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        tipIds: [],
        errorCode: "scoring_asset_unavailable",
        errorMessage: "A scoring asset could not be loaded.",
      },
    },
    session: {
      progress: {
        playerId: "player-1",
        runId: "run-1",
        currentLevelId: "level-1",
        highestUnlockedLevelNumber: 1,
        totalAttemptsUsed: 0,
        canResume: false,
        lastActiveAt: "2026-04-06T10:00:00.000Z",
        levels: [
          {
            levelId: "level-1",
            status: "in_progress",
            currentAttemptCycle: 1,
            attemptsUsed: 0,
            attemptsRemaining: 3,
            bestScore: null,
            strongestAttemptId: null,
            unlockedAt: "2026-04-06T09:55:00.000Z",
            completedAt: null,
            lastCompletedAt: null,
            lastAttemptedAt: "2026-04-06T10:00:00.000Z",
          },
        ],
      },
      attempts: [],
    },
  };
}

describe("game analytics", () => {
  it("distinguishes generation success from later scoring failure", () => {
    const events = buildSubmitAttemptAnalyticsEvents({
      attemptResult: createScoringFailureAttemptResult(),
      level: levels[0]!,
      occurredAt: "2026-04-06T10:00:01.000Z",
      generationDurationMs: 1400,
      promptLength: 18,
      scoringModelRef: {
        provider: "openai",
        model: "gpt-5.4-mini",
      },
      scoringDurationMs: 220,
      totalDurationMs: 1620,
    });

    expect(events).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: true,
        failureKind: undefined,
      }),
      expect.objectContaining({
        name: "scoring_completed",
        provider: "openai",
        model: "gpt-5.4-mini",
        success: false,
        failureKind: "asset_unavailable",
      }),
    ]);
  });
});
