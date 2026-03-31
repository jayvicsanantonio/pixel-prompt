import { describe, expect, it } from "vitest";

import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, SCORE_BREAKDOWN_DIMENSIONS } from "@/lib/game";

describe("game constants", () => {
  it("keeps the MVP prompt limit at 120 characters", () => {
    expect(PROMPT_CHARACTER_LIMIT).toBe(120);
  });

  it("keeps the MVP max attempts at 3", () => {
    expect(MAX_ATTEMPTS_PER_LEVEL).toBe(3);
  });

  it("covers every PRD scoring dimension for retry coaching", () => {
    expect(SCORE_BREAKDOWN_DIMENSIONS).toEqual([
      "medium",
      "subject",
      "context",
      "style",
      "materials",
      "textures",
      "shapes",
      "composition",
      "time_period",
    ]);
  });
});
