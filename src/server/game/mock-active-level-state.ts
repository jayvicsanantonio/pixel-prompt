import { levels } from "@/content";
import type { ActiveLevelScreenState } from "@/lib/game";

export function getMockActiveLevelState(): ActiveLevelScreenState {
  const level = levels[0];

  return {
    level,
    attemptsUsed: 0,
    attemptsRemaining: level.maxAttempts,
    promptDraft: "",
  };
}
