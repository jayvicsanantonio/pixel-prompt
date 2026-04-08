import { levels } from "@/content";
import type { ActiveLevelScreenState, Level } from "@/lib/game";
import {
  buildContinuationPreview,
  buildFailurePreview,
  buildResultPreview,
  buildSummaryPreview,
  findLevelProgress,
} from "@/lib/game/screen-state";
import { resolveResumeLevel, type GameSessionSnapshot } from "@/server/game/session-state";

function findLevelByNumber(levelNumber: number | undefined) {
  if (levelNumber == null) {
    return null;
  }

  return levels.find((level) => level.number === levelNumber) ?? null;
}

function getSelectedLevel(input: {
  requestedLevelNumber?: number;
  preferResume: boolean;
  session: GameSessionSnapshot | null;
}) {
  const fallbackLevel = levels[0];

  if (!fallbackLevel) {
    throw new Error("No levels are available for live page state.");
  }

  const requestedLevel = findLevelByNumber(input.requestedLevelNumber);

  if (!input.session) {
    return requestedLevel ?? fallbackLevel;
  }

  const resumeLevel = resolveResumeLevel(input.session.progress, levels) ?? fallbackLevel;

  if (input.preferResume || !requestedLevel) {
    return resumeLevel;
  }

  const requestedLevelProgress = findLevelProgress(input.session.progress, requestedLevel.id);

  if (!requestedLevelProgress || requestedLevelProgress.status === "locked") {
    return resumeLevel;
  }

  return requestedLevel;
}

function getLatestAttempt(session: GameSessionSnapshot | null, level: Level, currentAttemptCycle?: number) {
  if (!session) {
    return null;
  }

  const attempts = session.attempts
    .filter((attempt) => attempt.levelId === level.id && (currentAttemptCycle == null || attempt.attemptCycle === currentAttemptCycle))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return attempts[attempts.length - 1] ?? null;
}

function getStrongestAttempt(session: GameSessionSnapshot | null, strongestAttemptId?: string | null) {
  if (!session || !strongestAttemptId) {
    return null;
  }

  return session.attempts.find((attempt) => attempt.id === strongestAttemptId) ?? null;
}

export function buildLiveActiveLevelState(input: {
  requestedLevelNumber?: number;
  preferResume?: boolean;
  session: GameSessionSnapshot | null;
}): ActiveLevelScreenState {
  const selectedLevel = getSelectedLevel({
    requestedLevelNumber: input.requestedLevelNumber,
    preferResume: input.preferResume ?? false,
    session: input.session,
  });
  const levelProgress = input.session ? findLevelProgress(input.session.progress, selectedLevel.id) : null;
  const latestAttempt = getLatestAttempt(input.session, selectedLevel, levelProgress?.currentAttemptCycle);
  const strongestAttempt = getStrongestAttempt(input.session, levelProgress?.strongestAttemptId);
  const resultAttempt = latestAttempt ?? strongestAttempt ?? null;
  const attemptsUsed = levelProgress?.attemptsUsed ?? 0;
  const attemptsRemaining = levelProgress?.attemptsRemaining ?? selectedLevel.maxAttempts;
  const promptDraft = latestAttempt?.promptText ?? "";

  return {
    level: selectedLevel,
    attemptsUsed,
    attemptsRemaining,
    promptDraft,
    resultPreview: buildResultPreview(selectedLevel, resultAttempt),
    continuation: buildContinuationPreview(selectedLevel, attemptsRemaining),
    failurePreview: buildFailurePreview({
      level: selectedLevel,
      attempt: strongestAttempt ?? resultAttempt,
      progress: input.session?.progress ?? null,
    }),
    summaryPreview: buildSummaryPreview(input.session?.progress ?? null),
    initialScreenMode: levelProgress?.status === "failed" ? "failure" : "active",
  };
}
