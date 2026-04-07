import { describe, expect, it } from "vitest";

import { levels } from "@/content";
import { scorePromptAgainstLevel } from "@/server/game/mock-attempt-evaluator";

const acceptablePromptFixtures = [
  {
    levelId: "level-1",
    expectedSpread: 2,
    prompts: [
      {
        prompt: "sunlit pears on wooden table with bottle",
        expectedNormalized: 91,
      },
      {
        prompt: "warm pears and bottle on wooden table",
        expectedNormalized: 90,
      },
      {
        prompt: "still life pears on a sunlit table",
        expectedNormalized: 89,
      },
    ],
  },
  {
    levelId: "level-2",
    expectedSpread: 3,
    prompts: [
      {
        prompt: "neon portrait in wet alley at midnight",
        expectedNormalized: 90,
      },
      {
        prompt: "urban portrait with neon signs at midnight",
        expectedNormalized: 91,
      },
      {
        prompt: "wet alley portrait under neon signs",
        expectedNormalized: 88,
      },
    ],
  },
  {
    levelId: "level-3",
    expectedSpread: 2,
    prompts: [
      {
        prompt: "ornate stone courtyard with layered arches",
        expectedNormalized: 90,
      },
      {
        prompt: "historical courtyard of warm stone arches",
        expectedNormalized: 89,
      },
      {
        prompt: "layered stone architecture in ornate courtyard",
        expectedNormalized: 91,
      },
    ],
  },
] as const;

const offTopicPromptFixtures = [
  {
    levelId: "level-1",
    prompt: "spaceship battle in deep space",
    expectedNormalized: 35,
  },
  {
    levelId: "level-2",
    prompt: "quiet beach at sunrise",
    expectedNormalized: 32,
  },
  {
    levelId: "level-3",
    prompt: "flat vector logo of a cat",
    expectedNormalized: 35,
  },
] as const;

describe("mock attempt evaluator", () => {
  it("keeps seeded visually acceptable prompts above each level threshold with stable scores", () => {
    for (const fixture of acceptablePromptFixtures) {
      const level = levels.find((candidate) => candidate.id === fixture.levelId);

      expect(level).toBeDefined();

      if (!level) {
        throw new Error(`Missing level "${fixture.levelId}".`);
      }

      const normalizedScores = fixture.prompts.map(({ prompt, expectedNormalized }) => {
        const score = scorePromptAgainstLevel(level, prompt);

        expect(score.normalized).toBe(expectedNormalized);
        expect(score.passed).toBe(true);
        expect(score.threshold).toBe(level.threshold);

        return score.normalized;
      });

      const spread = Math.max(...normalizedScores) - Math.min(...normalizedScores);

      expect(spread).toBeLessThanOrEqual(fixture.expectedSpread);
    }
  });

  it("still scores technically successful off-topic prompts instead of treating them as provider failures", () => {
    for (const fixture of offTopicPromptFixtures) {
      const level = levels.find((candidate) => candidate.id === fixture.levelId);

      expect(level).toBeDefined();

      if (!level) {
        throw new Error(`Missing level "${fixture.levelId}".`);
      }

      const score = scorePromptAgainstLevel(level, fixture.prompt);

      expect(score.normalized).toBe(fixture.expectedNormalized);
      expect(score.passed).toBe(false);
      expect(score.normalized).toBeLessThan(level.threshold);
    }
  });
});
