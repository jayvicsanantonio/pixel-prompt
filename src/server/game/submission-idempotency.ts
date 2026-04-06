declare global {
  var __pixelPromptPendingSubmissions__: Map<string, Promise<unknown>> | undefined;
}

function getPendingSubmissionStore() {
  if (!globalThis.__pixelPromptPendingSubmissions__) {
    globalThis.__pixelPromptPendingSubmissions__ = new Map<string, Promise<unknown>>();
  }

  return globalThis.__pixelPromptPendingSubmissions__;
}

export function createSubmissionDedupKey(sessionToken: string | undefined, levelId: string, promptText: string) {
  if (!sessionToken) {
    return null;
  }

  return `${sessionToken}:${levelId}:${promptText}`;
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
