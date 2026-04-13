import "@/server/server-only";

import type { ImageScoringProvider } from "./contracts";
import { createMockImageScoringProvider } from "./mock-image-scoring";

function shouldUseLmStudioImageScoringProvider() {
  return process.env.PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING?.trim() === "1";
}

function shouldUseOpenAiImageScoringProvider() {
  if (process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING !== "1") {
    return false;
  }

  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function getImageScoringProvider(): Promise<ImageScoringProvider> {
  if (shouldUseLmStudioImageScoringProvider()) {
    const { LmStudioImageScoringProvider } = await import("./lmstudio-image-scoring");

    return new LmStudioImageScoringProvider();
  }

  if (shouldUseOpenAiImageScoringProvider()) {
    const { OpenAiImageScoringProvider } = await import("./openai-image-scoring");

    return new OpenAiImageScoringProvider();
  }

  return createMockImageScoringProvider();
}
