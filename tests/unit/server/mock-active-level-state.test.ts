import { describe, expect, it } from "vitest";
import { getMockActiveLevelState } from "@/server/game/mock-active-level-state";

describe("getMockActiveLevelState", () => {
  it("returns the first level as the mocked active level", () => {
    expect(getMockActiveLevelState()).toMatchObject({
      level: {
        id: "level-1",
        number: 1,
        title: "Sunlit Still Life",
        threshold: 50,
      },
      attemptsUsed: 0,
      attemptsRemaining: 3,
      promptDraft: "",
      resultPreview: {
        score: {
          normalized: 68.4,
          threshold: 50,
          passed: true,
        },
      },
      continuation: {
        attemptsRemainingAfterResult: 2,
        nextLevelHref: "/play?level=2",
        nextLevelNumber: 2,
        nextLevelTitle: "Midnight Alley Portrait",
      },
      failurePreview: {
        strongestAttemptScore: 68,
      },
    });
  });

  it("returns the resumed level state when resume options are provided", () => {
    expect(getMockActiveLevelState({ levelNumber: 2, resume: true })).toMatchObject({
      level: {
        id: "level-2",
        number: 2,
        title: "Midnight Alley Portrait",
      },
      attemptsUsed: 1,
      attemptsRemaining: 2,
      promptDraft: "cinematic neon portrait in a wet alley at midnight",
      resultPreview: {
        score: {
          normalized: 57.4,
          threshold: 60,
          passed: false,
        },
      },
      continuation: {
        attemptsRemainingAfterResult: 1,
        nextLevelHref: "/play?level=3",
        nextLevelNumber: 3,
        nextLevelTitle: "Ornate Courtyard",
      },
      failurePreview: {
        strongestAttemptScore: 59,
      },
    });
  });

  it("supports a last-attempt mock state for failure-screen previews", () => {
    expect(getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 })).toMatchObject({
      attemptsUsed: 2,
      attemptsRemaining: 1,
      continuation: {
        attemptsRemainingAfterResult: 0,
      },
      failurePreview: {
        strongestAttemptScore: 59,
      },
    });
  });
});
