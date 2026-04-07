import { levels as defaultLevels, uiCopy } from "@/content";
import type {
  AnonymousPlayerId,
  AttemptGenerationDetails,
  AttemptId,
  AttemptResult,
  GameProgress,
  GameRunId,
  LandingExperienceState,
  Level,
  LevelAttempt,
  LevelId,
  LevelProgress,
} from "@/lib/game";
import { selectRetryTipIds } from "./tip-selection";

export interface GameSessionSnapshot {
  progress: GameProgress;
  attempts: LevelAttempt[];
}

export interface CreateGameSessionInput {
  playerId: AnonymousPlayerId;
  runId: GameRunId;
  levels?: Level[];
  now?: string;
}

export interface RecordAttemptInput {
  session: GameSessionSnapshot;
  levelId: LevelId;
  attemptId: AttemptId;
  promptText: string;
  result: AttemptResult;
  generation?: AttemptGenerationDetails;
  createdAt?: string;
  levels?: Level[];
}

export interface RecordAttemptResult {
  session: GameSessionSnapshot;
  attempt: LevelAttempt;
  transition: "retry" | "passed" | "failed" | "rejected" | "error" | "completed";
}

export interface LevelSessionInput {
  session: GameSessionSnapshot;
  levelId: LevelId;
  now?: string;
  levels?: Level[];
}

function getNow(input?: string) {
  return input ?? new Date().toISOString();
}

function sortLevels(levels: Level[]) {
  return [...levels].sort((left, right) => left.number - right.number);
}

function findLevel(levels: Level[], levelId: LevelId) {
  const level = levels.find((candidate) => candidate.id === levelId);

  if (!level) {
    throw new Error(`Unknown level "${levelId}".`);
  }

  return level;
}

function findLevelProgress(progress: GameProgress, levelId: LevelId) {
  const levelProgress = progress.levels.find((candidate) => candidate.levelId === levelId);

  if (!levelProgress) {
    throw new Error(`Missing progress for level "${levelId}".`);
  }

  return levelProgress;
}

function updateLevelProgress(
  levels: LevelProgress[],
  levelId: LevelId,
  update: (currentLevelProgress: LevelProgress) => LevelProgress,
) {
  return levels.map((levelProgress) => (levelProgress.levelId === levelId ? update(levelProgress) : levelProgress));
}

function resolveFallbackCurrentLevelId(progress: GameProgress, levels: Level[]) {
  const sortedLevels = sortLevels(levels);

  const activeLevel = sortedLevels.find((level) => {
    const levelProgress = progress.levels.find((candidate) => candidate.levelId === level.id);

    return levelProgress?.status === "in_progress" || levelProgress?.status === "failed" || levelProgress?.status === "unlocked";
  });

  return activeLevel?.id ?? null;
}

function finalizeProgress(progress: GameProgress, levels: Level[], preferredCurrentLevelId?: LevelId | null): GameProgress {
  const clearedLevels = progress.levels.filter((levelProgress) => levelProgress.completedAt).length;
  const preferredLevelProgress = preferredCurrentLevelId
    ? progress.levels.find((levelProgress) => levelProgress.levelId === preferredCurrentLevelId) ?? null
    : null;
  const canKeepPreferredCurrentLevel =
    preferredCurrentLevelId &&
    preferredLevelProgress &&
    ["in_progress", "failed", "unlocked"].includes(preferredLevelProgress.status);

  return {
    ...progress,
    canResume: progress.totalAttemptsUsed > 0 || clearedLevels > 0,
    currentLevelId: canKeepPreferredCurrentLevel ? preferredCurrentLevelId : resolveFallbackCurrentLevelId(progress, levels),
  };
}

function getStrongestAttemptScore(levelProgress: LevelProgress, score?: number | null) {
  if (score == null) {
    return levelProgress.bestScore;
  }

  if (levelProgress.bestScore == null) {
    return score;
  }

  return Math.max(levelProgress.bestScore, score);
}

