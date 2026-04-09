import { levels, uiCopy } from "@/content";
import type { ActiveLevelScreenState } from "@/lib/game";
import { buildProgressOverview } from "@/lib/game/screen-state";

interface MockActiveLevelStateOptions {
  levelNumber?: number;
  resume?: boolean;
  attemptsUsed?: number;
}

const mockResultPreviewByLevel = {
  1: {
    generatedImageAlt: "A mock generated still life with warm fruit tones, a glass bottle, and softer edges than the target.",
    score: {
      raw: 0.684,
      normalized: 68.4,
      threshold: 50,
      passed: true,
      breakdown: {
        subject: 74,
        materials: 66,
        composition: 62,
      },
      scorer: {
        provider: "openai",
        model: "gpt-5.4-mini",
      },
    },
    summary: "The submitted prompt captured the still-life setup and warm lighting, but the generated composition drifted a bit looser than the target.",
  },
  2: {
    generatedImageAlt: "A mock generated neon portrait with a wetter street reflection and stronger pink lighting than the target.",
    score: {
      raw: 0.574,
      normalized: 57.4,
      threshold: 60,
      passed: false,
      breakdown: {
        subject: 68,
        style: 61,
        context: 49,
      },
      scorer: {
        provider: "openai",
        model: "gpt-5.4-mini",
      },
    },
    summary: "The portrait mood is close, but the alley context and composition still need tighter control to clear the threshold.",
  },
  3: {
    generatedImageAlt: "A mock generated courtyard with warm stone arches and a slightly flatter perspective than the target.",
    score: {
      raw: 0.781,
      normalized: 78.1,
      threshold: 70,
      passed: true,
      breakdown: {
        composition: 73,
        context: 79,
        time_period: 76,
      },
      scorer: {
        provider: "openai",
        model: "gpt-5.4-mini",
      },
    },
    summary: "The architecture, warm stone palette, and era cues are strong enough to pass even with some perspective softness.",
  },
} as const;

const mockFailurePreviewByLevel = {
  1: {
    strongestAttemptScore: 68,
    summary: "Your best try already found the warm studio still life. On the restart, tighten the object spacing and composition.",
  },
  2: {
    strongestAttemptScore: 59,
    summary: "Your best try found the mood. On the restart, lock the alley setting and framing in sooner.",
  },
  3: {
    strongestAttemptScore: 69,
    summary: "Your best try nearly passed. On the restart, pin down the arch rhythm and era details.",
  },
} as const;

const mockSummaryMetricsByLevelNumber = {
  1: {
    bestScore: 68,
    attemptsUsed: 1,
  },
  2: {
    bestScore: 63,
    attemptsUsed: 2,
  },
  3: {
    bestScore: 78,
    attemptsUsed: 1,
  },
} as const;

function getMockSummaryPreview() {
  const bestScores = levels.map((currentLevel, index) => {
    const metrics = mockSummaryMetricsByLevelNumber[
      currentLevel.number as keyof typeof mockSummaryMetricsByLevelNumber
    ] ?? {
      bestScore: Math.min(100, currentLevel.threshold + 8 + index * 4),
      attemptsUsed: 1,
    };

    return {
      levelId: currentLevel.id,
      levelNumber: currentLevel.number,
      levelTitle: currentLevel.title,
      bestScore: metrics.bestScore,
      attemptsUsed: metrics.attemptsUsed,
      replayHref: `/play?level=${currentLevel.number}`,
    };
  });
  const totalAttemptsUsed = bestScores.reduce((total, levelSummary) => total + levelSummary.attemptsUsed, 0);
  const firstCompletedLevel = bestScores[0];
  const lastCompletedLevel = bestScores[bestScores.length - 1];
  const improvementDelta =
    firstCompletedLevel && lastCompletedLevel ? lastCompletedLevel.bestScore - firstCompletedLevel.bestScore : 0;
  const improvementSummary = uiCopy.gameplay.summary.buildImprovementSummary(
    improvementDelta,
    firstCompletedLevel?.levelTitle ?? null,
    lastCompletedLevel?.levelTitle ?? null,
    bestScores.length,
  );

  return {
    levelsCompleted: bestScores.length,
    totalAttemptsUsed,
    bestScores,
    improvementDelta,
    improvementSummary,
    encouragement: uiCopy.gameplay.summary.encouragement,
  };
}

