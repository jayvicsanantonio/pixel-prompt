import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { levels } from "@/content";
import type { LevelId } from "@/lib/game";

export const MOCK_IMAGE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9Wn2X2QAAAAASUVORK5CYII=";

export const MOCK_PROVIDER_PROMPT_MARKERS = {
  generationContentPolicy: "#policy",
  interrupted: "#interrupt",
  slowGeneration: "#slow",
  scoringContentPolicy: "#score-policy",
  timeout: "#timeout",
} as const;

export async function seedMockTargetAssets(targetAssetRoot: string, levelIds?: LevelId[]) {
  const requestedLevelIds = levelIds ? new Set(levelIds) : null;

  await Promise.all(
    levels
      .filter((level) => !requestedLevelIds || requestedLevelIds.has(level.id))
      .map(async (level) => {
        const targetPath = path.join(targetAssetRoot, level.targetImage.assetKey);

        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, Buffer.from(MOCK_IMAGE_PNG_BASE64, "base64"));
      }),
  );
}
