import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getImageScoringProvider,
  LmStudioImageScoringProvider,
  MOCK_IMAGE_PNG_BASE64,
  MOCK_PROVIDER_PROMPT_MARKERS,
  createMockImageScoringProvider,
  OpenAiImageScoringProvider,
  persistGeneratedOutput,
  readTargetAsset,
  seedMockTargetAssets,
} from "@/server/providers";

describe("image scoring providers", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEnableLmStudioScoring = process.env.PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING;
  const originalEnableOpenAiScoring = process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING;
  const originalLmStudioApiKey = process.env.LMSTUDIO_API_KEY;
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
  const originalLmStudioBaseUrl = process.env.LMSTUDIO_BASE_URL;
  const originalTargetAssetDir = process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
  let generatedOutputDir = "";
  let targetAssetDir = "";

  beforeEach(async () => {
    generatedOutputDir = path.join(process.cwd(), ".tmp", `vitest-generated-${Date.now()}`);
    targetAssetDir = path.join(process.cwd(), ".tmp", `vitest-targets-${Date.now()}`);
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = generatedOutputDir;
    process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = targetAssetDir;
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });
    await seedMockTargetAssets(targetAssetDir, ["level-1"]);
  });

  afterEach(async () => {
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalEnableLmStudioScoring === undefined) {
      delete process.env.PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING;
    } else {
      process.env.PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING = originalEnableLmStudioScoring;
    }

    if (originalEnableOpenAiScoring === undefined) {
      delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING;
    } else {
      process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING = originalEnableOpenAiScoring;
    }

    if (originalLmStudioApiKey === undefined) {
      delete process.env.LMSTUDIO_API_KEY;
    } else {
      process.env.LMSTUDIO_API_KEY = originalLmStudioApiKey;
    }

    if (originalLmStudioBaseUrl === undefined) {
      delete process.env.LMSTUDIO_BASE_URL;
    } else {
      process.env.LMSTUDIO_BASE_URL = originalLmStudioBaseUrl;
    }

    if (originalGeneratedOutputDir === undefined) {
      delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    } else {
      process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = originalGeneratedOutputDir;
    }

    if (originalTargetAssetDir === undefined) {
      delete process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
    } else {
      process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = originalTargetAssetDir;
    }
  });

  it("keeps the existing mock scoring behavior available", async () => {
    const provider = createMockImageScoringProvider();
    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/mock/level-1/attempt-1.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 50,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      provider: {
        provider: "mock",
      },
      score: {
        passed: true,
      },
    });
  });

  it("prefers LM Studio scoring when explicitly enabled", async () => {
    process.env.PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING = "1";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING = "1";
    process.env.OPENAI_API_KEY = "sk-test";

    const provider = await getImageScoringProvider();

    expect(provider.providerId).toBe("lmstudio");
  });

  it("returns a deterministic rate-limit failure from the mock scoring provider", async () => {
    const provider = createMockImageScoringProvider();
    const result = await provider.scoreImageMatch({
      prompt: `sunlit still life ${MOCK_PROVIDER_PROMPT_MARKERS.scoringRateLimit}`,
      generatedImageAssetKey: "generated/mock/level-1/attempt-rate-limit.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 50,
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
      code: "mock_scoring_rate_limit",
      message: "The mock scoring fixture was rate-limited before returning a score.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("returns asset-unavailable when the target image cannot be loaded", async () => {
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl: vi.fn(),
    });

    const result = await provider.scoreImageMatch({
      prompt: "still life",
      generatedImageAssetKey: "generated/openai/level-1/attempt-1.png",
      targetImage: {
        assetKey: "targets/missing.png",
        alt: "Missing target",
      },
      threshold: 50,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "asset_unavailable",
      code: "scoring_asset_unavailable",
      message: expect.any(String),
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("turns OpenAI structured output into a normalized attempt score", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-1.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            normalizedScore: 67,
            reasoning: "The generated still life matches the warm tabletop setup but drifts on composition precision.",
            breakdown: {
              medium: 72,
              subject: 69,
              context: 65,
              style: 63,
              materials: 66,
              textures: 61,
              shapes: 64,
              composition: 59,
              time_period: 70,
            },
          }),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-1.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 50,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-1",
        attemptNumber: 1,
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await readTargetAsset("targets/level-1.png")).toBeInstanceOf(Buffer);
    expect(result).toMatchObject({
      ok: true,
      provider: {
        provider: "openai",
      },
      score: {
        normalized: 67,
        passed: true,
        threshold: 50,
        breakdown: {
          composition: 59,
          medium: 72,
        },
      },
      reasoning: "The generated still life matches the warm tabletop setup but drifts on composition precision.",
    });
  });

  it("turns LM Studio structured output into a normalized attempt score", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/lmstudio/level-1/attempt-1.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  normalizedScore: 73,
                  reasoning: "The generated image stays close on subject and palette, with mild drift in composition.",
                  breakdown: {
                    medium: 75,
                    subject: 77,
                    context: 70,
                    style: 72,
                    materials: 71,
                    textures: 68,
                    shapes: 74,
                    composition: 69,
                    time_period: 80,
                  },
                }),
              },
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
    const provider = new LmStudioImageScoringProvider({
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/lmstudio/level-1/attempt-1.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
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
        provider: "lmstudio",
        model: process.env.LMSTUDIO_SCORING_MODEL || "google/gemma-4-26b-a4b",
      },
      score: {
        normalized: 73,
        passed: true,
        threshold: 70,
        breakdown: {
          composition: 69,
          medium: 75,
        },
      },
      reasoning: "The generated image stays close on subject and palette, with mild drift in composition.",
    });
  });

  it("maps LM Studio 429 responses to rate-limited failures", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/lmstudio/level-1/attempt-429.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: "Too many local requests.",
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
    const provider = new LmStudioImageScoringProvider({
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life",
      generatedImageAssetKey: "generated/lmstudio/level-1/attempt-429.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
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
      message: "Too many local requests.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("clamps out-of-range OpenAI score fields into the shared normalized score contract", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-2.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            normalizedScore: 104,
            reasoning: "The images are very close.",
            breakdown: {
              medium: 102,
              subject: 99,
              context: -5,
              style: 88,
              materials: 140,
              textures: 76,
              shapes: 85,
              composition: 91,
              time_period: 81,
            },
          }),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-2.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-2",
        attemptNumber: 2,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      score: {
        raw: 1,
        normalized: 100,
        threshold: 70,
        passed: true,
        breakdown: {
          medium: 100,
          context: 0,
          materials: 100,
        },
      },
      reasoning: "The images are very close.",
    });
  });

  it("treats timeout errors as timeout failures", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-3.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl: vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-3.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-3",
        attemptNumber: 3,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "timeout",
      code: "openai_scoring_timeout",
      message: "OpenAI image scoring timed out before returning a score.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("keeps timeout handling active while reading the scoring response body", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-4.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
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
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
      timeoutMs: 5,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-4.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-4",
        attemptNumber: 4,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "timeout",
      code: "openai_scoring_timeout",
      message: "OpenAI image scoring timed out before returning a score.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("maps OpenAI 429 responses to rate-limited failures", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-429.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: "Too many scoring requests.",
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
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-429.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-429",
        attemptNumber: 7,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "rate_limited",
      code: "rate_limit_exceeded",
      message: "Too many scoring requests.",
      retryable: true,
      consumeAttempt: false,
    });
  });

  it("maps OpenAI moderation failures to content-policy rejections", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-5.png",
      imageBase64: MOCK_IMAGE_PNG_BASE64,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "content_policy_violation",
            message: "The comparison request was rejected by safety policy.",
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
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life #score-policy",
      generatedImageAssetKey: "generated/openai/level-1/attempt-5.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-5",
        attemptNumber: 5,
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "content_policy_rejection",
      code: "content_policy_violation",
      message: "The comparison request was rejected by safety policy.",
      retryable: false,
      consumeAttempt: false,
    });
  });

  it("maps aborted request signals to interrupted failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    const provider = new OpenAiImageScoringProvider({
      apiKey: "sk-test",
      fetchImpl,
    });

    const result = await provider.scoreImageMatch({
      prompt: "sunlit still life of pears and a bottle on a wooden table",
      generatedImageAssetKey: "generated/openai/level-1/attempt-4.png",
      targetImage: {
        assetKey: "targets/level-1.png",
        alt: "A sunlit still life arranged on a wooden table.",
      },
      threshold: 70,
      context: {
        runId: "run-1",
        levelId: "level-1",
        attemptId: "attempt-6",
        attemptNumber: 6,
      },
      signal: controller.signal,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kind: "interrupted",
      code: "openai_scoring_interrupted",
      message: "The scoring request was interrupted before OpenAI returned a score.",
      retryable: true,
      consumeAttempt: false,
    });
  });
});
