import { describe, expect, it } from "vitest";
import { getMockLandingState } from "@/server/game/mock-landing-state";

describe("getMockLandingState", () => {
  it("returns the empty resume state by default", () => {
    expect(getMockLandingState()).toEqual({
      startHref: "/play",
      resume: {
        available: false,
        href: "/play",
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
      startHref: "/play",
      resume: {
        available: true,
        href: "/play",
        currentLevelNumber: 2,
        currentLevelTitle: "Midnight Alley Portrait",
        levelsCleared: 1,
        attemptsRemaining: 2,
        bestScore: 54,
        helperText: "Pick up the same run without replaying the opening level.",
      },
    });
  });
});
