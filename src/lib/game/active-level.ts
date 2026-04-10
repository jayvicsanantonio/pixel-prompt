import type { AttemptScore, Level, LevelStatus } from "./types";

export type ActiveLevelInitialScreenMode = "active" | "failure";

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
  restartLevelHref: string;
}

export interface ActiveLevelFailurePreview {
  strongestAttemptScore: number;
  summary: string;
}

export interface ActiveLevelSummaryLevelPreview {
  levelId: Level["id"];
  levelNumber: number;
  levelTitle: string;
  bestScore: number;
  attemptsUsed: number;
  replayHref: string;
}

export interface ActiveLevelProgressLevelPreview {
  levelId: Level["id"];
  levelNumber: number;
  levelTitle: string;
  threshold: number;
  status: LevelStatus;
  isCurrent: boolean;
  bestScore: number | null;
  attemptsRemaining: number | null;
  href: string;
}

export interface ActiveLevelProgressOverview {
  highestUnlockedLevelNumber: number;
  levels: ActiveLevelProgressLevelPreview[];
}

export interface ActiveLevelSummaryPreview {
  levelsCompleted: number;
  totalAttemptsUsed: number;
  bestScores: ActiveLevelSummaryLevelPreview[];
  improvementDelta: number;
  improvementSummary: string;
  encouragement: string;
}

export interface ActiveLevelScreenState {
  level: Level;
  attemptsUsed: number;
  attemptsRemaining: number;
  promptDraft: string;
  analytics?: {
    anonymousPlayerId?: string;
    runId?: string;
  };
  progressOverview: ActiveLevelProgressOverview;
  resultPreview: ActiveLevelResultPreview;
  continuation: ActiveLevelContinuationPreview;
  failurePreview: ActiveLevelFailurePreview;
  summaryPreview: ActiveLevelSummaryPreview;
  initialScreenMode?: ActiveLevelInitialScreenMode;
}
