import type { Level } from "./types";

export interface ActiveLevelScreenState {
  level: Level;
  attemptsUsed: number;
  attemptsRemaining: number;
  promptDraft: string;
}
