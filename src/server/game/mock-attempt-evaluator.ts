import type { AttemptGenerationDetails, AttemptResult, AttemptScore, Level } from "@/lib/game";
import type { ProviderFailure } from "@/server/providers";
import { MOCK_PROVIDER_PROMPT_MARKERS } from "@/server/providers/mock-fixtures";

interface PromptSignal {
  canonical: string;
  variants: string[];
}

interface EvaluatedAttempt {
  generation: AttemptGenerationDetails;
  result: AttemptResult;
}

const levelPromptSignalMap: Record<string, PromptSignal[]> = {
  "level-1": [
    { canonical: "still", variants: ["still"] },
    { canonical: "life", variants: ["life"] },
    { canonical: "pear", variants: ["pear", "pears"] },
    { canonical: "bottle", variants: ["bottle"] },
    { canonical: "wooden", variants: ["wooden"] },
    { canonical: "sunlit", variants: ["sunlit"] },
    { canonical: "warm", variants: ["warm"] },
    { canonical: "table", variants: ["table"] },
  ],
  "level-2": [
    { canonical: "portrait", variants: ["portrait"] },
    { canonical: "neon", variants: ["neon"] },
    { canonical: "wet", variants: ["wet"] },
    { canonical: "alley", variants: ["alley"] },
    { canonical: "midnight", variants: ["midnight"] },
    { canonical: "cinematic", variants: ["cinematic"] },
    { canonical: "urban", variants: ["urban"] },
    { canonical: "signs", variants: ["signs"] },
  ],
  "level-3": [
    { canonical: "courtyard", variants: ["courtyard", "cloister"] },
    { canonical: "arches", variants: ["arches", "archways", "archway", "arcade"] },
    { canonical: "stone", variants: ["stone", "sandstone", "masonry"] },
    { canonical: "ornate", variants: ["ornate", "carved"] },
    { canonical: "historical", variants: ["historical", "historic"] },
    { canonical: "warm", variants: ["warm", "warmed"] },
    { canonical: "architecture", variants: ["architecture", "architectural"] },
    { canonical: "layered", variants: ["layered", "repeating"] },
  ],
};

function tokenizePrompt(promptText: string) {
  return new Set(promptText.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function getMatchedPromptSignals(level: Level, promptTokens: Set<string>) {
  return (levelPromptSignalMap[level.id] ?? []).filter((signal) =>
    signal.variants.some((variant) => promptTokens.has(variant)),
  );
}

export function scorePromptAgainstLevel(level: Level, promptText: string): AttemptScore {
  const promptTokens = tokenizePrompt(promptText);
  const matchedSignals = getMatchedPromptSignals(level, promptTokens);
  const promptLengthRatio = Math.min(promptText.length / level.promptCharacterLimit, 1);
  const baseNormalized = Math.min(
    98,
    Math.round(20 + promptLengthRatio * 30 + matchedSignals.length * 10 + Math.min(promptTokens.size, 12) * 1.5),
  );
  const normalized =
    level.difficulty === "hard" && matchedSignals.length < 4
      ? Math.min(baseNormalized, Math.max(level.threshold - 5, 0))
      : baseNormalized;

  return {
    raw: Number((normalized / 100).toFixed(6)),
    normalized,
    threshold: level.threshold,
    passed: normalized >= level.threshold,
    breakdown: {
      subject: normalized,
      context: Math.max(normalized - 8, 0),
      composition: Math.max(normalized - 12, 0),
    },
    scorer: {
      provider: "mock",
      model: "local-scoring-fixture-v2",
    },
  };
}

export function buildScoredAttemptResult(level: Level, promptText: string): AttemptResult {
  return buildAttemptResultFromScore(scorePromptAgainstLevel(level, promptText));
}

export function buildAttemptResultFromScore(score: AttemptScore, scoringReasoning?: string): AttemptResult {
  return {
    status: "scored",
    outcome: score.passed ? "passed" : "failed",
    score,
    tipIds: [],
    scoringReasoning,
  };
}

export function mapProviderFailureToAttemptResult(failure: ProviderFailure): AttemptResult {
  if (failure.kind === "content_policy_rejection") {
    return {
      status: "content_policy_rejected",
      outcome: "rejected",
      failureKind: failure.kind,
      tipIds: [],
      errorCode: failure.code,
      errorMessage: failure.message,
    };
  }

  return {
    status: "technical_failure",
    outcome: "error",
    failureKind: failure.kind,
    tipIds: [],
    errorCode: failure.code,
    errorMessage: failure.message,
  };
}

export const mapGenerationFailureToAttemptResult = mapProviderFailureToAttemptResult;

export function evaluateMockAttempt(level: Level, promptText: string, attemptId: string): EvaluatedAttempt {
  const normalizedPrompt = promptText.toLowerCase();

  if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.generationContentPolicy)) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "content_policy_rejected",
        outcome: "rejected",
        failureKind: "content_policy_rejection",
        tipIds: [],
        errorCode: "mock_policy_rejection",
        errorMessage: "The prompt was rejected by the mock content-policy fixture.",
      },
    };
  }

  if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.timeout)) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        failureKind: "timeout",
        tipIds: [],
        errorCode: "mock_generation_timeout",
        errorMessage: "The mock generation fixture timed out before returning an image.",
      },
    };
  }

  if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.generationRateLimit)) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        failureKind: "rate_limited",
        tipIds: [],
        errorCode: "mock_generation_rate_limit",
        errorMessage: "The mock generation fixture was rate-limited before returning an image.",
      },
    };
  }

  if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.interrupted)) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        failureKind: "interrupted",
        tipIds: [],
        errorCode: "mock_generation_interrupted",
        errorMessage: "The mock generation fixture was interrupted before returning an image.",
      },
    };
  }

  if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.scoringRateLimit)) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
        assetKey: `generated/${level.id}/${attemptId}.png`,
        seed: `${level.id}:${promptText.length}`,
        revisedPrompt: promptText,
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        failureKind: "rate_limited",
        tipIds: [],
        errorCode: "mock_scoring_rate_limit",
        errorMessage: "The mock scoring fixture was rate-limited before returning a score.",
      },
    };
  }

  return {
    generation: {
      provider: "mock",
      model: "local-generation-fixture-v1",
      assetKey: `generated/${level.id}/${attemptId}.png`,
      seed: `${level.id}:${promptText.length}`,
      revisedPrompt: promptText,
    },
    result: buildScoredAttemptResult(level, promptText),
  };
}
