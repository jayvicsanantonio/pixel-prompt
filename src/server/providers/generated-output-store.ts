import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const formatExtensions = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
} as const;

export type GeneratedImageFormat = keyof typeof formatExtensions;

interface BuildGeneratedOutputAssetKeyInput {
  providerId: string;
  levelId: string;
  attemptId: string;
  format?: GeneratedImageFormat;
}

interface PersistGeneratedOutputInput {
  assetKey: string;
  imageBase64: string;
}

function normalizeAssetKey(assetKey: string) {
  const normalized = assetKey.replaceAll("\\", "/").replace(/^\/+/, "");

  if (
    normalized.length === 0 ||
    normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid generated asset key "${assetKey}".`);
  }

  return normalized;
}

function getGeneratedOutputPath(assetKey: string) {
  return path.join(getGeneratedOutputRoot(), normalizeAssetKey(assetKey));
}

export function getGeneratedOutputRoot() {
  const configuredRoot = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR?.trim();

  if (configuredRoot) {
    return configuredRoot;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("PIXEL_PROMPT_GENERATED_OUTPUT_DIR must be set in production until durable object storage is configured.");
  }

  return path.join(process.cwd(), ".pixel-prompt", "generated-output");
}

export function buildGeneratedOutputAssetKey(input: BuildGeneratedOutputAssetKeyInput) {
  const extension = formatExtensions[input.format ?? "png"];

  return `generated/${input.providerId}/${input.levelId}/${input.attemptId}.${extension}`;
}

export async function persistGeneratedOutput(input: PersistGeneratedOutputInput) {
  const outputPath = getGeneratedOutputPath(input.assetKey);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(input.imageBase64, "base64"));
}

export async function readGeneratedOutput(assetKey: string) {
  return readFile(getGeneratedOutputPath(assetKey));
}
