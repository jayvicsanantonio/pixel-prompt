import { describe, expect, it } from "vitest";

import { toPlayerFacingScore } from "@/lib/game";

describe("score presentation", () => {
  it("projects internal score data to the player-facing percentage only", () => {
    const playerFacing = toPlayerFacingScore({
      raw: 0.6841,
      normalized: 68.41,
      threshold: 60,
      passed: true,
      breakdown: {
        subject: 72,
        composition: 58,
      },
      scorer: {
        provider: "openai",
        model: "gpt-5.4-mini",
      },
    });

    expect(playerFacing).toEqual({
      percentage: 68,
      passed: true,
      threshold: 60,
    });
    expect("breakdown" in playerFacing).toBe(false);
    expect("raw" in playerFacing).toBe(false);
  });
});
