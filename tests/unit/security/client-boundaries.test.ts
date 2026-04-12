import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CLIENT_ONLY_FILES = [path.join(process.cwd(), "instrumentation-client.ts")];
const SECRET_ENV_NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_SCORING_MODEL",
  "DATABASE_URL",
  "AWS_REGION",
  "S3_TARGET_ASSET_BUCKET",
  "S3_GENERATED_OUTPUT_BUCKET",
  "PIXEL_PROMPT_TARGET_ASSET_DIR",
  "PIXEL_PROMPT_GENERATED_OUTPUT_DIR",
  "BLOB_READ_WRITE_TOKEN",
];
const serverImportPattern =
  /\bfrom\s+["'](?:@\/server\/|(?:\.\.\/)+server\/|(?:\.\/)+server\/|\/server\/)|\bimport\(\s*["'](?:@\/server\/|(?:\.\.\/)+server\/|(?:\.\/)+server\/|\/server\/)/;

async function collectSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }

      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

async function collectClientRuntimeFiles() {
  const sourceFiles = await collectSourceFiles(path.join(process.cwd(), "src"));
  const clientFiles: string[] = [];

  for (const filePath of sourceFiles) {
    const contents = await readFile(filePath, "utf8");

    if (/^['"]use client['"]/.test(contents.trim())) {
      clientFiles.push(filePath);
    }
  }

  return [...clientFiles, ...CLIENT_ONLY_FILES];
}

describe("client/server boundaries", () => {
  it("keeps client runtime files free of server imports and secret env names", async () => {
    const clientRuntimeFiles = await collectClientRuntimeFiles();

    expect(clientRuntimeFiles.length).toBeGreaterThan(0);

    for (const filePath of clientRuntimeFiles) {
      const contents = await readFile(filePath, "utf8");

      expect(contents).not.toMatch(serverImportPattern);

      for (const envName of SECRET_ENV_NAMES) {
        expect(contents).not.toContain(envName);
      }
    }
  });
});
