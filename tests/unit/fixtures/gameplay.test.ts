import { describe, expect, it } from "vitest";
import { levels } from "@/content";
import {
  createLevelAttemptFixture,
  createProgressMutationResponseFixture,
  createSubmitAttemptResponseFixture,
} from "../../fixtures/gameplay";

describe("gameplay fixtures", () => {
  it("preserves explicit null current levels in response fixtures", () => {
    const submitResponse = createSubmitAttemptResponseFixture({
      currentLevel: null,
    });
    const progressResponse = createProgressMutationResponseFixture({
      currentLevel: null,
    });

    expect(submitResponse.currentLevel).toBeNull();
    expect(submitResponse.progress.currentLevelId).toBeNull();
    expect(progressResponse.currentLevel).toBeNull();
    expect(progressResponse.progress.currentLevelId).toBeNull();
  });

  it("marks failed submit transitions as failed in default progress fixtures", () => {
    const response = createSubmitAttemptResponseFixture({
      transition: "failed",
      attempt: createLevelAttemptFixture({
        id: "attempt-level-2-failed",
        levelId: "level-2",
        attemptNumber: 3,
        promptText: "cinematic neon portrait in a wet alley at midnight",
        score: {
          raw: 0.59,
          normalized: 59,
          threshold: 60,
          passed: false,
        },
        result: {
          strongestAttemptScore: 59,
        },
      }),
      currentLevel: levels[1],
    });

    expect(response.progress.levels.find((levelProgress) => levelProgress.levelId === "level-2")?.status).toBe("failed");
  });
});
