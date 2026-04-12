import "@/server/server-only";

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

function getMimeType(assetKey: string) {
  const normalizedKey = assetKey.toLowerCase();

  if (normalizedKey.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedKey.endsWith(".jpg") || normalizedKey.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalizedKey.endsWith(".webp")) {
    return "image/webp";
  }

  return "application/octet-stream";
}

function shouldUseVercelBlobStore() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function getLocalGeneratedOutputRoot() {
  const configuredRoot = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR?.trim();

  if (configuredRoot) {
    return configuredRoot;
  }

  if (process.env.NODE_ENV !== "production") {
    return ".pixel-prompt/generated-output";
  }

  throw new Error(
    "BLOB_READ_WRITE_TOKEN or PIXEL_PROMPT_GENERATED_OUTPUT_DIR must be set for persisted generated images in production.",
  );
}

/**
 * Returns the local filesystem root for generated output.
 *
 * In production with Vercel Blob configured, this is not used for
 * persistence — images are stored in Vercel Blob instead. This function
 * remains available for local development and tests.
 */
export function getGeneratedOutputRoot() {
  return getLocalGeneratedOutputRoot();
}

export function buildGeneratedOutputAssetKey(input: BuildGeneratedOutputAssetKeyInput) {
  const extension = formatExtensions[input.format ?? "png"];

  return `generated/${input.providerId}/${input.levelId}/${input.attemptId}.${extension}`;
}

export async function persistGeneratedOutput(input: PersistGeneratedOutputInput) {
  const normalizedKey = normalizeAssetKey(input.assetKey);
  const imageBuffer = Buffer.from(input.imageBase64, "base64");

  if (shouldUseVercelBlobStore()) {
    const { put } = await import("@vercel/blob");

    await put(normalizedKey, imageBuffer, {
      access: "public",
      contentType: getMimeType(normalizedKey),
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return;
  }

  const outputPath = path.join(/* turbopackIgnore: true */ getLocalGeneratedOutputRoot(), normalizedKey);
  await mkdir(/* turbopackIgnore: true */ path.dirname(outputPath), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ outputPath, imageBuffer);
}

export async function readGeneratedOutput(assetKey: string): Promise<Buffer> {
  const normalizedKey = normalizeAssetKey(assetKey);

  if (shouldUseVercelBlobStore()) {
    const { list } = await import("@vercel/blob");

    const listing = await list({ prefix: normalizedKey, limit: 1 });
    const blob = listing.blobs.find((b) => b.pathname === normalizedKey);

    if (!blob) {
      throw new Error(`Generated output not found in blob store: "${assetKey}".`);
    }

    const response = await fetch(blob.url);

    if (!response.ok) {
      throw new Error(`Failed to fetch generated output from blob store: "${assetKey}" (${response.status}).`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  const outputPath = path.join(/* turbopackIgnore: true */ getLocalGeneratedOutputRoot(), normalizedKey);

  return readFile(/* turbopackIgnore: true */ outputPath);
}
