import { levels } from "@/content";
import type {
  AttemptScore,
  GameProgress,
  LandingExperienceState,
  Level,
  LevelAttempt,
  LevelProgress,
  SubmitAttemptTransition,
} from "@/lib/game";

export const FIXTURE_PLAYER_ID = "player-1";
export const FIXTURE_RUN_ID = "run-1";
export const FIXTURE_TIMESTAMP = "2026-04-07T08:00:00.000Z";

type LevelProgressOverride = Partial<LevelProgress> & Pick<LevelProgress, "levelId">;

function getLevel(levelId: string) {
  const level = levels.find((candidate) => candidate.id === levelId);

  if (!level) {
    throw new Error(`Unknown level fixture "${levelId}".`);
  }

  return level;
}

function buildDefaultLevelStatus(level: Level, currentLevelId: string | null, highestUnlockedLevelNumber: number) {
  if (currentLevelId != null && level.id === currentLevelId) {
    return "in_progress" as const;
  }

  if (currentLevelId != null && level.number < getLevel(currentLevelId).number) {
    return "passed" as const;
  }

  if (level.number <= highestUnlockedLevelNumber) {
    return "unlocked" as const;
  }

  return "locked" as const;
}

export function createGameProgressFixture(input?: {
  playerId?: string;
  runId?: string;
  currentLevelId?: string | null;
  highestUnlockedLevelNumber?: number;
  totalAttemptsUsed?: number;
  canResume?: boolean;
  lastActiveAt?: string;
  levels?: LevelProgressOverride[];
}): GameProgress {
  const currentLevelId = input?.currentLevelId === undefined ? "level-1" : input.currentLevelId;
  const currentLevel = currentLevelId == null ? null : getLevel(currentLevelId);
  const highestUnlockedLevelNumber = input?.highestUnlockedLevelNumber ?? currentLevel?.number ?? 1;
  const overrides = new Map((input?.levels ?? []).map((levelProgress) => [levelProgress.levelId, levelProgress]));

  return {
    playerId: input?.playerId ?? FIXTURE_PLAYER_ID,
    runId: input?.runId ?? FIXTURE_RUN_ID,
    currentLevelId,
    highestUnlockedLevelNumber,
    totalAttemptsUsed: input?.totalAttemptsUsed ?? 0,
    canResume: input?.canResume ?? true,
    lastActiveAt: input?.lastActiveAt ?? FIXTURE_TIMESTAMP,
    levels: levels.map((level) => {
      const status = buildDefaultLevelStatus(level, currentLevelId, highestUnlockedLevelNumber);
      const baseLevelProgress: LevelProgress = {
        levelId: level.id,
        status,
        currentAttemptCycle: 1,
        attemptsUsed: status === "passed" ? 1 : 0,
        attemptsRemaining: status === "passed" ? level.maxAttempts - 1 : level.maxAttempts,
        bestScore: status === "passed" ? level.threshold + 18 : null,
        strongestAttemptId: status === "passed" ? `attempt-${level.id}-1` : null,
        unlockedAt: status === "locked" ? null : FIXTURE_TIMESTAMP,
        completedAt: status === "passed" ? FIXTURE_TIMESTAMP : null,
        lastCompletedAt: status === "passed" ? FIXTURE_TIMESTAMP : null,
        lastAttemptedAt: status === "passed" || status === "in_progress" ? FIXTURE_TIMESTAMP : null,
      };

      return {
        ...baseLevelProgress,
        ...(overrides.get(level.id) ?? {}),
      };
    }),
  };
}

