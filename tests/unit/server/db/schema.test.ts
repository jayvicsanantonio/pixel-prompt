import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  anonymousPlayers,
  attemptLifecycleStatusEnum,
  attemptOutcomeEnum,
  gameRuns,
  levelAttempts,
  levelStatusEnum,
  providerFailureKindEnum,
  runLevelProgress,
  runStatusEnum,
  schema,
} from "@/server/db/schema";

describe("database schema", () => {
  it("tracks anonymous browser identities with hashed session tokens", () => {
    const columns = getTableColumns(anonymousPlayers);
    const config = getTableConfig(anonymousPlayers);

    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining(["id", "sessionTokenHash", "sessionExpiresAt", "createdAt", "lastActiveAt"]),
    );
    expect(config.uniqueConstraints.map((constraint) => constraint.getName())).toContain(
      "anonymous_players_session_token_hash_unique",
    );
  });

  it("stores run-level progression fields needed for resume and replay safety", () => {
    const columns = getTableColumns(gameRuns);
    const config = getTableConfig(gameRuns);

    expect(runStatusEnum.enumValues).toEqual(["active", "completed", "abandoned"]);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "playerId",
        "status",
        "currentLevelId",
        "currentLevelNumber",
        "highestUnlockedLevelNumber",
        "highestCompletedLevelNumber",
        "totalAttemptsUsed",
        "startedAt",
        "lastActiveAt",
        "completedAt",
      ]),
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "game_runs_current_level_number_check",
        "game_runs_highest_unlocked_level_number_check",
        "game_runs_highest_completed_level_number_check",
        "game_runs_completed_not_ahead_of_unlock_check",
        "game_runs_total_attempts_used_check",
      ]),
    );
  });

  it("keeps per-level progress separate from historical attempts", () => {
    const columns = getTableColumns(runLevelProgress);
    const config = getTableConfig(runLevelProgress);

    expect(levelStatusEnum.enumValues).toEqual(["locked", "unlocked", "in_progress", "passed", "failed"]);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "runId",
        "levelId",
        "levelNumber",
        "status",
        "currentAttemptCycle",
        "attemptsUsedInCycle",
        "bestScore",
        "strongestAttemptId",
        "unlockedAt",
        "firstCompletedAt",
        "lastCompletedAt",
        "lastAttemptedAt",
      ]),
    );
    expect(config.primaryKeys.map((key) => key.getName())).toContain("run_level_progress_pk");
    expect(config.uniqueConstraints.map((constraint) => constraint.getName())).toContain(
      "run_level_progress_run_level_number_unique",
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "run_level_progress_level_number_check",
        "run_level_progress_current_attempt_cycle_check",
        "run_level_progress_attempts_used_in_cycle_check",
        "run_level_progress_best_score_range_check",
      ]),
    );
  });

  it("persists prompts, generation metadata, score data, and recoverable failures per attempt", () => {
    const columns = getTableColumns(levelAttempts);
    const config = getTableConfig(levelAttempts);

    expect(attemptLifecycleStatusEnum.enumValues).toEqual([
      "draft",
      "submitted",
      "generating",
      "scoring",
      "scored",
      "content_policy_rejected",
      "technical_failure",
    ]);
    expect(attemptOutcomeEnum.enumValues).toEqual(["passed", "failed", "rejected", "error"]);
    expect(providerFailureKindEnum.enumValues).toEqual([
      "content_policy_rejection",
      "rate_limited",
      "timeout",
      "interrupted",
      "technical_failure",
      "asset_unavailable",
    ]);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "id",
        "runId",
        "levelId",
        "levelNumber",
        "attemptCycle",
        "attemptNumber",
        "promptText",
        "promptCharacterCount",
        "targetImageAssetKey",
        "lifecycleStatus",
        "outcome",
        "consumedAttempt",
        "generationProvider",
        "generationModel",
        "generationModelVersion",
        "generatedImageAssetKey",
        "generationSeed",
        "revisedPrompt",
        "generationCreatedAt",
        "scoreRaw",
        "scoreNormalized",
        "scoreThreshold",
        "scorePassed",
        "scoreBreakdown",
        "scoringProvider",
        "scoringModel",
        "scoringModelVersion",
        "scoringReasoning",
        "scoredAt",
        "tipIds",
        "providerFailureKind",
        "errorCode",
        "errorMessage",
      ]),
    );
    expect(config.uniqueConstraints.map((constraint) => constraint.getName())).toContain(
      "level_attempts_run_level_cycle_attempt_unique",
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "level_attempts_level_number_check",
        "level_attempts_attempt_cycle_check",
        "level_attempts_attempt_number_check",
        "level_attempts_prompt_character_count_check",
        "level_attempts_prompt_length_matches_count_check",
        "level_attempts_score_raw_range_check",
        "level_attempts_score_normalized_range_check",
        "level_attempts_score_threshold_range_check",
      ]),
    );
  });

  it("exports the persistence tables through the shared schema object", () => {
    expect(schema).toMatchObject({
      anonymousPlayers,
      gameRuns,
      runLevelProgress,
      levelAttempts,
    });
  });
});
