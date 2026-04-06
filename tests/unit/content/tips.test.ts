import { describe, expect, it } from "vitest";

import { tipRules } from "@/content";
import { SCORE_BREAKDOWN_DIMENSIONS } from "@/lib/game";

describe("seeded tip rules", () => {
  it("covers every PRD retry-tip dimension at least once", () => {
    expect(new Set(tipRules.map((rule) => rule.dimension))).toEqual(new Set(SCORE_BREAKDOWN_DIMENSIONS));
  });

  it("ships audience-specific variants for themed content where needed", () => {
    expect(tipRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tip-context-urban-night",
          dimension: "context",
          when: expect.objectContaining({
            levelThemes: ["urban-night"],
          }),
        }),
        expect.objectContaining({
          id: "tip-time-period-historical",
          dimension: "time_period",
          when: expect.objectContaining({
            levelThemes: ["historical"],
          }),
        }),
      ]),
    );
  });
});
