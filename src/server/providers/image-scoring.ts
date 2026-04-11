import "@/server/server-only";

import type { ImageScoringProvider } from "./contracts";
import { createMockImageScoringProvider } from "./mock-image-scoring";

function shouldUseOpenAiImageScoringProvider() {
  if (process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING !== "1") {
    return false;
  }

  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function getImageScoringProvider(): Promise<ImageScoringProvider> {
  if (shouldUseOpenAiImageScoringProvider()) {
    const { OpenAiImageScoringProvider } = await import("./openai-image-scoring");

    return new OpenAiImageScoringProvider();
  }

  return createMockImageScoringProvider();
}