function createLevelProgress(level: Level, now: string, isCurrentLevel: boolean): LevelProgress {
  return {
    levelId: level.id,
    status: isCurrentLevel ? "in_progress" : "locked",
    currentAttemptCycle: 1,
    attemptsUsed: 0,
    attemptsRemaining: level.maxAttempts,
    bestScore: null,
    strongestAttemptId: null,
    unlockedAt: isCurrentLevel ? now : null,
    completedAt: null,
    lastCompletedAt: null,
    lastAttemptedAt: null,
  };
}

export function createGameSession(input: CreateGameSessionInput): GameSessionSnapshot {
  const now = getNow(input.now);
  const levels = sortLevels(input.levels ?? defaultLevels);
  const firstLevel = levels[0] ?? null;
  const progress: GameProgress = {
    playerId: input.playerId,
    runId: input.runId,
    currentLevelId: firstLevel?.id ?? null,
    highestUnlockedLevelNumber: firstLevel?.number ?? 0,
    totalAttemptsUsed: 0,
    canResume: false,
    lastActiveAt: now,
    levels: levels.map((level) => createLevelProgress(level, now, level.id === firstLevel?.id)),
  };

  return {
    progress,
    attempts: [],
  };
}

export function resolveResumeLevel(progress: GameProgress, levels: Level[] = defaultLevels) {
  const sortedLevels = sortLevels(levels);

  if (sortedLevels.length === 0) {
    return null;
  }

  if (progress.currentLevelId) {
    const currentLevel = sortedLevels.find((level) => level.id === progress.currentLevelId);

    if (currentLevel) {
      return currentLevel;
    }
  }

  const highestUnlockedLevel = [...sortedLevels]
    .reverse()
    .find((level) => level.number <= Math.max(progress.highestUnlockedLevelNumber, 1));

  return highestUnlockedLevel ?? sortedLevels[0];
}

export function buildLandingExperience(session: GameSessionSnapshot | null, levels: Level[] = defaultLevels): LandingExperienceState {
  const sortedLevels = sortLevels(levels);
  const firstLevel = sortedLevels[0];
  const startHref = firstLevel ? `/play?level=${firstLevel.number}` : "/play";

  if (!session || !session.progress.canResume) {
    return {
      startHref,
      resume: {
        available: false,
        href: startHref,
        currentLevelNumber: null,
        currentLevelTitle: null,
        levelsCleared: 0,
        attemptsRemaining: 0,
        bestScore: null,
        helperText: uiCopy.landing.resume.unavailableHelper,
      },
    };
  }

  const currentLevel = resolveResumeLevel(session.progress, sortedLevels);
  const currentLevelProgress = currentLevel ? findLevelProgress(session.progress, currentLevel.id) : null;
  const levelsCleared = session.progress.levels.filter((levelProgress) => levelProgress.completedAt).length;
  const attemptsRemaining = currentLevelProgress?.attemptsRemaining ?? 0;
  const levelScores = session.progress.levels.map((levelProgress) => levelProgress.bestScore ?? 0);
  const bestScore = currentLevelProgress?.bestScore ?? (levelScores.length > 0 ? Math.max(...levelScores) : 0);
  const helperText =
    currentLevel && currentLevelProgress?.status === "failed"
      ? uiCopy.landing.resume.failedHelper
      : currentLevel
        ? uiCopy.landing.resume.inProgressHelper
        : uiCopy.landing.resume.replayHelper;

  if (!currentLevel || !currentLevelProgress || bestScore == null) {
    return {
      startHref,
      resume: {
        available: false,
        href: startHref,
        currentLevelNumber: null,
        currentLevelTitle: null,
        levelsCleared,
        attemptsRemaining: 0,
        bestScore: null,
        helperText: uiCopy.landing.resume.unavailableHelper,
      },
    };
  }

  return {
    startHref,
    resume: {
      available: true,
      href: `/play?level=${currentLevel.number}&resume=1`,
      currentLevelNumber: currentLevel.number,
      currentLevelTitle: currentLevel.title,
      levelsCleared,
      attemptsRemaining,
      bestScore,
      helperText,
    },
  };
}

