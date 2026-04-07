import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockImageScoringProvider,
  OpenAiImageScoringProvider,
  persistGeneratedOutput,
  readTargetAsset,
} from "@/server/providers";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9Wn2X2QAAAAASUVORK5CYII=";

describe("image scoring providers", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
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
    await mkdir(path.join(targetAssetDir, "targets"), { recursive: true });
    await writeFile(path.join(targetAssetDir, "targets", "level-1.png"), Buffer.from(onePixelPngBase64, "base64"));
  });

  afterEach(async () => {
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
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
      imageBase64: onePixelPngBase64,
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

  it("clamps out-of-range OpenAI score fields into the shared normalized score contract", async () => {
    await persistGeneratedOutput({
      assetKey: "generated/openai/level-1/attempt-2.png",
      imageBase64: onePixelPngBase64,
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
      imageBase64: onePixelPngBase64,
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
});
