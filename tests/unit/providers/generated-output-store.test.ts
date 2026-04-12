import { afterEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";

import { getGeneratedOutputRoot } from "@/server/providers";

describe("generated output store", () => {
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalGeneratedOutputDir === undefined) {
      delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    } else {
      process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = originalGeneratedOutputDir;
    }

    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("uses the configured generated output root when provided", () => {
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = "/tmp/pixel-prompt-generated";

    expect(getGeneratedOutputRoot()).toBe("/tmp/pixel-prompt-generated");
  });

  it("falls back to the local generated output root outside production", () => {
    delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";

    expect(getGeneratedOutputRoot()).toBe(".pixel-prompt/generated-output");
  });

  it("uses ephemeral temp storage for preview deployments without a configured root", () => {
    delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";

    expect(getGeneratedOutputRoot()).toBe(path.join(os.tmpdir(), "pixel-prompt", "generated-output"));
  });

  it("requires a configured generated output root in production", () => {
    delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VERCEL_ENV;

    expect(() => getGeneratedOutputRoot()).toThrow(
      "PIXEL_PROMPT_GENERATED_OUTPUT_DIR must be set to the directory for persisted generated images.",
    );
  });
});
