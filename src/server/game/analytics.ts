import { defineAnalyticsEvent, type AnalyticsEvent } from "@/lib/analytics";
import type { Level, LevelAttempt } from "@/lib/game";
import type { ProviderFailureKind } from "@/server/providers";

import type { GameSessionSnapshot, RecordAttemptResult } from "./session-state";

interface ResumeProgressAnalyticsInput {
  currentLevel: Level | null;
  occurredAt: string;
  session: GameSessionSnapshot | null;
}

interface PromptValidationAnalyticsInput {
  level: Level;
  occurredAt: string;
  promptLength: number;
  reason: "empty" | "over_limit";
  session: GameSessionSnapshot | null;
}

interface SubmitAttemptAnalyticsInput {
  attemptResult: RecordAttemptResult;
  level: Level;
  occurredAt: string;
  promptLength: number;
  totalDurationMs: number;
}

function mapProviderFailureKind(attempt: LevelAttempt): ProviderFailureKind | undefined {
  if (attempt.result.status === "content_policy_rejected") {
    return "content_policy_rejection";
  }

  if (attempt.result.status !== "technical_failure") {
    return undefined;
  }

  if (attempt.result.errorCode?.includes("timeout")) {
    return "timeout";
  }

  return "technical_failure";
}

function getLevelProgress(session: GameSessionSnapshot, levelId: string) {
  return session.progress.levels.find((levelProgress) => levelProgress.levelId === levelId) ?? null;
}

export function buildResumeProgressAnalyticsEvents(input: ResumeProgressAnalyticsInput) {
  const anonymousPlayerId = input.session?.progress.playerId;
  const events: AnalyticsEvent[] = [
    defineAnalyticsEvent({
      name: "landing_viewed",
      occurredAt: input.occurredAt,
      anonymousPlayerId,
    }),
  ];

  if (input.session?.progress.canResume && input.currentLevel) {
    events.push(
      defineAnalyticsEvent({
        name: "resume_offered",
        occurredAt: input.occurredAt,
        anonymousPlayerId,
        runId: input.session.progress.runId,
        currentLevelId: input.currentLevel.id,
        highestUnlockedLevelNumber: input.session.progress.highestUnlockedLevelNumber,
      }),
    );
  }

  return events;
}

export function buildPromptValidationFailedAnalyticsEvent(input: PromptValidationAnalyticsInput) {
  if (!input.session) {
    return null;
  }

  return defineAnalyticsEvent({
    name: "prompt_validation_failed",
    occurredAt: input.occurredAt,
    anonymousPlayerId: input.session.progress.playerId,
    runId: input.session.progress.runId,
    levelId: input.level.id,
    reason: input.reason,
    promptLength: input.promptLength,
  });
}

export function buildSubmitAttemptAnalyticsEvents(input: SubmitAttemptAnalyticsInput) {
  const { attemptResult, level, occurredAt, promptLength } = input;
  const { attempt, session, transition } = attemptResult;
  const anonymousPlayerId = session.progress.playerId;
  const totalDurationMs = Math.max(0, input.totalDurationMs);
  const generationDurationMs = attempt.result.status === "scored" ? Math.floor(totalDurationMs / 2) : totalDurationMs;
  const scoringDurationMs = totalDurationMs - generationDurationMs;
  const generation = attempt.generation;
  const failureKind = mapProviderFailureKind(attempt);
  const events: AnalyticsEvent[] = [
    defineAnalyticsEvent({
      name: "prompt_submitted",
      occurredAt,
      anonymousPlayerId,
      runId: session.progress.runId,
      levelId: attempt.levelId,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      promptLength,
    }),
    defineAnalyticsEvent({
      name: "generation_completed",
      occurredAt,
      anonymousPlayerId,
      runId: session.progress.runId,
      levelId: attempt.levelId,
      attemptId: attempt.id,
      provider: generation?.provider ?? "unknown",
      model: generation?.model ?? "unknown",
      durationMs: generationDurationMs,
      success: attempt.result.status === "scored",
      failureKind,
    }),
  ];

  if (attempt.result.status === "scored" && attempt.result.score) {
    events.push(
      defineAnalyticsEvent({
        name: "scoring_completed",
        occurredAt,
        anonymousPlayerId,
        runId: session.progress.runId,
        levelId: attempt.levelId,
        attemptId: attempt.id,
        provider: attempt.result.score.scorer.provider,
        model: attempt.result.score.scorer.model,
        durationMs: scoringDurationMs,
        success: true,
      }),
    );
    events.push(
      defineAnalyticsEvent({
        name: "attempt_resolved",
        occurredAt,
        anonymousPlayerId,
        runId: session.progress.runId,
        levelId: attempt.levelId,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        promptLength,
        threshold: attempt.result.score.threshold,
        score: attempt.result.score.normalized,
        passed: attempt.result.score.passed,
        attemptsRemaining: getLevelProgress(session, attempt.levelId)?.attemptsRemaining ?? 0,
        strongestAttemptScore: attempt.result.strongestAttemptScore ?? attempt.result.score.normalized,
        tipsShown: attempt.result.tipIds.length > 0,
        totalDurationMs,
      }),
    );
  }

  const levelProgress = getLevelProgress(session, level.id);
  const levelOutcome = transition === "failed" ? "failed" : transition === "passed" || transition === "completed" ? "passed" : null;

  if (levelOutcome && levelProgress?.bestScore != null) {
    events.push(
      defineAnalyticsEvent({
        name: "level_completed",
        occurredAt,
        anonymousPlayerId,
        runId: session.progress.runId,
        levelId: level.id,
        levelNumber: level.number,
        outcome: levelOutcome,
        attemptsUsed: levelProgress.attemptsUsed,
        bestScore: levelProgress.bestScore,
      }),
    );
  }

  if (transition === "completed") {
    events.push(
      defineAnalyticsEvent({
        name: "run_completed",
        occurredAt,
        anonymousPlayerId,
        runId: session.progress.runId,
        levelsCompleted: session.progress.levels.filter((levelProgress) => levelProgress.completedAt).length,
        totalAttemptsUsed: session.progress.totalAttemptsUsed,
      }),
    );
  }

  return events;
}
