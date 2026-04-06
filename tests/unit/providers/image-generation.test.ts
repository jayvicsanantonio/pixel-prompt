import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockImageGenerationProvider,
  getGeneratedOutputRoot,
  getImageGenerationProvider,
  OpenAiImageGenerationProvider,
  readGeneratedOutput,
} from "@/server/providers";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9Wn2X2QAAAAASUVORK5CYII=";

describe("image generation providers", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEnableOpenAiInTests = process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;

  beforeEach(async () => {
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = path.join(process.cwd(), ".tmp", `vitest-generated-${Date.now()}`);
    await rm(getGeneratedOutputRoot(), { recursive: true, force: true });
  });

  afterEach(async () => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = originalEnableOpenAiInTests;
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = originalGeneratedOutputDir;
    await rm(getGeneratedOutputRoot(), { recursive: true, force: true });
  });

  it("defaults to the mock provider in tests even when an API key is present", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;

    const provider = getImageGenerationProvider();

    expect(provider.providerId).toBe("mock");
  });

  it("allows opting into the OpenAI provider in tests", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = "1";

    const provider = getImageGenerationProvider();

    expect(provider.providerId).toBe("openai");
    expect(provider.modelRef.model).toBe(process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5");
  });

  it("persists the mock generated image fixture to the generated output store", async () => {
    const provider = createMockImageGenerationProvider();
    const result = await provider.generateImage({
      prompt: "sunlit pears on a table",
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected the mock provider to succeed.");
    }

    const generatedOutput = await readGeneratedOutput(result.assetKey);

    expect(generatedOutput.length).toBeGreaterThan(0);
  });

  it("stores successful OpenAI generations in the generated output store", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          created: 1_775_529_600,
          data: [
            {
              b64_json: onePixelPngBase64,
              revised_prompt: "refined prompt",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const provider = new OpenAiImageGenerationProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.generateImage({
      prompt: "sunlit pears on a table",
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      provider: {
        provider: "openai",
        model: provider.modelRef.model,
      },
      revisedPrompt: "refined prompt",
    });

    if (!result.ok) {
      throw new Error("Expected the OpenAI provider to succeed.");
    }

    const generatedOutput = await readGeneratedOutput(result.assetKey);

    expect(generatedOutput.length).toBeGreaterThan(0);
  });

  it("maps OpenAI moderation failures to content-policy rejections", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "content_policy_violation",
            message: "Request rejected by safety policy.",
            type: "invalid_request_error",
          },
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const provider = new OpenAiImageGenerationProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.generateImage({
      prompt: "blocked prompt",
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "content_policy_rejection",
      code: "content_policy_violation",
      message: "Request rejected by safety policy.",
      retryable: false,
      consumeAttempt: false,
    });
  });
});
