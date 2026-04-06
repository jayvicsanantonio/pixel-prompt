import { createHash, randomUUID } from "node:crypto";

import {
  canUseDatabasePersistence,
  loadDatabaseSession,
  mutateDatabaseSession,
  persistDatabaseSession,
} from "./session-persistence";
import { createGameSession, type GameSessionSnapshot } from "./session-state";

export const SESSION_COOKIE_NAME = "pp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

declare global {
  var __pixelPromptSessionStore__: Map<string, GameSessionSnapshot> | undefined;
  var __pixelPromptSessionLocks__: Map<string, Promise<void>> | undefined;
}

function getSessionStore() {
  if (!globalThis.__pixelPromptSessionStore__) {
    globalThis.__pixelPromptSessionStore__ = new Map<string, GameSessionSnapshot>();
  }

  return globalThis.__pixelPromptSessionStore__;
}

function getSessionLocks() {
  if (!globalThis.__pixelPromptSessionLocks__) {
    globalThis.__pixelPromptSessionLocks__ = new Map<string, Promise<void>>();
  }

  return globalThis.__pixelPromptSessionLocks__;
}

function getSessionExpiryDate(now = new Date()) {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}

function createSessionSnapshot(existingPlayerId?: string | null) {
  return createGameSession({
    playerId: existingPlayerId ?? randomUUID(),
    runId: randomUUID(),
  });
}

async function withSessionLock<T>(tokenHash: string, operation: () => Promise<T>) {
  const locks = getSessionLocks();
  const previousLock = locks.get(tokenHash) ?? Promise.resolve();
  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const queuedLock = previousLock.catch(() => undefined).then(() => currentLock);

  locks.set(tokenHash, queuedLock);
  await previousLock.catch(() => undefined);

  try {
    return await operation();
  } finally {
    releaseLock();

    if (locks.get(tokenHash) === queuedLock) {
      locks.delete(tokenHash);
    }
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomUUID();
}

export async function getSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token);

  if (canUseDatabasePersistence()) {
    return (await loadDatabaseSession(tokenHash)).session;
  }

  return getSessionStore().get(tokenHash) ?? null;
}

export async function getOrCreateSession(token?: string) {
  const existingToken = token;

  if (canUseDatabasePersistence()) {
    const nextToken = existingToken ?? createSessionToken();
    const loaded = await loadDatabaseSession(hashSessionToken(nextToken));

    if (loaded.session) {
      return {
        token: nextToken,
        session: loaded.session,
        created: false,
      };
    }

    const nextSession = createSessionSnapshot(loaded.playerId);

    await persistDatabaseSession(hashSessionToken(nextToken), nextSession, getSessionExpiryDate());

    return {
      token: nextToken,
      session: nextSession,
      created: true,
    };
  }

  if (existingToken) {
    const existingSession = getSessionStore().get(hashSessionToken(existingToken)) ?? null;

    if (existingSession) {
      return {
        token: existingToken,
        session: existingSession,
        created: false,
      };
    }
  }

  const nextToken = existingToken ?? createSessionToken();
  const nextSession = createSessionSnapshot();
  getSessionStore().set(hashSessionToken(nextToken), nextSession);

  return {
    token: nextToken,
    session: nextSession,
    created: true,
  };
}

export async function mutateSession<T>(
  token: string | undefined,
  mutate: (session: GameSessionSnapshot) => Promise<{ session: GameSessionSnapshot; value: T }> | { session: GameSessionSnapshot; value: T },
) {
  const sessionToken = token ?? createSessionToken();
  const tokenHash = hashSessionToken(sessionToken);

  if (canUseDatabasePersistence()) {
    const result = await mutateDatabaseSession(
      tokenHash,
      (existingPlayerId) => createSessionSnapshot(existingPlayerId),
      mutate,
      getSessionExpiryDate(),
    );

    return {
      token: sessionToken,
      created: result.created,
      session: result.session,
      value: result.value,
    };
  }

  return withSessionLock(tokenHash, async () => {
    const hadExistingSession = getSessionStore().has(tokenHash);
    const currentSession = getSessionStore().get(tokenHash) ?? createSessionSnapshot();
    const result = await mutate(currentSession);

    getSessionStore().set(tokenHash, result.session);

    return {
      token: sessionToken,
      created: !hadExistingSession,
      session: result.session,
      value: result.value,
    };
  });
}

export function getSessionCookieAttributes() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function resetSessionStoreForTests() {
  getSessionStore().clear();
  getSessionLocks().clear();
}
