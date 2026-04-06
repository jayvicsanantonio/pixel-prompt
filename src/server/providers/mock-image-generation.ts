import { buildGeneratedOutputAssetKey, persistGeneratedOutput } from "./generated-output-store";
import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult, ProviderModelRef } from "./contracts";

const MOCK_IMAGE_MODEL: ProviderModelRef = {
  provider: "mock",
  model: "local-generation-fixture-v1",
};

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9Wn2X2QAAAAASUVORK5CYII=";

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly providerId = "mock";
  readonly modelRef = MOCK_IMAGE_MODEL;

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const normalizedPrompt = request.prompt.toLowerCase();

    if (normalizedPrompt.includes("#policy")) {
      return {
        ok: false,
        kind: "content_policy_rejection",
        code: "mock_policy_rejection",
        message: "The prompt was rejected by the mock content-policy fixture.",
        retryable: false,
        consumeAttempt: false,
      };
    }

    if (normalizedPrompt.includes("#timeout")) {
      return {
        ok: false,
        kind: "timeout",
        code: "mock_generation_timeout",
        message: "The mock generation fixture timed out before returning an image.",
        retryable: true,
        consumeAttempt: false,
      };
    }

    const assetKey = buildGeneratedOutputAssetKey({
      providerId: this.providerId,
      levelId: request.context.levelId,
      attemptId: request.context.attemptId,
    });

    await persistGeneratedOutput({
      assetKey,
      imageBase64: ONE_PIXEL_PNG_BASE64,
    });

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
