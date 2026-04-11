import { describe, expect, it } from "vitest";
import { getMockLandingState } from "@/server/game/mock-landing-state";

describe("getMockLandingState", () => {
  it("returns the empty resume state by default", () => {
    expect(getMockLandingState()).toEqual({
      analytics: undefined,
      startHref: "/play?level=1",
      resume: {
        available: false,
        href: "/play?level=1",
        currentLevelNumber: null,
        currentLevelTitle: null,
        levelsCleared: 0,
        attemptsRemaining: 0,
        bestScore: null,
        helperText: "Resume appears here after your first scored attempt.",
      },
    });
  });

  it("returns a mocked saved run when resume is available", () => {
    expect(getMockLandingState({ canResume: true })).toEqual({
      analytics: {
        anonymousPlayerId: "player-mock",
        runId: "run-mock",
      },
      startHref: "/play?level=1",
      resume: {
        available: true,
        href: "/play?level=2&resume=1",
        currentLevelId: "level-2",
        currentLevelNumber: 2,
        currentLevelTitle: "Midnight Alley Portrait",
        levelsCleared: 1,
        attemptsRemaining: 2,
        bestScore: 54,
        highestUnlockedLevelNumber: 2,
        runId: "run-mock",
        helperText: "Pick up the same run without replaying cleared progress.",
      },
    });
  });
});
