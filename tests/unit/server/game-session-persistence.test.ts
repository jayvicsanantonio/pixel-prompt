import { describe, expect, it } from "vitest";

import { buildPersistedAttempts, countPromptCharacters } from "@/server/game/session-persistence";

type PersistedAttemptRow = Parameters<typeof buildPersistedAttempts>[0][number];

function createPersistedAttemptRow(overrides: Partial<PersistedAttemptRow>): PersistedAttemptRow {
  return {
    id: overrides.id ?? "attempt-1",
    runId: overrides.runId ?? "run-1",
    levelId: overrides.levelId ?? "level-1",
    levelNumber: overrides.levelNumber ?? 1,
    attemptCycle: overrides.attemptCycle ?? 1,
    attemptNumber: overrides.attemptNumber ?? 1,
    promptText: overrides.promptText ?? "test prompt",
    promptCharacterCount: overrides.promptCharacterCount ?? 11,
    targetImageAssetKey: overrides.targetImageAssetKey ?? "target-asset",
    lifecycleStatus: overrides.lifecycleStatus ?? "scored",
    outcome: overrides.outcome ?? "failed",
    consumedAttempt: overrides.consumedAttempt ?? true,
    generationProvider: overrides.generationProvider ?? null,
    generationModel: overrides.generationModel ?? null,
    generationModelVersion: overrides.generationModelVersion ?? null,
    generatedImageAssetKey: overrides.generatedImageAssetKey ?? null,
    generationSeed: overrides.generationSeed ?? null,
    revisedPrompt: overrides.revisedPrompt ?? null,
    generationCreatedAt: overrides.generationCreatedAt ?? null,
    scoreRaw: overrides.scoreRaw ?? 0.33,
    scoreNormalized: overrides.scoreNormalized ?? 33,
    scoreThreshold: overrides.scoreThreshold ?? 50,
    scorePassed: overrides.scorePassed ?? false,
    scoreBreakdown: overrides.scoreBreakdown ?? {},
    scoringProvider: overrides.scoringProvider ?? "openai",
    scoringModel: overrides.scoringModel ?? "gpt-5.4-mini",
    scoringModelVersion: overrides.scoringModelVersion ?? null,
    scoringReasoning: overrides.scoringReasoning ?? null,
    scoredAt: overrides.scoredAt ?? new Date("2026-04-04T00:05:00.000Z"),
    tipIds: overrides.tipIds ?? [],
    providerFailureKind: overrides.providerFailureKind ?? null,
    errorCode: overrides.errorCode ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-04-04T00:05:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-04-04T00:05:00.000Z"),
  };
}

describe("session-persistence", () => {
  it("counts Unicode code points for prompt persistence", () => {
    expect(countPromptCharacters("abc")).toBe(3);
    expect(countPromptCharacters("🎨")).toBe(1);
    expect(countPromptCharacters("a🎨b")).toBe(3);
  });

  it("rebuilds attempts with their historical strongest score at that point in time", () => {
    const attempts = buildPersistedAttempts([
      createPersistedAttemptRow({
        id: "attempt-1",
        createdAt: new Date("2026-04-04T00:05:00.000Z"),
        scoreNormalized: 33,
        scoringReasoning: "The first attempt matched the still life subject but missed the composition.",
      }),
      createPersistedAttemptRow({
        id: "attempt-2",
        attemptNumber: 2,
        createdAt: new Date("2026-04-04T00:06:00.000Z"),
        scoreNormalized: 55,
        scoreRaw: 0.55,
        outcome: "passed",
        scorePassed: true,
      }),
      createPersistedAttemptRow({
        id: "attempt-3",
        attemptNumber: 3,
        createdAt: new Date("2026-04-04T00:07:00.000Z"),
        lifecycleStatus: "technical_failure",
        outcome: "error",
        consumedAttempt: false,
        scoreRaw: null,
        scoreNormalized: null,
        scoreThreshold: null,
        scorePassed: null,
        scoreBreakdown: null,
        scoringProvider: null,
        scoringModel: null,
        scoredAt: null,
        errorCode: "openai_timeout",
      }),
    ]);

    expect(attempts.map((attempt) => attempt.result.strongestAttemptScore)).toEqual([33, 55, 55]);
    expect(attempts[0]?.result.scoringReasoning).toBe(
      "The first attempt matched the still life subject but missed the composition.",
    );
  });

  it("restores the persisted provider failure kind into attempt results", () => {
    const attempts = buildPersistedAttempts([
      createPersistedAttemptRow({
        id: "attempt-interrupted",
        lifecycleStatus: "technical_failure",
        outcome: "error",
        consumedAttempt: false,
        scoreRaw: null,
        scoreNormalized: null,
        scoreThreshold: null,
        scorePassed: null,
        scoreBreakdown: null,
        scoringProvider: null,
        scoringModel: null,
        scoredAt: null,
        providerFailureKind: "interrupted",
        errorCode: "openai_generation_interrupted",
      }),
    ]);

    expect(attempts[0]?.result.failureKind).toBe("interrupted");
  });
});
