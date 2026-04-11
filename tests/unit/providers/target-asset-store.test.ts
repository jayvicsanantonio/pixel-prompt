import { afterEach, describe, expect, it } from "vitest";

import { getTargetAssetRoot } from "@/server/providers";

describe("target asset store", () => {
  const originalTargetAssetDir = process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;

  afterEach(() => {
    if (originalTargetAssetDir === undefined) {
      delete process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
      return;
    }

    process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = originalTargetAssetDir;
  });

  it("uses the configured target asset root when provided", () => {
    process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = "/tmp/pixel-prompt-targets";

    expect(getTargetAssetRoot()).toBe("/tmp/pixel-prompt-targets");
  });

  it("requires a configured target asset root", () => {
    delete process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;

    expect(() => getTargetAssetRoot()).toThrow(
      "PIXEL_PROMPT_TARGET_ASSET_DIR must be set to the directory containing scorer-readable target assets.",
    );
  });
});
