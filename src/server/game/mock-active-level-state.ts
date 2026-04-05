import { levels } from "@/content";
import type { ActiveLevelScreenState } from "@/lib/game";

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
    summary: "The closest attempt already landed the warm studio still-life setup. A restart should focus on tighter object spacing and cleaner composition.",
  },
  2: {
    strongestAttemptScore: 59,
    summary: "The best attempt got close on mood, but the alley context and framing stayed too loose to pass. Restarting should sharpen those scene cues earlier.",
  },
  3: {
    strongestAttemptScore: 69,
    summary: "The strongest attempt nearly cleared the threshold, but the architectural composition still drifted. A restart should lock in the arch rhythm and era detail.",
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
  const improvementSummary =
    bestScores.length > 1 && firstCompletedLevel && lastCompletedLevel
      ? `You finished ${Math.abs(improvementDelta)} points ${
          improvementDelta >= 0 ? "stronger" : "lower"
        } on ${lastCompletedLevel.levelTitle} than on ${firstCompletedLevel.levelTitle}.`
      : "You cleared the opening run. Replay the level to sharpen the score even further.";

  return {
    levelsCompleted: bestScores.length,
    totalAttemptsUsed,
    bestScores,
    improvementDelta,
    improvementSummary,
    encouragement: "Replay a cleared level now, or come back when the next content pack lands.",
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
    resultPreview,
    continuation,
    failurePreview,
    summaryPreview,
  };
}
