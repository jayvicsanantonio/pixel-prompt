import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, type ScoreBreakdownDimension } from "@/lib/game";

const maxAttemptsSql = sql.raw(String(MAX_ATTEMPTS_PER_LEVEL));
const promptCharacterLimitSql = sql.raw(String(PROMPT_CHARACTER_LIMIT));

const runStatusValues = ["active", "completed", "abandoned"] as const;
const levelStatusValues = ["locked", "unlocked", "in_progress", "passed", "failed"] as const;
const attemptLifecycleStatusValues = [
  "draft",
  "submitted",
  "generating",
  "scoring",
  "scored",
  "content_policy_rejected",
  "technical_failure",
] as const;
const attemptOutcomeValues = ["passed", "failed", "rejected", "error"] as const;
const providerFailureKindValues = [
  "content_policy_rejection",
  "rate_limited",
  "timeout",
  "interrupted",
  "technical_failure",
  "asset_unavailable",
] as const;

export const runStatusEnum = pgEnum("run_status", runStatusValues);
export const levelStatusEnum = pgEnum("level_status", levelStatusValues);
export const attemptLifecycleStatusEnum = pgEnum("attempt_lifecycle_status", attemptLifecycleStatusValues);
export const attemptOutcomeEnum = pgEnum("attempt_outcome", attemptOutcomeValues);
export const providerFailureKindEnum = pgEnum("provider_failure_kind", providerFailureKindValues);

export const anonymousPlayers = pgTable(
  "anonymous_players",
  {
    id: text("id").primaryKey(),
    sessionTokenHash: text("session_token_hash").notNull(),
    sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("anonymous_players_session_token_hash_unique").on(table.sessionTokenHash),
    index("anonymous_players_last_active_at_idx").on(table.lastActiveAt),
  ],
);

export const gameRuns = pgTable(
  "game_runs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => anonymousPlayers.id, { onDelete: "cascade" }),
    status: runStatusEnum("status").notNull().default("active"),
    currentLevelId: text("current_level_id"),
    currentLevelNumber: integer("current_level_number"),
    highestUnlockedLevelNumber: integer("highest_unlocked_level_number").notNull().default(1),
    highestCompletedLevelNumber: integer("highest_completed_level_number").notNull().default(0),
    totalAttemptsUsed: integer("total_attempts_used").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("game_runs_player_status_idx").on(table.playerId, table.status),
    check("game_runs_current_level_number_check", sql`${table.currentLevelNumber} is null or ${table.currentLevelNumber} >= 1`),
    check("game_runs_highest_unlocked_level_number_check", sql`${table.highestUnlockedLevelNumber} >= 1`),
    check("game_runs_highest_completed_level_number_check", sql`${table.highestCompletedLevelNumber} >= 0`),
    check(
      "game_runs_completed_not_ahead_of_unlock_check",
      sql`${table.highestCompletedLevelNumber} <= ${table.highestUnlockedLevelNumber}`,
    ),
    check("game_runs_total_attempts_used_check", sql`${table.totalAttemptsUsed} >= 0`),
  ],
);

export const runLevelProgress = pgTable(
  "run_level_progress",
  {
    runId: text("run_id")
      .notNull()
      .references(() => gameRuns.id, { onDelete: "cascade" }),
    levelId: text("level_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    status: levelStatusEnum("status").notNull().default("locked"),
    currentAttemptCycle: integer("current_attempt_cycle").notNull().default(1),
    attemptsUsedInCycle: integer("attempts_used_in_cycle").notNull().default(0),
    bestScore: numeric("best_score", { precision: 5, scale: 2, mode: "number" }),
    strongestAttemptId: text("strongest_attempt_id"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    firstCompletedAt: timestamp("first_completed_at", { withTimezone: true }),
    lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.levelId], name: "run_level_progress_pk" }),
    unique("run_level_progress_run_level_number_unique").on(table.runId, table.levelNumber),
    index("run_level_progress_status_idx").on(table.runId, table.status),
    check("run_level_progress_level_number_check", sql`${table.levelNumber} >= 1`),
    check("run_level_progress_current_attempt_cycle_check", sql`${table.currentAttemptCycle} >= 1`),
    check(
      "run_level_progress_attempts_used_in_cycle_check",
      sql`${table.attemptsUsedInCycle} >= 0 and ${table.attemptsUsedInCycle} <= ${maxAttemptsSql}`,
    ),
    check(
      "run_level_progress_best_score_range_check",
      sql`${table.bestScore} is null or (${table.bestScore} >= 0 and ${table.bestScore} <= 100)`,
    ),
  ],
);

