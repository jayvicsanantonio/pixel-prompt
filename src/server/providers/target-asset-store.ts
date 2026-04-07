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
  return path.join(getTargetAssetRoot(), normalizeAssetKey(assetKey));
}

export function getTargetAssetRoot() {
  return process.env.PIXEL_PROMPT_TARGET_ASSET_DIR?.trim() || path.join(process.cwd(), "public");
}

export async function readTargetAsset(assetKey: string) {
  return readFile(getTargetAssetPath(assetKey));
}
