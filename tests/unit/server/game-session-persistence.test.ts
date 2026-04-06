import { describe, expect, it } from "vitest";

import { countPromptCharacters } from "@/server/game/session-persistence";

describe("session-persistence", () => {
  it("counts Unicode code points for prompt persistence", () => {
    expect(countPromptCharacters("abc")).toBe(3);
    expect(countPromptCharacters("🎨")).toBe(1);
    expect(countPromptCharacters("a🎨b")).toBe(3);
  });
});