export const levelAttempts = pgTable(
  "level_attempts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => gameRuns.id, { onDelete: "cascade" }),
    levelId: text("level_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    attemptCycle: integer("attempt_cycle").notNull().default(1),
    attemptNumber: integer("attempt_number").notNull(),
    promptText: text("prompt_text").notNull(),
    promptCharacterCount: integer("prompt_character_count").notNull(),
    targetImageAssetKey: text("target_image_asset_key").notNull(),
    lifecycleStatus: attemptLifecycleStatusEnum("lifecycle_status").notNull().default("draft"),
    outcome: attemptOutcomeEnum("outcome"),
    consumedAttempt: boolean("consumed_attempt").notNull().default(false),
    generationProvider: text("generation_provider"),
    generationModel: text("generation_model"),
    generationModelVersion: text("generation_model_version"),
    generatedImageAssetKey: text("generated_image_asset_key"),
    generationSeed: text("generation_seed"),
    revisedPrompt: text("revised_prompt"),
    generationCreatedAt: timestamp("generation_created_at", { withTimezone: true }),
    scoreRaw: numeric("score_raw", { precision: 8, scale: 6, mode: "number" }),
    scoreNormalized: numeric("score_normalized", { precision: 5, scale: 2, mode: "number" }),
    scoreThreshold: numeric("score_threshold", { precision: 5, scale: 2, mode: "number" }),
    scorePassed: boolean("score_passed"),
    scoreBreakdown: jsonb("score_breakdown").$type<Partial<Record<ScoreBreakdownDimension, number>>>(),
    scoringProvider: text("scoring_provider"),
    scoringModel: text("scoring_model"),
    scoringModelVersion: text("scoring_model_version"),
    scoringReasoning: text("scoring_reasoning"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    tipIds: jsonb("tip_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    providerFailureKind: providerFailureKindEnum("provider_failure_kind"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("level_attempts_run_level_cycle_attempt_unique").on(
      table.runId,
      table.levelId,
      table.attemptCycle,
      table.attemptNumber,
    ),
    index("level_attempts_run_level_created_at_idx").on(table.runId, table.levelId, table.createdAt),
    index("level_attempts_level_cycle_idx").on(table.runId, table.levelId, table.attemptCycle),
    check("level_attempts_level_number_check", sql`${table.levelNumber} >= 1`),
    check("level_attempts_attempt_cycle_check", sql`${table.attemptCycle} >= 1`),
    check(
      "level_attempts_attempt_number_check",
      sql`${table.attemptNumber} >= 1`,
    ),
    check(
      "level_attempts_prompt_character_count_check",
      sql`${table.promptCharacterCount} >= 1 and ${table.promptCharacterCount} <= ${promptCharacterLimitSql}`,
    ),
    check(
      "level_attempts_prompt_length_matches_count_check",
      sql`char_length(${table.promptText}) = ${table.promptCharacterCount}`,
    ),
    check(
      "level_attempts_score_raw_range_check",
      sql`${table.scoreRaw} is null or (${table.scoreRaw} >= 0 and ${table.scoreRaw} <= 1)`,
    ),
    check(
      "level_attempts_score_normalized_range_check",
      sql`${table.scoreNormalized} is null or (${table.scoreNormalized} >= 0 and ${table.scoreNormalized} <= 100)`,
    ),
    check(
      "level_attempts_score_threshold_range_check",
      sql`${table.scoreThreshold} is null or (${table.scoreThreshold} >= 0 and ${table.scoreThreshold} <= 100)`,
    ),
  ],
);

export const schema = {
  anonymousPlayers,
  gameRuns,
  runLevelProgress,
  levelAttempts,
};

export type AnonymousPlayerRecord = typeof anonymousPlayers.$inferSelect;
export type NewAnonymousPlayerRecord = typeof anonymousPlayers.$inferInsert;
export type GameRunRecord = typeof gameRuns.$inferSelect;
export type NewGameRunRecord = typeof gameRuns.$inferInsert;
export type RunLevelProgressRecord = typeof runLevelProgress.$inferSelect;
export type NewRunLevelProgressRecord = typeof runLevelProgress.$inferInsert;
export type LevelAttemptRecord = typeof levelAttempts.$inferSelect;
export type NewLevelAttemptRecord = typeof levelAttempts.$inferInsert;
