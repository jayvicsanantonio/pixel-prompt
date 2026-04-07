import { buildGeneratedOutputAssetKey, persistGeneratedOutput } from "./generated-output-store";
import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult, ProviderModelRef } from "./contracts";
import { MOCK_IMAGE_PNG_BASE64, MOCK_PROVIDER_PROMPT_MARKERS } from "./mock-fixtures";

const MOCK_IMAGE_MODEL: ProviderModelRef = {
  provider: "mock",
  model: "local-generation-fixture-v1",
};

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly providerId = "mock";
  readonly modelRef = MOCK_IMAGE_MODEL;

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (request.signal?.aborted) {
      return {
        ok: false,
        kind: "interrupted",
        code: "mock_generation_interrupted",
        message: "The mock generation fixture was interrupted before returning an image.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    const normalizedPrompt = request.prompt.toLowerCase();

    if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.generationContentPolicy)) {
      return {
        ok: false,
        kind: "content_policy_rejection",
        code: "mock_policy_rejection",
        message: "The prompt was rejected by the mock content-policy fixture.",
        retryable: false,
        consumeAttempt: false,
      };
    }

    if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.timeout)) {
      return {
        ok: false,
        kind: "timeout",
        code: "mock_generation_timeout",
        message: "The mock generation fixture timed out before returning an image.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    if (normalizedPrompt.includes(MOCK_PROVIDER_PROMPT_MARKERS.interrupted)) {
      return {
        ok: false,
        kind: "interrupted",
        code: "mock_generation_interrupted",
        message: "The mock generation fixture was interrupted before returning an image.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    const assetKey = buildGeneratedOutputAssetKey({
      providerId: this.providerId,
      levelId: request.context.levelId,
      attemptId: request.context.attemptId,
    });

    try {
      await persistGeneratedOutput({
        assetKey,
        imageBase64: MOCK_IMAGE_PNG_BASE64,
      });
    } catch (error) {
      return {
        ok: false,
        kind: "technical_failure",
        code: "mock_generated_output_persist_failed",
        message: error instanceof Error ? error.message : "The mock generated image could not be persisted.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    return {
      ok: true,
      assetKey,
      createdAt: new Date().toISOString(),
      provider: this.modelRef,
      seed: `${request.context.levelId}:${request.prompt.length}`,
      revisedPrompt: request.prompt,
    };
  }
}

export function createMockImageGenerationProvider() {
  return new MockImageGenerationProvider();
}
