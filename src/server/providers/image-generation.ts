import "@/server/server-only";

import type { ImageGenerationProvider } from "./contracts";

function shouldUseOpenAiImageGenerationProvider() {
  const enabled = process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION?.trim() === "1";
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return enabled && hasApiKey;
}

export async function getImageGenerationProvider(): Promise<ImageGenerationProvider> {
  if (shouldUseOpenAiImageGenerationProvider()) {
    const { OpenAiImageGenerationProvider } = await import("./openai-image-generation");

    return new OpenAiImageGenerationProvider();
  }

  const { createMockImageGenerationProvider } = await import("./mock-image-generation");

  return createMockImageGenerationProvider();
}
