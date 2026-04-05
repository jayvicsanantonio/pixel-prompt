CREATE TYPE "public"."attempt_lifecycle_status" AS ENUM('draft', 'submitted', 'generating', 'scoring', 'scored', 'content_policy_rejected', 'technical_failure');--> statement-breakpoint
CREATE TYPE "public"."attempt_outcome" AS ENUM('passed', 'failed', 'rejected', 'error');--> statement-breakpoint
CREATE TYPE "public"."level_status" AS ENUM('locked', 'unlocked', 'in_progress', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provider_failure_kind" AS ENUM('content_policy_rejection', 'rate_limited', 'timeout', 'interrupted', 'technical_failure', 'asset_unavailable');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "anonymous_players" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token_hash" text NOT NULL,
	"session_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anonymous_players_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE "game_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"current_level_id" text,
	"current_level_number" integer,
	"highest_unlocked_level_number" integer DEFAULT 1 NOT NULL,
	"highest_completed_level_number" integer DEFAULT 0 NOT NULL,
	"total_attempts_used" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "game_runs_current_level_number_check" CHECK ("game_runs"."current_level_number" is null or "game_runs"."current_level_number" >= 1),
	CONSTRAINT "game_runs_highest_unlocked_level_number_check" CHECK ("game_runs"."highest_unlocked_level_number" >= 1),
	CONSTRAINT "game_runs_highest_completed_level_number_check" CHECK ("game_runs"."highest_completed_level_number" >= 0),
	CONSTRAINT "game_runs_completed_not_ahead_of_unlock_check" CHECK ("game_runs"."highest_completed_level_number" <= "game_runs"."highest_unlocked_level_number"),
	CONSTRAINT "game_runs_total_attempts_used_check" CHECK ("game_runs"."total_attempts_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "level_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"level_id" text NOT NULL,
	"level_number" integer NOT NULL,
	"attempt_cycle" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer NOT NULL,
	"prompt_text" text NOT NULL,
	"prompt_character_count" integer NOT NULL,
	"target_image_asset_key" text NOT NULL,
	"lifecycle_status" "attempt_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"outcome" "attempt_outcome",
	"consumed_attempt" boolean DEFAULT false NOT NULL,
	"generation_provider" text,
	"generation_model" text,
	"generation_model_version" text,
	"generated_image_asset_key" text,
	"generation_seed" text,
	"revised_prompt" text,
	"generation_created_at" timestamp with time zone,
	"score_raw" numeric(8, 6),
	"score_normalized" numeric(5, 2),
	"score_threshold" numeric(5, 2),
	"score_passed" boolean,
	"score_breakdown" jsonb,
	"scoring_provider" text,
	"scoring_model" text,
	"scoring_model_version" text,
	"scoring_reasoning" text,
	"scored_at" timestamp with time zone,
	"tip_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_failure_kind" "provider_failure_kind",
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_attempts_run_level_cycle_attempt_unique" UNIQUE("run_id","level_id","attempt_cycle","attempt_number"),
	CONSTRAINT "level_attempts_level_number_check" CHECK ("level_attempts"."level_number" >= 1),
	CONSTRAINT "level_attempts_attempt_cycle_check" CHECK ("level_attempts"."attempt_cycle" >= 1),
	CONSTRAINT "level_attempts_attempt_number_check" CHECK ("level_attempts"."attempt_number" >= 1),
	CONSTRAINT "level_attempts_prompt_character_count_check" CHECK ("level_attempts"."prompt_character_count" >= 1 and "level_attempts"."prompt_character_count" <= 120),
	CONSTRAINT "level_attempts_prompt_length_matches_count_check" CHECK (char_length("level_attempts"."prompt_text") = "level_attempts"."prompt_character_count"),
	CONSTRAINT "level_attempts_score_raw_range_check" CHECK ("level_attempts"."score_raw" is null or ("level_attempts"."score_raw" >= 0 and "level_attempts"."score_raw" <= 1)),
	CONSTRAINT "level_attempts_score_normalized_range_check" CHECK ("level_attempts"."score_normalized" is null or ("level_attempts"."score_normalized" >= 0 and "level_attempts"."score_normalized" <= 100)),
	CONSTRAINT "level_attempts_score_threshold_range_check" CHECK ("level_attempts"."score_threshold" is null or ("level_attempts"."score_threshold" >= 0 and "level_attempts"."score_threshold" <= 100))
);
--> statement-breakpoint
CREATE TABLE "run_level_progress" (
	"run_id" text NOT NULL,
	"level_id" text NOT NULL,
	"level_number" integer NOT NULL,
	"status" "level_status" DEFAULT 'locked' NOT NULL,
	"current_attempt_cycle" integer DEFAULT 1 NOT NULL,
	"attempts_used_in_cycle" integer DEFAULT 0 NOT NULL,
	"best_score" numeric(5, 2),
	"strongest_attempt_id" text,
	"unlocked_at" timestamp with time zone,
	"first_completed_at" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_level_progress_pk" PRIMARY KEY("run_id","level_id"),
	CONSTRAINT "run_level_progress_run_level_number_unique" UNIQUE("run_id","level_number"),
	CONSTRAINT "run_level_progress_level_number_check" CHECK ("run_level_progress"."level_number" >= 1),
	CONSTRAINT "run_level_progress_current_attempt_cycle_check" CHECK ("run_level_progress"."current_attempt_cycle" >= 1),
	CONSTRAINT "run_level_progress_attempts_used_in_cycle_check" CHECK ("run_level_progress"."attempts_used_in_cycle" >= 0 and "run_level_progress"."attempts_used_in_cycle" <= 3),
	CONSTRAINT "run_level_progress_best_score_range_check" CHECK ("run_level_progress"."best_score" is null or ("run_level_progress"."best_score" >= 0 and "run_level_progress"."best_score" <= 100))
);
--> statement-breakpoint
ALTER TABLE "game_runs" ADD CONSTRAINT "game_runs_player_id_anonymous_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."anonymous_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_run_id_game_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."game_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_level_progress" ADD CONSTRAINT "run_level_progress_run_id_game_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."game_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anonymous_players_last_active_at_idx" ON "anonymous_players" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "game_runs_player_status_idx" ON "game_runs" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "level_attempts_run_level_created_at_idx" ON "level_attempts" USING btree ("run_id","level_id","created_at");--> statement-breakpoint
CREATE INDEX "level_attempts_level_cycle_idx" ON "level_attempts" USING btree ("run_id","level_id","attempt_cycle");--> statement-breakpoint
CREATE INDEX "run_level_progress_status_idx" ON "run_level_progress" USING btree ("run_id","status");