export function createLandingStateFixture(input?: {
  available?: boolean;
  currentLevelId?: string;
  highestUnlockedLevelNumber?: number;
  levelsCleared?: number;
  attemptsRemaining?: number;
  bestScore?: number | null;
  helperText?: string;
  runId?: string;
}): LandingExperienceState {
  const available = input?.available ?? true;
  const currentLevel = getLevel(input?.currentLevelId ?? "level-1");

  if (!available) {
    return {
      startHref: "/play?level=1",
      resume: {
        available: false,
        href: "/play?level=1",
        currentLevelNumber: null,
        currentLevelTitle: null,
        levelsCleared: 0,
        attemptsRemaining: 0,
        bestScore: null,
        helperText: input?.helperText ?? "Resume appears here after your first scored attempt.",
      },
    };
  }

  return {
    startHref: "/play?level=1",
    resume: {
      available: true,
      href: `/play?level=${currentLevel.number}&resume=1`,
      currentLevelId: currentLevel.id,
      currentLevelNumber: currentLevel.number,
      currentLevelTitle: currentLevel.title,
      levelsCleared: input?.levelsCleared ?? Math.max(currentLevel.number - 1, 0),
      attemptsRemaining: input?.attemptsRemaining ?? currentLevel.maxAttempts,
      bestScore: input?.bestScore ?? currentLevel.threshold + 14,
      highestUnlockedLevelNumber: input?.highestUnlockedLevelNumber ?? currentLevel.number,
      runId: input?.runId ?? FIXTURE_RUN_ID,
      helperText: input?.helperText ?? "Pick up the same run without replaying cleared progress.",
    },
  };
}

export function createAttemptScoreFixture(input?: {
  levelId?: string;
  raw?: number;
  normalized?: number;
  threshold?: number;
  passed?: boolean;
  breakdown?: AttemptScore["breakdown"];
  scorer?: Partial<AttemptScore["scorer"]>;
}): AttemptScore {
  const level = getLevel(input?.levelId ?? "level-1");
  const normalized = input?.normalized ?? 64;
  const threshold = input?.threshold ?? level.threshold;

  return {
    raw: input?.raw ?? normalized / 100,
    normalized,
    threshold,
    passed: input?.passed ?? normalized >= threshold,
    breakdown: input?.breakdown ?? {},
    scorer: {
      provider: "mock",
      model: "mock-scorer",
      ...(input?.scorer ?? {}),
    },
  };
}

export function createLevelAttemptFixture(input?: {
  id?: string;
  runId?: string;
  levelId?: string;
  attemptCycle?: number;
  attemptNumber?: number;
  promptText?: string;
  createdAt?: string;
  consumedAttempt?: boolean;
  generation?: Partial<NonNullable<LevelAttempt["generation"]>> | null;
  withScore?: boolean;
  score?: Partial<AttemptScore>;
  result?: Partial<LevelAttempt["result"]>;
}): LevelAttempt {
  const level = getLevel(input?.levelId ?? "level-1");
  const attemptId = input?.id ?? `attempt-${level.id}-${input?.attemptNumber ?? 1}`;
  const score =
    input?.withScore === false ? undefined : createAttemptScoreFixture({ levelId: level.id, ...(input?.score ?? {}) });
  const baseGeneration =
    input?.generation === null
      ? undefined
      : {
          provider: "mock",
          model: "mock-image",
          ...(score ? { assetKey: `generated/${level.id}/${attemptId}.png` } : {}),
          ...(input?.generation ?? {}),
        };

  return {
    id: attemptId,
    runId: input?.runId ?? FIXTURE_RUN_ID,
    levelId: level.id,
    attemptCycle: input?.attemptCycle ?? 1,
    attemptNumber: input?.attemptNumber ?? 1,
    promptText: input?.promptText ?? `fixture prompt for ${level.title}`,
    createdAt: input?.createdAt ?? FIXTURE_TIMESTAMP,
    consumedAttempt: input?.consumedAttempt ?? Boolean(score),
    generation: baseGeneration,
    result: score
      ? {
          status: "scored",
          outcome: score.passed ? "passed" : "failed",
          strongestAttemptScore: Math.floor(score.normalized),
          tipIds: [],
          score,
          ...(input?.result ?? {}),
        }
      : {
          status: "technical_failure",
          outcome: "error",
          tipIds: [],
          errorCode: "fixture_error",
          errorMessage: "Fixture failure.",
          ...(input?.result ?? {}),
        },
  };
}

