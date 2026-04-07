import type { ImageScoringProvider } from "./contracts";
import { createMockImageScoringProvider } from "./mock-image-scoring";
import { hasOpenAiScoringConfig, OpenAiImageScoringProvider } from "./openai-image-scoring";

function shouldUseOpenAiImageScoringProvider() {
  if (process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING !== "1") {
    return false;
  }

  return hasOpenAiScoringConfig();
}

export function getImageScoringProvider(): ImageScoringProvider {
  if (shouldUseOpenAiImageScoringProvider()) {
    return new OpenAiImageScoringProvider();
  }

  return createMockImageScoringProvider();
}
