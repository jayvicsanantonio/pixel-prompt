import type { AttemptGenerationDetails, AttemptResult, AttemptScore, Level } from "@/lib/game";

interface EvaluatedAttempt {
  generation: AttemptGenerationDetails;
  result: AttemptResult;
}

const levelKeywordMap: Record<string, string[]> = {
  "level-1": ["still", "life", "pear", "pears", "bottle", "wooden", "sunlit", "warm", "table"],
  "level-2": ["portrait", "neon", "wet", "alley", "midnight", "cinematic", "urban", "signs"],
  "level-3": ["courtyard", "arches", "stone", "ornate", "historical", "warm", "architecture", "layered"],
};

function scorePromptAgainstLevel(level: Level, promptText: string): AttemptScore {
  const normalizedPrompt = promptText.toLowerCase();
  const uniqueWords = new Set(normalizedPrompt.split(/[^a-z0-9]+/).filter(Boolean));
  const matchedKeywords = (levelKeywordMap[level.id] ?? []).filter((keyword) => uniqueWords.has(keyword));
  const promptLengthRatio = Math.min(promptText.length / level.promptCharacterLimit, 1);
  const normalized = Math.min(
    98,
    Math.round(20 + promptLengthRatio * 30 + matchedKeywords.length * 10 + Math.min(uniqueWords.size, 12) * 1.5),
  );

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
      model: "local-scoring-fixture-v1",
    },
  };
}

export function evaluateMockAttempt(level: Level, promptText: string, attemptId: string): EvaluatedAttempt {
  const normalizedPrompt = promptText.toLowerCase();

  if (normalizedPrompt.includes("#policy")) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "content_policy_rejected",
        outcome: "rejected",
        tipIds: [],
        errorCode: "mock_policy_rejection",
        errorMessage: "The prompt was rejected by the mock content-policy fixture.",
      },
    };
  }

  if (normalizedPrompt.includes("#timeout")) {
    return {
      generation: {
        provider: "mock",
        model: "local-generation-fixture-v1",
      },
      result: {
        status: "technical_failure",
        outcome: "error",
        tipIds: [],
        errorCode: "mock_generation_timeout",
        errorMessage: "The mock generation fixture timed out before returning an image.",
      },
    };
  }

  const score = scorePromptAgainstLevel(level, promptText);

  return {
    generation: {
      provider: "mock",
      model: "local-generation-fixture-v1",
      assetKey: `generated/${level.id}/${attemptId}.png`,
      seed: `${level.id}:${promptText.length}`,
      revisedPrompt: promptText,
    },
    result: {
      status: "scored",
      outcome: score.passed ? "passed" : "failed",
      score,
      tipIds: [],
    },
  };
}
