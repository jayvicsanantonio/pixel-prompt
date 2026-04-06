import type { ImageGenerationProvider } from "./contracts";
import { createMockImageGenerationProvider } from "./mock-image-generation";
import { hasOpenAiImageGenerationConfig, OpenAiImageGenerationProvider } from "./openai-image-generation";

function shouldUseOpenAiImageGenerationProvider() {
  if (process.env.NODE_ENV === "test" && process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION !== "1") {
    return false;
  }

  return hasOpenAiImageGenerationConfig();
}

export function getImageGenerationProvider(): ImageGenerationProvider {
  if (shouldUseOpenAiImageGenerationProvider()) {
    return new OpenAiImageGenerationProvider();
  }

  return createMockImageGenerationProvider();
}
