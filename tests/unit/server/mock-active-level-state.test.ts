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
    });
  });
});