export function recordAttempt(input: RecordAttemptInput): RecordAttemptResult {
  const levels = sortLevels(input.levels ?? defaultLevels);
  const now = getNow(input.createdAt);
  const level = findLevel(levels, input.levelId);
  const currentLevelProgress = findLevelProgress(input.session.progress, input.levelId);

  if (input.session.progress.currentLevelId !== input.levelId) {
    throw new Error(`Cannot record attempts for non-current level "${input.levelId}".`);
  }

  if (currentLevelProgress.status === "locked") {
    throw new Error(`Cannot record attempts for locked level "${input.levelId}".`);
  }

  if (currentLevelProgress.status === "failed") {
    throw new Error(`Cannot record attempts for failed level "${input.levelId}" without restarting it first.`);
  }

  if (currentLevelProgress.status === "passed") {
    throw new Error(`Cannot record attempts for passed level "${input.levelId}" without replaying it first.`);
  }

  const attemptsForCurrentCycle = input.session.attempts.filter(
    (attempt) => attempt.levelId === input.levelId && attempt.attemptCycle === currentLevelProgress.currentAttemptCycle,
  );
  const attemptScore = input.result.score?.normalized ?? null;
  const strongestAttemptScore = getStrongestAttemptScore(currentLevelProgress, attemptScore);
  const consumedAttempt = input.result.status === "scored";
  const attemptNumber = attemptsForCurrentCycle.length + 1;
  const resolvedTipIds =
    input.result.tipIds.length > 0
      ? input.result.tipIds
      : selectRetryTipIds({
          attemptNumber,
          level,
          previousAttempts: attemptsForCurrentCycle,
          score: input.result.score,
        });
  const updatedAttempt: LevelAttempt = {
    id: input.attemptId,
    runId: input.session.progress.runId,
    levelId: input.levelId,
    attemptCycle: currentLevelProgress.currentAttemptCycle,
    attemptNumber,
    promptText: input.promptText,
    createdAt: now,
    consumedAttempt,
    generation: input.generation,
    result: {
      ...input.result,
      strongestAttemptScore: strongestAttemptScore ?? null,
      tipIds: resolvedTipIds,
    },
  };

  let nextLevels = updateLevelProgress(input.session.progress.levels, input.levelId, (levelProgress) => {
    const nextAttemptsUsed = levelProgress.attemptsUsed + (consumedAttempt ? 1 : 0);
    const nextAttemptsRemaining = Math.max(level.maxAttempts - nextAttemptsUsed, 0);
    const nextBestScore =
      attemptScore == null ? levelProgress.bestScore : Math.max(levelProgress.bestScore ?? 0, attemptScore);
    const nextStrongestAttemptId =
      attemptScore != null && (levelProgress.bestScore == null || attemptScore >= levelProgress.bestScore)
        ? input.attemptId
        : levelProgress.strongestAttemptId ?? null;

    if (!consumedAttempt) {
      return {
        ...levelProgress,
        attemptsRemaining: level.maxAttempts - levelProgress.attemptsUsed,
        strongestAttemptId: nextStrongestAttemptId,
        bestScore: nextBestScore,
        lastAttemptedAt: now,
      };
    }

    if (input.result.score?.passed) {
      return {
        ...levelProgress,
        status: "passed",
        attemptsUsed: nextAttemptsUsed,
        attemptsRemaining: nextAttemptsRemaining,
        bestScore: nextBestScore,
        strongestAttemptId: nextStrongestAttemptId,
        completedAt: levelProgress.completedAt ?? now,
        lastCompletedAt: now,
        lastAttemptedAt: now,
      };
    }

    const exhaustedAttempts = nextAttemptsRemaining === 0;

    return {
      ...levelProgress,
      status: exhaustedAttempts ? "failed" : "in_progress",
      attemptsUsed: nextAttemptsUsed,
      attemptsRemaining: nextAttemptsRemaining,
      bestScore: nextBestScore,
      strongestAttemptId: nextStrongestAttemptId,
      lastAttemptedAt: now,
    };
  });

  let preferredCurrentLevelId: LevelId | null = input.levelId;
  let transition: RecordAttemptResult["transition"];
  const currentLevelIndex = levels.findIndex((candidate) => candidate.id === level.id);
  const nextLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex + 1] ?? null : null;

  if (!consumedAttempt) {
    transition = input.result.outcome === "rejected" ? "rejected" : "error";
  } else if (input.result.score?.passed) {
    const wasPreviouslyCompleted = Boolean(currentLevelProgress.completedAt);

    if (nextLevel && !wasPreviouslyCompleted) {
      nextLevels = updateLevelProgress(nextLevels, nextLevel.id, (levelProgress) => ({
        ...levelProgress,
        status: levelProgress.status === "locked" ? "in_progress" : levelProgress.status,
        unlockedAt: levelProgress.unlockedAt ?? now,
      }));
      preferredCurrentLevelId = nextLevel.id;
      transition = "passed";
    } else {
      preferredCurrentLevelId = null;
      transition = nextLevel ? "passed" : "completed";
    }
  } else {
    transition = nextLevels.find((levelProgress) => levelProgress.levelId === input.levelId)?.status === "failed" ? "failed" : "retry";
  }

  const nextProgress = finalizeProgress(
    {
      ...input.session.progress,
      levels: nextLevels,
      lastActiveAt: now,
      totalAttemptsUsed: input.session.progress.totalAttemptsUsed + (consumedAttempt ? 1 : 0),
      highestUnlockedLevelNumber:
        input.result.score?.passed && nextLevel
          ? Math.max(input.session.progress.highestUnlockedLevelNumber, nextLevel.number)
          : input.session.progress.highestUnlockedLevelNumber,
    },
    levels,
    preferredCurrentLevelId,
  );

  return {
    session: {
      progress: nextProgress,
      attempts: [...input.session.attempts, updatedAttempt],
    },
    attempt: updatedAttempt,
    transition,
  };
}

