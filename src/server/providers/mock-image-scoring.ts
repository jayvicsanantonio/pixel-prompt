import { levels } from "@/content";
import { scorePromptAgainstLevel } from "@/server/game/mock-attempt-evaluator";

import type { ImageScoringProvider, ImageScoringRequest, ImageScoringResult, ProviderModelRef } from "./contracts";

const MOCK_SCORING_MODEL: ProviderModelRef = {
  provider: "mock",
  model: "local-scoring-fixture-v1",
};

export class MockImageScoringProvider implements ImageScoringProvider {
  readonly providerId = "mock";
  readonly modelRef = MOCK_SCORING_MODEL;

  async scoreImageMatch(request: ImageScoringRequest): Promise<ImageScoringResult> {
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
      reasoning: "Mock scorer used prompt keyword coverage while the real scorer was disabled.",
    };
  }
}

export function createMockImageScoringProvider() {
  return new MockImageScoringProvider();
}
