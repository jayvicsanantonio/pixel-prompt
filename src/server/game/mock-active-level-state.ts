import { levels } from "@/content";
import type { ActiveLevelScreenState } from "@/lib/game";

interface MockActiveLevelStateOptions {
  levelNumber?: number;
  resume?: boolean;
}

export function getMockActiveLevelState(options?: MockActiveLevelStateOptions): ActiveLevelScreenState {
  const level = levels.find((candidate) => candidate.number === options?.levelNumber) ?? levels[0];

  if (!level) {
    throw new Error("No levels available to build active level state.");
  }

  if (options?.resume) {
    return {
      level,
      attemptsUsed: 1,
      attemptsRemaining: Math.max(level.maxAttempts - 1, 0),
      promptDraft: "cinematic neon portrait in a wet alley at midnight",
    };
  }

  return {
    level,
    attemptsUsed: 0,
    attemptsRemaining: level.maxAttempts,
    promptDraft: "",
  };
}