export function restartFailedLevel(input: LevelSessionInput): GameSessionSnapshot {
  const levels = sortLevels(input.levels ?? defaultLevels);
  const now = getNow(input.now);
  const level = findLevel(levels, input.levelId);
  const currentLevelProgress = findLevelProgress(input.session.progress, input.levelId);

  if (currentLevelProgress.status !== "failed") {
    throw new Error(`Only failed levels can be restarted. Received "${currentLevelProgress.status}".`);
  }

  const nextProgress = finalizeProgress(
    {
      ...input.session.progress,
      lastActiveAt: now,
      levels: updateLevelProgress(input.session.progress.levels, input.levelId, (levelProgress) => ({
        ...levelProgress,
        status: "in_progress",
        currentAttemptCycle: levelProgress.currentAttemptCycle + 1,
        attemptsUsed: 0,
        attemptsRemaining: level.maxAttempts,
        lastAttemptedAt: now,
      })),
    },
    levels,
    input.levelId,
  );

  return {
    progress: nextProgress,
    attempts: input.session.attempts,
  };
}

export function replayLevel(input: LevelSessionInput): GameSessionSnapshot {
  const levels = sortLevels(input.levels ?? defaultLevels);
  const now = getNow(input.now);
  const level = findLevel(levels, input.levelId);
  const currentLevelProgress = findLevelProgress(input.session.progress, input.levelId);

  if (currentLevelProgress.status !== "passed") {
    throw new Error(`Only currently completed levels can be replayed. Received "${currentLevelProgress.status}".`);
  }

  const nextProgress = finalizeProgress(
    {
      ...input.session.progress,
      lastActiveAt: now,
      levels: updateLevelProgress(input.session.progress.levels, input.levelId, (levelProgress) => ({
        ...levelProgress,
        status: "in_progress",
        currentAttemptCycle: levelProgress.currentAttemptCycle + 1,
        attemptsUsed: 0,
        attemptsRemaining: level.maxAttempts,
        lastAttemptedAt: now,
      })),
    },
    levels,
    input.levelId,
  );

  return {
    progress: nextProgress,
    attempts: input.session.attempts,
  };
}
