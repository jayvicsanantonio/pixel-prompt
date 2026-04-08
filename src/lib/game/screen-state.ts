import { levels, tipRules, uiCopy } from "@/content";
import type {
  ActiveLevelContinuationPreview,
  ActiveLevelFailurePreview,
  ActiveLevelResultPreview,
  ActiveLevelSummaryPreview,
} from "./active-level";
import type { AttemptScore, GameProgress, Level, LevelAttempt } from "./types";

const tipRuleBodies = new Map(tipRules.map((tipRule) => [tipRule.id, tipRule.body]));

/** Returns persisted progress for a single level when a live run exists. */
export function findLevelProgress(progress: GameProgress, levelId: string) {
  return progress.levels.find((levelProgress) => levelProgress.levelId === levelId) ?? null;
}

/** Maps tip ids to the first player-facing tip body available for the attempt. */
export function getFirstTipBody(tipIds: string[]) {
  for (const tipId of tipIds) {
    const body = tipRuleBodies.get(tipId);

    if (body) {
      return body;
    }
  }

  return null;
}

/** Provides a safe placeholder score shape when bootstrap state has no scored attempt yet. */
export function buildEmptyAttemptScore(level: Level): AttemptScore {
  return {
    raw: 0,
    normalized: 0,
    threshold: level.threshold,
    passed: false,
    breakdown: {},
    scorer: {
      provider: "bootstrap",
      model: "unavailable",
    },
  };
}

/** Builds the result card state from the most relevant attempt for the level. */
export function buildResultPreview(level: Level, attempt: LevelAttempt | null): ActiveLevelResultPreview {
  const score = attempt?.result.score ?? buildEmptyAttemptScore(level);

  return {
    generatedImageAlt: uiCopy.gameplay.result.generatedImageAlt(attempt?.promptText ?? level.title),
    score,
    summary:
      attempt?.result.score != null
        ? getFirstTipBody(attempt.result.tipIds) ??
          uiCopy.gameplay.result.buildResolvedSummary(
            Math.floor(attempt.result.score.normalized),
            level.threshold,
            attempt.result.score.passed,
          )
        : uiCopy.gameplay.result.scoreUnavailable,
  };
}

/** Builds the next-step links and attempt counts for result, replay, and restart actions. */
export function buildContinuationPreview(level: Level, attemptsRemainingAfterResult: number): ActiveLevelContinuationPreview {
  const nextLevel = levels.find((candidate) => candidate.number === level.number + 1) ?? null;

  return {
    attemptsRemainingAfterResult,
    nextLevelHref: nextLevel ? `/play?level=${nextLevel.number}` : null,
    nextLevelNumber: nextLevel?.number ?? null,
    nextLevelTitle: nextLevel?.title ?? null,
    restartLevelHref: `/play?level=${level.number}`,
  };
}

/** Builds the strongest-attempt messaging for failed or exhausted levels. */
export function buildFailurePreview(input: {
  level: Level;
  attempt: LevelAttempt | null;
  progress: GameProgress | null;
}): ActiveLevelFailurePreview {
  const tipBody = input.attempt ? getFirstTipBody(input.attempt.result.tipIds) : null;
  const levelProgress = input.progress ? findLevelProgress(input.progress, input.level.id) : null;
  const strongestAttemptScore = input.attempt?.result.strongestAttemptScore ?? levelProgress?.bestScore ?? 0;

  return {
    strongestAttemptScore,
    summary: tipBody ?? uiCopy.gameplay.failure.buildFallbackSummary(strongestAttemptScore, input.level.number),
  };
}

/** Builds the final summary metrics from saved run progress and per-level best scores. */
export function buildSummaryPreview(progress: GameProgress | null): ActiveLevelSummaryPreview {
  const levelSummaries = levels.map((level) => {
    const levelProgress = progress ? findLevelProgress(progress, level.id) : null;

    return {
      levelId: level.id,
      levelNumber: level.number,
      levelTitle: level.title,
      bestScore: levelProgress?.bestScore ?? 0,
      attemptsUsed: levelProgress?.attemptsUsed ?? 0,
      replayHref: `/play?level=${level.number}`,
    };
  });
  // Any level with a recorded score can contribute to the improvement trend, even if it was never fully cleared.
  const completedLevels = levelSummaries.filter((levelSummary) => levelSummary.bestScore > 0);
  const firstCompletedLevel = completedLevels[0] ?? null;
  const lastCompletedLevel = completedLevels[completedLevels.length - 1] ?? null;
  const improvementDelta =
    firstCompletedLevel && lastCompletedLevel ? lastCompletedLevel.bestScore - firstCompletedLevel.bestScore : 0;

  return {
    // Cleared levels are stricter: they only count once the run marks them passed with completedAt.
    levelsCompleted: progress?.levels.filter((levelProgress) => levelProgress.completedAt != null).length ?? 0,
    totalAttemptsUsed: progress?.totalAttemptsUsed ?? 0,
    bestScores: levelSummaries,
    improvementDelta,
    improvementSummary: uiCopy.gameplay.summary.buildImprovementSummary(
      improvementDelta,
      firstCompletedLevel?.levelTitle ?? null,
      lastCompletedLevel?.levelTitle ?? null,
      completedLevels.length,
    ),
    encouragement: uiCopy.gameplay.summary.encouragement,
  };
}
