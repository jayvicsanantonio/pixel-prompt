import { levels } from "@/content";
import { scorePromptAgainstLevel } from "@/server/game/mock-attempt-evaluator";

import type { ImageScoringProvider, ImageScoringRequest, ImageScoringResult, ProviderModelRef } from "./contracts";
import { MOCK_PROVIDER_PROMPT_MARKERS } from "./mock-fixtures";

const MOCK_SCORING_MODEL: ProviderModelRef = {
  provider: "mock",
  model: "local-scoring-fixture-v2",
};

export class MockImageScoringProvider implements ImageScoringProvider {
  readonly providerId = "mock";
  readonly modelRef = MOCK_SCORING_MODEL;

  async scoreImageMatch(request: ImageScoringRequest): Promise<ImageScoringResult> {
    if (request.signal?.aborted) {
      return {
        ok: false,
        kind: "interrupted",
        code: "mock_scoring_interrupted",
        message: "The mock scoring fixture was interrupted before returning a score.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    if (request.prompt.toLowerCase().includes(MOCK_PROVIDER_PROMPT_MARKERS.scoringContentPolicy)) {
      return {
        ok: false,
        kind: "content_policy_rejection",
        code: "mock_scoring_policy_rejection",
        message: "The mock scoring fixture rejected the generated comparison for content-policy reasons.",
        retryable: false,
        consumeAttempt: false,
      };
    }

    if (request.prompt.toLowerCase().includes(MOCK_PROVIDER_PROMPT_MARKERS.scoringRateLimit)) {
      return {
        ok: false,
        kind: "rate_limited",
        code: "mock_scoring_rate_limit",
        message: "The mock scoring fixture was rate-limited before returning a score.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    const level = levels.find((candidate) => candidate.id === request.context.levelId);

    if (!level) {
      return {
        ok: false,
        kind: "technical_failure",
        code: "mock_scoring_level_missing",
        message: `The mock scoring fixture could not find level "${request.context.levelId}".`,
        retryable: false,
        consumeAttempt: false,
      };
    }

    return {
      ok: true,
      createdAt: new Date().toISOString(),
      provider: this.modelRef,
      score: scorePromptAgainstLevel(level, request.prompt),
      reasoning: "Mock scorer used deterministic level signal coverage while the real scorer was disabled.",
    };
  }
}

export function createMockImageScoringProvider() {
  return new MockImageScoringProvider();
}
