import { describe, expect, it } from "vitest";

import { levels } from "@/content";
import type { LevelAttempt } from "@/lib/game";
import { selectRetryTipIds } from "@/server/game/tip-selection";

const levelOne = levels.find((level) => level.id === "level-1");
const levelTwo = levels.find((level) => level.id === "level-2");
const levelThree = levels.find((level) => level.id === "level-3");

function createAttemptWithTips(tipIds: string[]): LevelAttempt {
  return {
    id: "attempt-previous",
    runId: "run-1",
    levelId: "level-1",
    attemptCycle: 1,
    attemptNumber: 1,
    promptText: "test prompt",
    createdAt: "2026-04-05T00:00:00.000Z",
    consumedAttempt: true,
    result: {
      status: "scored",
      outcome: "failed",
      tipIds,
      score: {
        raw: 0.32,
        normalized: 32,
        threshold: 50,
        passed: false,
        breakdown: {
          subject: 32,
          context: 22,
          composition: 18,
        },
        scorer: {
          provider: "mock",
          model: "fixture",
        },
      },
      strongestAttemptScore: 32,
    },
  };
}

describe("selectRetryTipIds", () => {
  it("picks the weakest scored dimensions first", () => {
    expect(levelOne).toBeDefined();

    const tipIds = selectRetryTipIds({
      attemptNumber: 1,
      level: levelOne!,
      score: {
        raw: 0.31,
        normalized: 31,
        threshold: 50,
        passed: false,
        breakdown: {
          subject: 31,
          context: 24,
          composition: 14,
        },
        scorer: {
          provider: "mock",
          model: "fixture",
        },
      },
    });

    expect(tipIds).toEqual(["tip-composition-specificity", "tip-context-specificity"]);
  });

  it("prefers unseen advice before repeating the same tip ids", () => {
    expect(levelOne).toBeDefined();

    const tipIds = selectRetryTipIds({
      attemptNumber: 2,
      level: levelOne!,
      previousAttempts: [createAttemptWithTips(["tip-composition-specificity", "tip-context-specificity"])],
      score: {
        raw: 0.36,
        normalized: 36,
        threshold: 50,
        passed: false,
        breakdown: {
          subject: 28,
          context: 24,
          composition: 18,
        },
        scorer: {
          provider: "mock",
          model: "fixture",
        },
      },
    });

    expect(tipIds[0]).toBe("tip-subject-specificity");
    expect(tipIds).toHaveLength(2);
  });

  it("uses audience-specific rules when the level metadata matches", () => {
    expect(levelTwo).toBeDefined();
    expect(levelThree).toBeDefined();

    const urbanTips = selectRetryTipIds({
      attemptNumber: 1,
      level: levelTwo!,
      score: {
        raw: 0.41,
        normalized: 41,
        threshold: 60,
        passed: false,
        breakdown: {
          context: 34,
          style: 45,
        },
        scorer: {
          provider: "mock",
          model: "fixture",
        },
      },
    });
    const historicalTips = selectRetryTipIds({
      attemptNumber: 1,
      level: levelThree!,
      score: {
        raw: 0.46,
        normalized: 46,
        threshold: 70,
        passed: false,
        breakdown: {
          time_period: 33,
          composition: 42,
        },
        scorer: {
          provider: "mock",
          model: "fixture",
        },
      },
    });

    expect(urbanTips).toContain("tip-context-urban-night");
    expect(historicalTips).toContain("tip-time-period-historical");
  });

  it("returns no tips for passed scores or missing breakdowns", () => {
    expect(levelOne).toBeDefined();

    expect(
      selectRetryTipIds({
        attemptNumber: 1,
        level: levelOne!,
        score: {
          raw: 0.61,
          normalized: 61,
          threshold: 50,
          passed: true,
          breakdown: {
            subject: 61,
          },
          scorer: {
            provider: "mock",
            model: "fixture",
          },
        },
      }),
    ).toEqual([]);

    expect(
      selectRetryTipIds({
        attemptNumber: 1,
        level: levelOne!,
        score: {
          raw: 0.2,
          normalized: 20,
          threshold: 50,
          passed: false,
          breakdown: {},
          scorer: {
            provider: "mock",
            model: "fixture",
          },
        },
      }),
    ).toEqual([]);
  });
});
