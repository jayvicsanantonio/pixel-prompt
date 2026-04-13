import "@/server/server-only";

import type { ImageGenerationProvider } from "./contracts";

function shouldUseComfyUiImageGenerationProvider() {
  const enabled = process.env.PIXEL_PROMPT_ENABLE_COMFYUI_IMAGE_GENERATION?.trim() === "1";
  const hasWorkflowPath = Boolean(process.env.COMFYUI_WORKFLOW_PATH?.trim());

  return enabled && hasWorkflowPath;
}

function shouldUseOpenAiImageGenerationProvider() {
  const enabled = process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION?.trim() === "1";
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return enabled && hasApiKey;
}

export async function getImageGenerationProvider(): Promise<ImageGenerationProvider> {
  if (shouldUseComfyUiImageGenerationProvider()) {
    const { ComfyUiImageGenerationProvider } = await import("./comfyui-image-generation");

    return new ComfyUiImageGenerationProvider();
  }

  if (shouldUseOpenAiImageGenerationProvider()) {
    const { OpenAiImageGenerationProvider } = await import("./openai-image-generation");

    return new OpenAiImageGenerationProvider();
  }

  const { createMockImageGenerationProvider } = await import("./mock-image-generation");

  return createMockImageGenerationProvider();
}
