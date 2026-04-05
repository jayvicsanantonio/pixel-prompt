import { createHash, randomUUID } from "node:crypto";

import { createGameSession, type GameSessionSnapshot } from "./session-state";

export const SESSION_COOKIE_NAME = "pp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

declare global {
  var __pixelPromptSessionStore__: Map<string, GameSessionSnapshot> | undefined;
}

function getSessionStore() {
  if (!globalThis.__pixelPromptSessionStore__) {
    globalThis.__pixelPromptSessionStore__ = new Map<string, GameSessionSnapshot>();
  }

  return globalThis.__pixelPromptSessionStore__;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomUUID();
}

export function getSessionByToken(token: string) {
  return getSessionStore().get(hashSessionToken(token)) ?? null;
}

export function saveSession(token: string, session: GameSessionSnapshot) {
  getSessionStore().set(hashSessionToken(token), session);
}

export function getOrCreateSession(token?: string) {
  if (token) {
    const existingSession = getSessionByToken(token);

    if (existingSession) {
      return {
        token,
        session: existingSession,
        created: false,
      };
    }
  }

  const nextToken = createSessionToken();
  const session = createGameSession({
    playerId: randomUUID(),
    runId: randomUUID(),
  });
  saveSession(nextToken, session);

  return {
    token: nextToken,
    session,
    created: true,
  };
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
}