export function createSubmitAttemptResponseFixture(input?: {
  transition?: SubmitAttemptTransition;
  attempt?: LevelAttempt;
  currentLevel?: Level | null;
  landing?: LandingExperienceState;
  progress?: GameProgress;
}) {
  const attempt = input?.attempt ?? createLevelAttemptFixture();
  const currentLevel = input?.currentLevel === undefined ? getLevel(attempt.levelId) : input.currentLevel;
  const transition =
    input?.transition ?? (attempt.result.score?.passed ? "passed" : attempt.result.outcome === "failed" ? "retry" : "error");
  const progress =
    input?.progress ??
    createGameProgressFixture({
      currentLevelId: currentLevel?.id ?? null,
      totalAttemptsUsed: attempt.consumedAttempt ? attempt.attemptNumber : 0,
      levels: [
        {
          levelId: attempt.levelId,
          status:
            transition === "passed" && currentLevel?.id !== attempt.levelId
              ? "passed"
              : transition === "failed"
                ? "failed"
                : "in_progress",
          attemptsUsed: attempt.consumedAttempt ? attempt.attemptNumber : 0,
          attemptsRemaining:
            getLevel(attempt.levelId).maxAttempts - (attempt.consumedAttempt ? attempt.attemptNumber : 0),
          bestScore: attempt.result.score ? Math.floor(attempt.result.score.normalized) : null,
          strongestAttemptId: attempt.id,
          unlockedAt: attempt.createdAt,
          completedAt:
            attempt.result.score?.passed && currentLevel?.id !== attempt.levelId ? attempt.createdAt : null,
          lastCompletedAt:
            attempt.result.score?.passed && currentLevel?.id !== attempt.levelId ? attempt.createdAt : null,
          lastAttemptedAt: attempt.createdAt,
        },
      ],
    });
  const landing =
    input?.landing ??
    createLandingStateFixture({
      currentLevelId: currentLevel?.id ?? attempt.levelId,
      attemptsRemaining:
        progress.levels.find((levelProgress) => levelProgress.levelId === (currentLevel?.id ?? attempt.levelId))
          ?.attemptsRemaining ?? getLevel(currentLevel?.id ?? attempt.levelId).maxAttempts,
      bestScore:
        progress.levels.find((levelProgress) => levelProgress.levelId === attempt.levelId)?.bestScore ??
        Math.floor(attempt.result.score?.normalized ?? 0),
      highestUnlockedLevelNumber: progress.highestUnlockedLevelNumber,
      levelsCleared: progress.levels.filter((levelProgress) => levelProgress.completedAt != null).length,
      runId: progress.runId,
    });

  return {
    ok: true as const,
    transition,
    attempt,
    currentLevel,
    landing,
    progress,
  };
}

export function createProgressMutationResponseFixture(input?: {
  currentLevel?: Level | null;
  landing?: LandingExperienceState;
  progress?: GameProgress;
}) {
  const currentLevel = input?.currentLevel === undefined ? (levels[0] ?? null) : input.currentLevel;
  const progress =
    input?.progress ??
    createGameProgressFixture({
      currentLevelId: currentLevel?.id ?? null,
    });

  return {
    ok: true as const,
    currentLevel,
    landing:
      input?.landing ??
      createLandingStateFixture({
        currentLevelId: currentLevel?.id ?? "level-1",
        attemptsRemaining:
          progress.levels.find((levelProgress) => levelProgress.levelId === (currentLevel?.id ?? "level-1"))
            ?.attemptsRemaining ?? 0,
        bestScore:
          progress.levels.find((levelProgress) => levelProgress.levelId === (currentLevel?.id ?? "level-1"))
            ?.bestScore ?? 0,
        highestUnlockedLevelNumber: progress.highestUnlockedLevelNumber,
        levelsCleared: progress.levels.filter((levelProgress) => levelProgress.completedAt != null).length,
        runId: progress.runId,
      }),
    progress,
  };
}

export function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
