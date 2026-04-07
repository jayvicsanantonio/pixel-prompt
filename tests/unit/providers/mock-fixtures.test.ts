import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { levels } from "@/content";
import { MOCK_IMAGE_PNG_BASE64, seedMockTargetAssets } from "@/server/providers";

describe("mock provider fixtures", () => {
  const targetAssetDir = path.join(process.cwd(), ".tmp", `vitest-fixtures-${Date.now()}`);

  afterEach(async () => {
    await rm(targetAssetDir, { recursive: true, force: true });
  });

  it("seeds deterministic target assets for requested levels", async () => {
    await seedMockTargetAssets(targetAssetDir, ["level-1", "level-3"]);

    const levelOne = levels.find((level) => level.id === "level-1");
    const levelThree = levels.find((level) => level.id === "level-3");

    expect(levelOne).toBeDefined();
    expect(levelThree).toBeDefined();

    if (!levelOne || !levelThree) {
      throw new Error("Expected seeded levels to exist.");
    }

    const [levelOneAsset, levelThreeAsset] = await Promise.all([
      readFile(path.join(targetAssetDir, levelOne.targetImage.assetKey)),
      readFile(path.join(targetAssetDir, levelThree.targetImage.assetKey)),
    ]);

    expect(levelOneAsset.equals(Buffer.from(MOCK_IMAGE_PNG_BASE64, "base64"))).toBe(true);
    expect(levelThreeAsset.equals(Buffer.from(MOCK_IMAGE_PNG_BASE64, "base64"))).toBe(true);
  });
});
