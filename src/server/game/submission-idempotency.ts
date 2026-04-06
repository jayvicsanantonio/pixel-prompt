import { createHash } from "node:crypto";

declare global {
  var __pixelPromptPendingSubmissions__: Map<string, Promise<unknown>> | undefined;
}

function getPendingSubmissionStore() {
  if (!globalThis.__pixelPromptPendingSubmissions__) {
    globalThis.__pixelPromptPendingSubmissions__ = new Map<string, Promise<unknown>>();
  }

  return globalThis.__pixelPromptPendingSubmissions__;
}

function getFirstHeaderValue(headers: Headers, headerNames: string[]) {
  for (const headerName of headerNames) {
    const value = headers.get(headerName);

    if (value) {
      return value;
    }
  }

  return null;
}

function hashKeyPart(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getAnonymousRequestFingerprint(request: Request) {
  const forwardedFor = getFirstHeaderValue(request.headers, ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"]) ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const clientHints = getFirstHeaderValue(request.headers, ["sec-ch-ua", "sec-ch-ua-platform"]) ?? "";

  return hashKeyPart(`${forwardedFor}|${userAgent}|${acceptLanguage}|${clientHints}`);
}

export function createSubmissionDedupKey(input: {
  levelId: string;
  promptText: string;
  request: Request;
  sessionToken?: string;
}) {
  const clientScope = input.sessionToken ? `session:${input.sessionToken}` : `anonymous:${getAnonymousRequestFingerprint(input.request)}`;
  const promptScope = hashKeyPart(input.promptText);

  return `${clientScope}:${input.levelId}:${promptScope}`;
}

export async function withPendingSubmissionDedup<T>(key: string | null, operation: () => Promise<T>) {
  if (!key) {
    return operation();
  }

  const store = getPendingSubmissionStore();
  const existing = store.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const pending = operation().finally(() => {
    if (store.get(key) === pending) {
      store.delete(key);
    }
  });

  store.set(key, pending);

  return pending;
}
