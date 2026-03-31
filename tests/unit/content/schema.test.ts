import { describe, expect, it } from "vitest";

import { defineLevels, defineTipRules } from "@/content";

describe("content schemas", () => {
  it("applies the MVP defaults to authored level entries", () => {
    const [level] = defineLevels([
      {
        id: "level-1",
        number: 1,
        slug: "sunlit-still-life",
        title: "Sunlit Still Life",
        description: "A warm-up level for testing the authored content format.",
        category: "still-life",
        difficulty: "easy",
        theme: "studio",
        threshold: 50,
        targetImage: {
          assetKey: "targets/level-1.png",
          alt: "A sunlit still life on a wooden table.",
        },
      },
    ]);

    expect(level.promptCharacterLimit).toBe(120);
    expect(level.maxAttempts).toBe(3);
  });

  it("validates tip rules with dimension and audience filters", () => {
    const [rule] = defineTipRules([
      {
        id: "tip-style-specificity",
        dimension: "style",
        title: "Name the visual style",
        body: "If the image feels painterly, cinematic, or poster-like, say that directly.",
        when: {
          maxDimensionScore: 55,
          minAttemptNumber: 1,
          levelDifficulties: ["easy"],
        },
      },
    ]);

    expect(rule.priority).toBe(50);
    expect(rule.when.levelDifficulties).toEqual(["easy"]);
  });
});
