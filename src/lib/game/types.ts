import type { SCORE_BREAKDOWN_DIMENSIONS } from "./constants";

export type IsoDateTime = string;

export type AnonymousPlayerId = string;
export type GameRunId = string;
export type LevelId = string;
export type AttemptId = string;
export type AttemptFailureKind =
  | "content_policy_rejection"
  | "rate_limited"
  | "timeout"
  | "interrupted"
  | "technical_failure"
  | "asset_unavailable";

export type LevelStatus = "locked" | "unlocked" | "in_progress" | "passed" | "failed";
export type AttemptLifecycleStatus =
  | "draft"
  | "submitted"
  | "generating"
  | "scoring"
  | "scored"
  | "content_policy_rejected"
  | "technical_failure";

export type AttemptOutcome = "passed" | "failed" | "rejected" | "error";
export type ScoreBreakdownDimension = (typeof SCORE_BREAKDOWN_DIMENSIONS)[number];
export type LevelDifficulty = "easy" | "medium" | "hard";

export interface LevelTargetImage {
  assetKey: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Level {
  id: LevelId;
  number: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: LevelDifficulty;
  theme: string;
  threshold: number;
  promptCharacterLimit: number;
  maxAttempts: number;
  packId?: string;
  groupId?: string;
  targetImage: LevelTargetImage;
}

export interface AttemptGenerationDetails {
  provider: string;
  model: string;
  assetKey?: string;
  seed?: string | null;
  revisedPrompt?: string | null;
}

export interface AttemptScore {
  raw: number;
  normalized: number;
  threshold: number;
  passed: boolean;
  breakdown: Partial<Record<ScoreBreakdownDimension, number>>;
  scorer: {
    provider: string;
    model: string;
    version?: string;
  };
}

export interface AttemptResult {
  status: AttemptLifecycleStatus;
  outcome: AttemptOutcome;
  failureKind?: AttemptFailureKind;
  score?: AttemptScore;
  strongestAttemptScore?: number | null;
  tipIds: string[];
  scoringReasoning?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface LevelAttempt {
  id: AttemptId;
  runId: GameRunId;
  levelId: LevelId;
  attemptCycle: number;
  attemptNumber: number;
  promptText: string;
  createdAt: IsoDateTime;
  consumedAttempt: boolean;
  generation?: AttemptGenerationDetails;
  result: AttemptResult;
}

export interface LevelProgress {
  levelId: LevelId;
  status: LevelStatus;
  currentAttemptCycle: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  bestScore: number | null;
  strongestAttemptId?: AttemptId | null;
  unlockedAt?: IsoDateTime | null;
  completedAt?: IsoDateTime | null;
  lastCompletedAt?: IsoDateTime | null;
  lastAttemptedAt?: IsoDateTime | null;
}

export interface GameProgress {
  playerId: AnonymousPlayerId;
  runId: GameRunId;
  currentLevelId: LevelId | null;
  highestUnlockedLevelNumber: number;
  totalAttemptsUsed: number;
  canResume: boolean;
  lastActiveAt: IsoDateTime;
  levels: LevelProgress[];
}
