import "@/server/server-only";

import type { ImageGenerationProvider } from "./contracts";

function shouldUseOpenAiImageGenerationProvider() {
  if (process.env.NODE_ENV === "test" && process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION !== "1") {
    return false;
  }

  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function getImageGenerationProvider(): Promise<ImageGenerationProvider> {
  if (shouldUseOpenAiImageGenerationProvider()) {
    const { OpenAiImageGenerationProvider } = await import("./openai-image-generation");

    return new OpenAiImageGenerationProvider();
  }

  const { createMockImageGenerationProvider } = await import("./mock-image-generation");

  return createMockImageGenerationProvider();
}
