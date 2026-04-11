import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOCK_IMAGE_PNG_BASE64,
  MOCK_PROVIDER_PROMPT_MARKERS,
  createMockImageGenerationProvider,
  getImageGenerationProvider,
  OpenAiImageGenerationProvider,
} from "@/server/providers";

describe("image generation providers", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEnableOpenAiInTests = process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
  let generatedOutputDir = "";

  beforeEach(async () => {
    generatedOutputDir = path.join(process.cwd(), ".tmp", `vitest-generated-${Date.now()}`);
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = generatedOutputDir;
    await rm(generatedOutputDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(generatedOutputDir, { recursive: true, force: true });

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalEnableOpenAiInTests === undefined) {
      delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;
    } else {
      process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = originalEnableOpenAiInTests;
    }

    if (originalGeneratedOutputDir === undefined) {
      delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    } else {
      process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = originalGeneratedOutputDir;
    }
  });

  it("defaults to the mock provider in tests even when an API key is present", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;

    const provider = await getImageGenerationProvider();

    expect(provider.providerId).toBe("mock");
  });

  it("allows opting into the OpenAI provider in tests", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = "1";

    const provider = await getImageGenerationProvider();

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

    const generatedOutput = await readFile(path.join(generatedOutputDir, result.assetKey));

    expect(generatedOutput.length).toBeGreaterThan(0);
  });

  it("returns a deterministic rate-limit failure from the mock provider", async () => {
    const provider = createMockImageGenerationProvider();

    const result = await provider.generateImage({
      prompt: `sunlit pears on a table ${MOCK_PROVIDER_PROMPT_MARKERS.generationRateLimit}`,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-rate-limit",
        attemptNumber: 1,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "rate_limited",
      code: "mock_generation_rate_limit",
      message: "The mock generation fixture was rate-limited before returning an image.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("stores successful OpenAI generations in the generated output store", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          created: 1_775_529_600,
          data: [
            {
              b64_json: MOCK_IMAGE_PNG_BASE64,
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

    const generatedOutput = await readFile(path.join(generatedOutputDir, result.assetKey));

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

  it("maps OpenAI 429 responses to rate-limited failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: "Too many image generation requests.",
            type: "rate_limit_error",
          },
        }),
        {
          status: 429,
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
        attemptId: "attempt-429",
        attemptNumber: 1,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "rate_limited",
      code: "rate_limit_exceeded",
      message: "Too many image generation requests.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("returns a structured failure when generated-output persistence fails", async () => {
    const provider = new OpenAiImageGenerationProvider({
      apiKey: "sk-test",
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                b64_json: MOCK_IMAGE_PNG_BASE64,
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
      ),
    });
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = "/dev/null/generated-output";

    const result = await provider.generateImage({
      prompt: "sunlit pears on a table",
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      kind: "technical_failure",
      code: "generated_output_persist_failed",
      consumeAttempt: false,
    });
  });

  it("treats AbortSignal timeout errors as timeout failures", async () => {
    const provider = new OpenAiImageGenerationProvider({
      apiKey: "sk-test",
      fetchImpl: vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
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

    expect(result).toEqual({
      ok: false,
      kind: "timeout",
      code: "openai_generation_timeout",
      message: "OpenAI image generation timed out before returning an image.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("keeps timeout handling active while reading the response body", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;

      return {
        ok: true,
        status: 200,
        json: async () =>
          await new Promise<never>((_resolve, reject) => {
            const rejectWithAbortReason = () =>
              reject(signal.reason ?? Object.assign(new Error("aborted"), { name: "AbortError" }));

            if (signal.aborted) {
              rejectWithAbortReason();
              return;
            }

            signal.addEventListener("abort", rejectWithAbortReason, { once: true });
          }),
      } as unknown as Response;
    });
    const provider = new OpenAiImageGenerationProvider({
      apiKey: "sk-test",
      fetchImpl,
      timeoutMs: 5,
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

    expect(result).toEqual({
      ok: false,
      kind: "timeout",
      code: "openai_generation_timeout",
      message: "OpenAI image generation timed out before returning an image.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("maps aborted request signals to interrupted failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
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
      signal: controller.signal,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kind: "interrupted",
      code: "openai_generation_interrupted",
      message: "The generation request was interrupted before OpenAI returned an image.",
      retryable: true,
      consumeAttempt: false,
    });
  });
});
