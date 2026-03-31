import { describe, expect, it } from "vitest";

import { levels } from "@/content";

describe("seeded levels", () => {
  it("ships the first three thresholds as 50, 60, and 70", () => {
    expect(levels.map((level) => level.threshold)).toEqual([50, 60, 70]);
  });

  it("keeps the first three levels ordered sequentially", () => {
    expect(levels.map((level) => level.number)).toEqual([1, 2, 3]);
  });
});
