import { describe, expect, it } from "vitest";

import { levels } from "@/content";

describe("seeded levels", () => {
  it("ships the first three thresholds as 50, 60, and 70", () => {
    expect(levels.map((level) => level.threshold)).toEqual([50, 60, 70]);
  });

  it("keeps the first three levels ordered sequentially", () => {
    expect(levels.map((level) => level.number)).toEqual([1, 2, 3]);
  });

  it("includes category, difficulty, and theme metadata for the seeded pack", () => {
    expect(
      levels.map((level) => ({
        id: level.id,
        category: level.category,
        difficulty: level.difficulty,
        theme: level.theme,
      })),
    ).toEqual([
      {
        id: "level-1",
        category: "still-life",
        difficulty: "easy",
        theme: "studio",
      },
      {
        id: "level-2",
        category: "portrait",
        difficulty: "medium",
        theme: "urban-night",
      },
      {
        id: "level-3",
        category: "environment",
        difficulty: "hard",
        theme: "historical",
      },
    ]);
  });
});
