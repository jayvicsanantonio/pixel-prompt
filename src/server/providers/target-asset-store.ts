import "@/server/server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizeAssetKey(assetKey: string) {
  const normalized = assetKey.replaceAll("\\", "/").replace(/^\/+/, "");

  if (
    normalized.length === 0 ||
    normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid target asset key "${assetKey}".`);
  }

  return normalized;
}

function getTargetAssetPath(assetKey: string) {
  return path.join(/* turbopackIgnore: true */ getTargetAssetRoot(), normalizeAssetKey(assetKey));
}

export function getTargetAssetRoot() {
  const configuredRoot = process.env.PIXEL_PROMPT_TARGET_ASSET_DIR?.trim();

  if (configuredRoot) {
    return configuredRoot;
  }

  throw new Error("PIXEL_PROMPT_TARGET_ASSET_DIR must be set to the directory containing scorer-readable target assets.");
}

export async function readTargetAsset(assetKey: string) {
  return readFile(/* turbopackIgnore: true */ getTargetAssetPath(assetKey));
}