export function getMockActiveLevelState(options?: MockActiveLevelStateOptions): ActiveLevelScreenState {
  const level = levels.find((candidate) => candidate.number === options?.levelNumber) ?? levels[0];

  if (!level) {
    throw new Error("No levels available to build active level state.");
  }

  const attemptsUsed = Math.min(options?.attemptsUsed ?? (options?.resume ? 1 : 0), level.maxAttempts);
  const attemptsRemaining = Math.max(level.maxAttempts - attemptsUsed, 0);
  const nextLevel = levels.find((candidate) => candidate.number === level.number + 1) ?? null;
  const resultPreview = mockResultPreviewByLevel[level.number as keyof typeof mockResultPreviewByLevel];
  const failurePreview = mockFailurePreviewByLevel[level.number as keyof typeof mockFailurePreviewByLevel];
  const continuation = {
    attemptsRemainingAfterResult: Math.max(attemptsRemaining - 1, 0),
    nextLevelHref: nextLevel ? `/play?level=${nextLevel.number}` : null,
    nextLevelNumber: nextLevel?.number ?? null,
    nextLevelTitle: nextLevel?.title ?? null,
    restartLevelHref: `/play?level=${level.number}`,
  };
  const summaryPreview = getMockSummaryPreview();

  if (options?.resume) {
    return {
      level,
      attemptsUsed,
      attemptsRemaining,
      promptDraft: "cinematic neon portrait in a wet alley at midnight",
      analytics: {
        anonymousPlayerId: "player-mock",
        runId: "run-mock",
      },
      progressOverview: buildProgressOverview({
        progress: {
          playerId: "player-mock",
          runId: "run-mock",
          currentLevelId: level.id,
          highestUnlockedLevelNumber: level.number,
          totalAttemptsUsed: attemptsUsed,
          canResume: true,
          lastActiveAt: "2026-04-07T08:00:00.000Z",
          levels: levels.map((currentLevel) => {
            const isPastLevel = currentLevel.number < level.number;
            const isCurrentLevel = currentLevel.id === level.id;
            const isFailedLevel = isCurrentLevel && attemptsUsed >= currentLevel.maxAttempts;

            return {
              levelId: currentLevel.id,
              status: isPastLevel ? "passed" : isFailedLevel ? "failed" : isCurrentLevel ? "in_progress" : "locked",
              currentAttemptCycle: 1,
              attemptsUsed: isCurrentLevel ? attemptsUsed : isPastLevel ? 1 : 0,
              attemptsRemaining: isCurrentLevel ? attemptsRemaining : isPastLevel ? currentLevel.maxAttempts - 1 : currentLevel.maxAttempts,
              bestScore:
                currentLevel.number === 1
                  ? 68
                  : currentLevel.number === 2 && level.number >= 2
                    ? 59
                    : isPastLevel
                      ? currentLevel.threshold + 8
                      : null,
              strongestAttemptId: null,
              unlockedAt: isPastLevel || isCurrentLevel ? "2026-04-07T08:00:00.000Z" : null,
              completedAt: isPastLevel ? "2026-04-07T08:00:00.000Z" : null,
              lastCompletedAt: isPastLevel ? "2026-04-07T08:00:00.000Z" : null,
              lastAttemptedAt: isPastLevel || isCurrentLevel ? "2026-04-07T08:00:00.000Z" : null,
            };
          }),
        },
        currentLevel: level,
      }),
      resultPreview,
      continuation,
      failurePreview,
      summaryPreview,
    };
  }

  return {
    level,
    attemptsUsed,
    attemptsRemaining,
    promptDraft: "",
    analytics: {
      anonymousPlayerId: "player-mock",
      runId: "run-mock",
    },
    progressOverview: buildProgressOverview({
      progress: {
        playerId: "player-mock",
        runId: "run-mock",
        currentLevelId: level.id,
        highestUnlockedLevelNumber: level.number,
        totalAttemptsUsed: attemptsUsed,
        canResume: options?.resume ?? false,
        lastActiveAt: "2026-04-07T08:00:00.000Z",
        levels: levels.map((currentLevel) => {
          const isPastLevel = currentLevel.number < level.number;
          const isCurrentLevel = currentLevel.id === level.id;

          return {
            levelId: currentLevel.id,
            status: isPastLevel ? "passed" : isCurrentLevel ? "in_progress" : "locked",
            currentAttemptCycle: 1,
            attemptsUsed: isCurrentLevel ? attemptsUsed : isPastLevel ? 1 : 0,
            attemptsRemaining: isCurrentLevel ? attemptsRemaining : isPastLevel ? currentLevel.maxAttempts - 1 : currentLevel.maxAttempts,
            bestScore: isPastLevel ? currentLevel.threshold + 8 : null,
            strongestAttemptId: null,
            unlockedAt: isPastLevel || isCurrentLevel ? "2026-04-07T08:00:00.000Z" : null,
            completedAt: isPastLevel ? "2026-04-07T08:00:00.000Z" : null,
            lastCompletedAt: isPastLevel ? "2026-04-07T08:00:00.000Z" : null,
            lastAttemptedAt: isCurrentLevel ? "2026-04-07T08:00:00.000Z" : isPastLevel ? "2026-04-07T08:00:00.000Z" : null,
          };
        }),
      },
      currentLevel: level,
    }),
    resultPreview,
    continuation,
    failurePreview,
    summaryPreview,
  };
}
