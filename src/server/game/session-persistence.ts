import { asc, desc, eq, sql } from "drizzle-orm";

import { levels as defaultLevels } from "@/content";
import type { AttemptResult, AttemptScore, Level, LevelAttempt, LevelProgress } from "@/lib/game";
import { anonymousPlayers, gameRuns, getDatabase, hasDatabaseUrl, levelAttempts, runLevelProgress } from "@/server/db";
import type { GameSessionSnapshot } from "./session-state";

type SessionPersistenceExecutor = Pick<ReturnType<typeof getDatabase>, "delete" | "execute" | "insert" | "select">;

interface LoadedPersistedSession {
  playerId: string | null;
  session: GameSessionSnapshot | null;
}

function getLevelMap(levels: Level[] = defaultLevels) {
  return new Map(levels.map((level) => [level.id, level]));
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function getCurrentLevelNumber(currentLevelId: string | null, levelsById: Map<string, Level>) {
  if (!currentLevelId) {
    return null;
  }

  return levelsById.get(currentLevelId)?.number ?? null;
}

function getHighestCompletedLevelNumber(progressLevels: LevelProgress[], levelsById: Map<string, Level>) {
  return progressLevels.reduce((highestCompleted, levelProgress) => {
    if (!levelProgress.completedAt) {
      return highestCompleted;
    }

    return Math.max(highestCompleted, levelsById.get(levelProgress.levelId)?.number ?? 0);
  }, 0);
}

function getRunStatus(session: GameSessionSnapshot) {
  return session.progress.currentLevelId === null ? "completed" : "active";
}

function mapFailureKind(result: AttemptResult) {
  if (result.status === "content_policy_rejected") {
    return "content_policy_rejection" as const;
  }

  if (result.status !== "technical_failure") {
    return null;
  }

  if (result.errorCode?.includes("timeout")) {
    return "timeout" as const;
  }

  return "technical_failure" as const;
}

function mapAttemptScore(score?: AttemptScore) {
  if (!score) {
    return {
      scoreRaw: null,
      scoreNormalized: null,
      scoreThreshold: null,
      scorePassed: null,
      scoreBreakdown: null,
      scoringProvider: null,
      scoringModel: null,
      scoringModelVersion: null,
    };
  }

  return {
    scoreRaw: score.raw,
    scoreNormalized: score.normalized,
    scoreThreshold: score.threshold,
    scorePassed: score.passed,
    scoreBreakdown: score.breakdown,
    scoringProvider: score.scorer.provider,
    scoringModel: score.scorer.model,
    scoringModelVersion: score.scorer.version ?? null,
  };
}

function buildAttemptResult(attempt: typeof levelAttempts.$inferSelect, strongestAttemptScore: number | null): AttemptResult {
  const hasScore =
    attempt.scoreRaw != null &&
    attempt.scoreNormalized != null &&
    attempt.scoreThreshold != null &&
    attempt.scorePassed != null &&
    attempt.scoringProvider != null &&
    attempt.scoringModel != null;
  const score: AttemptScore | undefined = hasScore
    ? {
        raw: attempt.scoreRaw!,
        normalized: attempt.scoreNormalized!,
        threshold: attempt.scoreThreshold!,
        passed: attempt.scorePassed!,
        breakdown: attempt.scoreBreakdown ?? {},
        scorer: {
          provider: attempt.scoringProvider!,
          model: attempt.scoringModel!,
          version: attempt.scoringModelVersion ?? undefined,
        },
      }
    : undefined;

  return {
    status: attempt.lifecycleStatus,
    outcome:
      attempt.outcome ?? (attempt.lifecycleStatus === "content_policy_rejected" ? "rejected" : "error"),
    score,
    strongestAttemptScore,
    tipIds: attempt.tipIds ?? [],
    errorCode: attempt.errorCode ?? undefined,
    errorMessage: attempt.errorMessage ?? undefined,
  };
}

function buildLevelAttempt(
  attempt: typeof levelAttempts.$inferSelect,
  strongestAttemptScore: number | null,
): LevelAttempt {
  const hasGeneration =
    attempt.generationProvider != null ||
    attempt.generationModel != null ||
    attempt.generatedImageAssetKey != null ||
    attempt.generationSeed != null ||
    attempt.revisedPrompt != null;

  return {
    id: attempt.id,
    runId: attempt.runId,
    levelId: attempt.levelId,
    attemptCycle: attempt.attemptCycle,
    attemptNumber: attempt.attemptNumber,
    promptText: attempt.promptText,
    createdAt: attempt.createdAt.toISOString(),
    consumedAttempt: attempt.consumedAttempt,
    generation: hasGeneration
      ? {
          provider: attempt.generationProvider ?? "unknown",
          model: attempt.generationModel ?? "unknown",
          assetKey: attempt.generatedImageAssetKey ?? undefined,
          seed: attempt.generationSeed ?? undefined,
          revisedPrompt: attempt.revisedPrompt ?? undefined,
        }
      : undefined,
    result: buildAttemptResult(attempt, strongestAttemptScore),
  };
}

function buildProgressRows(
  session: GameSessionSnapshot,
  now: Date,
  levelsById: Map<string, Level>,
): Array<typeof runLevelProgress.$inferInsert> {
  return session.progress.levels.map((levelProgress) => ({
    runId: session.progress.runId,
    levelId: levelProgress.levelId,
    levelNumber: levelsById.get(levelProgress.levelId)?.number ?? 0,
    status: levelProgress.status,
    currentAttemptCycle: levelProgress.currentAttemptCycle,
    attemptsUsedInCycle: levelProgress.attemptsUsed,
    bestScore: levelProgress.bestScore,
    strongestAttemptId: levelProgress.strongestAttemptId ?? null,
    unlockedAt: toDate(levelProgress.unlockedAt ?? null),
    firstCompletedAt: toDate(levelProgress.completedAt ?? null),
    lastCompletedAt: toDate(levelProgress.lastCompletedAt ?? levelProgress.completedAt ?? null),
    lastAttemptedAt: toDate(levelProgress.lastAttemptedAt ?? null),
    createdAt: toDate(levelProgress.unlockedAt ?? null) ?? now,
    updatedAt: now,
  }));
}

function buildAttemptRows(
  session: GameSessionSnapshot,
  levelsById: Map<string, Level>,
): Array<typeof levelAttempts.$inferInsert> {
  return session.attempts.map((attempt) => {
    const level = levelsById.get(attempt.levelId);
    const mappedScore = mapAttemptScore(attempt.result.score);

    if (!level) {
      throw new Error(`Missing level metadata for attempt "${attempt.id}".`);
    }

    return {
      id: attempt.id,
      runId: attempt.runId,
      levelId: attempt.levelId,
      levelNumber: level.number,
      attemptCycle: attempt.attemptCycle,
      attemptNumber: attempt.attemptNumber,
      promptText: attempt.promptText,
      promptCharacterCount: attempt.promptText.length,
      targetImageAssetKey: level.targetImage.assetKey,
      lifecycleStatus: attempt.result.status,
      outcome: attempt.result.outcome,
      consumedAttempt: attempt.consumedAttempt,
      generationProvider: attempt.generation?.provider ?? null,
      generationModel: attempt.generation?.model ?? null,
      generationModelVersion: null,
      generatedImageAssetKey: attempt.generation?.assetKey ?? null,
      generationSeed: attempt.generation?.seed ?? null,
      revisedPrompt: attempt.generation?.revisedPrompt ?? null,
      generationCreatedAt: toDate(attempt.createdAt),
      scoreRaw: mappedScore.scoreRaw,
      scoreNormalized: mappedScore.scoreNormalized,
      scoreThreshold: mappedScore.scoreThreshold,
      scorePassed: mappedScore.scorePassed,
      scoreBreakdown: mappedScore.scoreBreakdown,
      scoringProvider: mappedScore.scoringProvider,
      scoringModel: mappedScore.scoringModel,
      scoringModelVersion: mappedScore.scoringModelVersion,
      scoringReasoning: null,
      scoredAt: attempt.result.status === "scored" ? toDate(attempt.createdAt) : null,
      tipIds: attempt.result.tipIds,
      providerFailureKind: mapFailureKind(attempt.result),
      errorCode: attempt.result.errorCode ?? null,
      errorMessage: attempt.result.errorMessage ?? null,
      createdAt: toDate(attempt.createdAt) ?? new Date(),
      updatedAt: toDate(attempt.createdAt) ?? new Date(),
    };
  });
}

async function loadPersistedSession(
  executor: SessionPersistenceExecutor,
  sessionTokenHash: string,
  levels: Level[] = defaultLevels,
  options?: { lockRun?: boolean },
): Promise<LoadedPersistedSession> {
  const [player] = await executor
    .select()
    .from(anonymousPlayers)
    .where(eq(anonymousPlayers.sessionTokenHash, sessionTokenHash))
    .limit(1);

  if (!player) {
    return {
      playerId: null,
      session: null,
    };
  }

  const [latestRun] = await executor
    .select()
    .from(gameRuns)
    .where(eq(gameRuns.playerId, player.id))
    .orderBy(desc(gameRuns.lastActiveAt))
    .limit(1);

  if (!latestRun) {
    return {
      playerId: player.id,
      session: null,
    };
  }

  if (options?.lockRun) {
    await executor.execute(sql`select 1 from game_runs where id = ${latestRun.id} for update`);
  }

  const [run] = options?.lockRun
    ? await executor.select().from(gameRuns).where(eq(gameRuns.id, latestRun.id)).limit(1)
    : [latestRun];

  const progressRows = await executor
    .select()
    .from(runLevelProgress)
    .where(eq(runLevelProgress.runId, run.id))
    .orderBy(asc(runLevelProgress.levelNumber));
  const strongestScoreByLevel = new Map(progressRows.map((row) => [row.levelId, row.bestScore ?? null]));
  const attemptRows = await executor
    .select()
    .from(levelAttempts)
    .where(eq(levelAttempts.runId, run.id))
    .orderBy(asc(levelAttempts.createdAt), asc(levelAttempts.attemptCycle), asc(levelAttempts.attemptNumber));
  const session: GameSessionSnapshot = {
    progress: {
      playerId: player.id,
      runId: run.id,
      currentLevelId: run.currentLevelId,
      highestUnlockedLevelNumber: run.highestUnlockedLevelNumber,
      totalAttemptsUsed: run.totalAttemptsUsed,
      canResume: run.totalAttemptsUsed > 0 || progressRows.some((row) => row.firstCompletedAt != null),
      lastActiveAt: run.lastActiveAt.toISOString(),
      levels: progressRows.map((row) => ({
        levelId: row.levelId,
        status: row.status,
        currentAttemptCycle: row.currentAttemptCycle,
        attemptsUsed: row.attemptsUsedInCycle,
        attemptsRemaining: Math.max((getLevelMap(levels).get(row.levelId)?.maxAttempts ?? 0) - row.attemptsUsedInCycle, 0),
        bestScore: row.bestScore,
        strongestAttemptId: row.strongestAttemptId ?? null,
        unlockedAt: toIsoString(row.unlockedAt),
        completedAt: toIsoString(row.firstCompletedAt),
        lastCompletedAt: toIsoString(row.lastCompletedAt),
        lastAttemptedAt: toIsoString(row.lastAttemptedAt),
      })),
    },
    attempts: attemptRows.map((attempt) => buildLevelAttempt(attempt, strongestScoreByLevel.get(attempt.levelId) ?? null)),
  };

  return {
    playerId: player.id,
    session,
  };
}

async function persistSession(
  executor: SessionPersistenceExecutor,
  sessionTokenHash: string,
  session: GameSessionSnapshot,
  sessionExpiresAt: Date,
  levels: Level[] = defaultLevels,
) {
  const now = toDate(session.progress.lastActiveAt) ?? new Date();
  const levelsById = getLevelMap(levels);
  const currentLevelNumber = getCurrentLevelNumber(session.progress.currentLevelId, levelsById);

  await executor
    .insert(anonymousPlayers)
    .values({
      id: session.progress.playerId,
      sessionTokenHash,
      sessionExpiresAt,
      createdAt: now,
      lastActiveAt: now,
    })
    .onConflictDoUpdate({
      target: anonymousPlayers.id,
      set: {
        sessionTokenHash,
        sessionExpiresAt,
        lastActiveAt: now,
      },
    });

  await executor
    .insert(gameRuns)
    .values({
      id: session.progress.runId,
      playerId: session.progress.playerId,
      status: getRunStatus(session),
      currentLevelId: session.progress.currentLevelId,
      currentLevelNumber,
      highestUnlockedLevelNumber: session.progress.highestUnlockedLevelNumber,
      highestCompletedLevelNumber: getHighestCompletedLevelNumber(session.progress.levels, levelsById),
      totalAttemptsUsed: session.progress.totalAttemptsUsed,
      startedAt: now,
      lastActiveAt: now,
      completedAt: session.progress.currentLevelId === null ? now : null,
    })
    .onConflictDoUpdate({
      target: gameRuns.id,
      set: {
        playerId: session.progress.playerId,
        status: getRunStatus(session),
        currentLevelId: session.progress.currentLevelId,
        currentLevelNumber,
        highestUnlockedLevelNumber: session.progress.highestUnlockedLevelNumber,
        highestCompletedLevelNumber: getHighestCompletedLevelNumber(session.progress.levels, levelsById),
        totalAttemptsUsed: session.progress.totalAttemptsUsed,
        lastActiveAt: now,
        completedAt: session.progress.currentLevelId === null ? now : null,
      },
    });

  await executor.delete(runLevelProgress).where(eq(runLevelProgress.runId, session.progress.runId));
  const progressRows = buildProgressRows(session, now, levelsById);

  if (progressRows.length > 0) {
    await executor.insert(runLevelProgress).values(progressRows);
  }

  await executor.delete(levelAttempts).where(eq(levelAttempts.runId, session.progress.runId));
  const attemptRows = buildAttemptRows(session, levelsById);

  if (attemptRows.length > 0) {
    await executor.insert(levelAttempts).values(attemptRows);
  }
}

export function canUseDatabasePersistence() {
  return hasDatabaseUrl();
}

export async function loadDatabaseSession(
  sessionTokenHash: string,
  levels: Level[] = defaultLevels,
  options?: { lockRun?: boolean },
) {
  return loadPersistedSession(getDatabase(), sessionTokenHash, levels, options);
}

export async function persistDatabaseSession(
  sessionTokenHash: string,
  session: GameSessionSnapshot,
  sessionExpiresAt: Date,
  levels: Level[] = defaultLevels,
) {
  return getDatabase().transaction(async (tx) => {
    return persistSession(tx, sessionTokenHash, session, sessionExpiresAt, levels);
  });
}

export async function mutateDatabaseSession<T>(
  sessionTokenHash: string,
  createSession: (existingPlayerId?: string | null) => GameSessionSnapshot,
  mutate: (session: GameSessionSnapshot) => Promise<{ session: GameSessionSnapshot; value: T }> | { session: GameSessionSnapshot; value: T },
  sessionExpiresAt: Date,
  levels: Level[] = defaultLevels,
) {
  return getDatabase().transaction(async (tx) => {
    const loaded = await loadPersistedSession(tx, sessionTokenHash, levels, { lockRun: true });
    const currentSession = loaded.session ?? createSession(loaded.playerId);
    const result = await mutate(currentSession);

    await persistSession(tx, sessionTokenHash, result.session, sessionExpiresAt, levels);

    return {
      created: loaded.session == null,
      session: result.session,
      value: result.value,
    };
  });
}
