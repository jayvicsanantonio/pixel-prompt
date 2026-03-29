import { z } from "zod";

import type { AttemptId, AnonymousPlayerId, GameRunId, IsoDateTime, LevelId } from "@/lib/game";
import type { ProviderFailureKind } from "@/server/providers";

const analyticsBaseSchema = z.object({
  occurredAt: z.string().min(1),
  anonymousPlayerId: z.string().min(1).optional(),
});

const landingViewedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("landing_viewed"),
});

const gameStartedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("game_started"),
  runId: z.string().min(1),
  entry: z.enum(["new", "resume"]),
});

const resumeOfferedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("resume_offered"),
  runId: z.string().min(1),
  currentLevelId: z.string().min(1),
  highestUnlockedLevelNumber: z.number().int().positive(),
});

const resumeStartedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("resume_started"),
  runId: z.string().min(1),
  currentLevelId: z.string().min(1),
});

const levelStartedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("level_started"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  levelNumber: z.number().int().positive(),
  threshold: z.number().min(0).max(100),
  attemptWindow: z.number().int().positive(),
});

const promptValidationFailedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("prompt_validation_failed"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  reason: z.enum(["empty", "over_limit"]),
  promptLength: z.number().int().min(0),
});

const promptSubmittedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("prompt_submitted"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  attemptId: z.string().min(1),
  attemptNumber: z.number().int().positive(),
  promptLength: z.number().int().min(1),
});

const generationCompletedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("generation_completed"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  attemptId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  success: z.boolean(),
  failureKind: z
    .enum([
      "content_policy_rejection",
      "rate_limited",
      "timeout",
      "interrupted",
      "technical_failure",
      "asset_unavailable",
    ])
    .optional(),
});

const scoringCompletedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("scoring_completed"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  attemptId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  success: z.boolean(),
  failureKind: z
    .enum([
      "content_policy_rejection",
      "rate_limited",
      "timeout",
      "interrupted",
      "technical_failure",
      "asset_unavailable",
    ])
    .optional(),
});

const attemptResolvedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("attempt_resolved"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  attemptId: z.string().min(1),
  attemptNumber: z.number().int().positive(),
  promptLength: z.number().int().min(1),
  threshold: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  attemptsRemaining: z.number().int().min(0),
  strongestAttemptScore: z.number().min(0).max(100),
  tipsShown: z.boolean(),
  totalDurationMs: z.number().int().nonnegative(),
});

const levelCompletedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("level_completed"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  levelNumber: z.number().int().positive(),
  outcome: z.enum(["passed", "failed"]),
  attemptsUsed: z.number().int().min(0),
  bestScore: z.number().min(0).max(100),
});

const levelRestartedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("level_restarted"),
  runId: z.string().min(1),
  levelId: z.string().min(1),
  levelNumber: z.number().int().positive(),
  priorAttemptsUsed: z.number().int().min(0),
  bestScoreBeforeRestart: z.number().min(0).max(100),
});

const runCompletedEventSchema = analyticsBaseSchema.extend({
  name: z.literal("run_completed"),
  runId: z.string().min(1),
  levelsCompleted: z.number().int().min(0),
  totalAttemptsUsed: z.number().int().min(0),
});

export const analyticsEventSchema = z.discriminatedUnion("name", [
  landingViewedEventSchema,
  gameStartedEventSchema,
  resumeOfferedEventSchema,
  resumeStartedEventSchema,
  levelStartedEventSchema,
  promptValidationFailedEventSchema,
  promptSubmittedEventSchema,
  generationCompletedEventSchema,
  scoringCompletedEventSchema,
  attemptResolvedEventSchema,
  levelCompletedEventSchema,
  levelRestartedEventSchema,
  runCompletedEventSchema,
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventName = AnalyticsEvent["name"];

export interface AnalyticsEnvelope {
  anonymousPlayerId?: AnonymousPlayerId;
  runId?: GameRunId;
  levelId?: LevelId;
  attemptId?: AttemptId;
  occurredAt: IsoDateTime;
}

export interface ProviderTelemetry {
  provider: string;
  model: string;
  failureKind?: ProviderFailureKind;
  durationMs: number;
  success: boolean;
}

export function defineAnalyticsEvent<T extends AnalyticsEvent>(event: T) {
  return analyticsEventSchema.parse(event) as T;
}
