import { levels, tipRules, uiCopy } from "@/content";
import type {
  ActiveLevelContinuationPreview,
  ActiveLevelFailurePreview,
  ActiveLevelResultPreview,
  ActiveLevelSummaryPreview,
} from "./active-level";
import type { AttemptScore, GameProgress, Level, LevelAttempt } from "./types";

const tipRuleBodies = new Map(tipRules.map((tipRule) => [tipRule.id, tipRule.body]));

export function findLevelProgress(progress: GameProgress, levelId: string) {
  return progress.levels.find((levelProgress) => levelProgress.levelId === levelId) ?? null;
}

export function getFirstTipBody(tipIds: string[]) {
  for (const tipId of tipIds) {
    const body = tipRuleBodies.get(tipId);

    if (body) {
      return body;
    }
  }

  return null;
}

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

export function buildResultPreview(level: Level, attempt: LevelAttempt | null): ActiveLevelResultPreview {
  const score = attempt?.result.score ?? buildEmptyAttemptScore(level);

  return {
    generatedImageAlt: uiCopy.gameplay.result.generatedImageAlt(attempt?.promptText ?? level.title),
    score,
    summary:
      attempt?.result.score != null
        ? getFirstTipBody(attempt.result.tipIds) ??
          uiCopy.gameplay.result.buildResolvedSummary(Math.round(attempt.result.score.normalized), level.threshold, attempt.result.score.passed)
        : uiCopy.gameplay.result.scoreUnavailable,
  };
}

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
  const completedLevels = levelSummaries.filter((levelSummary) => levelSummary.bestScore > 0);
  const firstCompletedLevel = completedLevels[0] ?? null;
  const lastCompletedLevel = completedLevels[completedLevels.length - 1] ?? null;
  const improvementDelta =
    firstCompletedLevel && lastCompletedLevel ? lastCompletedLevel.bestScore - firstCompletedLevel.bestScore : 0;

  return {
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
