import type { AttemptScore, Level } from "./types";

export interface ActiveLevelResultPreview {
  generatedImageAlt: string;
  score: AttemptScore;
  summary: string;
}

export interface ActiveLevelContinuationPreview {
  attemptsRemainingAfterResult: number;
  nextLevelHref: string | null;
  nextLevelNumber: number | null;
  nextLevelTitle: string | null;
}

export interface ActiveLevelFailurePreview {
  strongestAttemptScore: number;
  summary: string;
}

export interface ActiveLevelScreenState {
  level: Level;
  attemptsUsed: number;
  attemptsRemaining: number;
  promptDraft: string;
  resultPreview: ActiveLevelResultPreview;
  continuation: ActiveLevelContinuationPreview;
  failurePreview: ActiveLevelFailurePreview;
}
