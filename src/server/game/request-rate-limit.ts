import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase, hasDatabaseUrl, requestRateLimitBuckets } from "@/server/db";
import { hashSessionToken } from "./session-store";

export type RateLimitScopeType = "session" | "anonymous_fingerprint";

type RateLimitedAction = "submit_attempt";

interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

interface RateLimitScope {
  key: string;
  type: RateLimitScopeType;
}

interface RateLimitBucketState {
  requestCount: number;
  updatedAtMs: number;
  windowStartedAtMs: number;
}

interface RateLimitAllowance {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  scopeType: RateLimitScopeType;
  windowSeconds: number;
}

declare global {
  var __pixelPromptRequestRateLimitStore__: Map<string, RateLimitBucketState> | undefined;
}

const DEFAULT_SUBMIT_ATTEMPT_BURST_LIMIT = 8;
const DEFAULT_SUBMIT_ATTEMPT_BURST_WINDOW_SECONDS = 60;
const DEFAULT_SUBMIT_ATTEMPT_SUSTAINED_LIMIT = 30;
const DEFAULT_SUBMIT_ATTEMPT_SUSTAINED_WINDOW_SECONDS = 600;

type RateLimitExecutor = Pick<ReturnType<typeof getDatabase>, "execute" | "insert" | "select" | "update">;

function getRateLimitStore() {
  if (!globalThis.__pixelPromptRequestRateLimitStore__) {
    globalThis.__pixelPromptRequestRateLimitStore__ = new Map<string, RateLimitBucketState>();
  }

  return globalThis.__pixelPromptRequestRateLimitStore__;
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

function parsePositiveIntegerEnv(name: string, fallbackValue: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return parsed;
}

function getSubmitAttemptPolicies() {
  return [
    {
      limit: parsePositiveIntegerEnv(
        "PIXEL_PROMPT_SUBMIT_RATE_LIMIT_BURST_MAX",
        DEFAULT_SUBMIT_ATTEMPT_BURST_LIMIT,
      ),
      windowSeconds: parsePositiveIntegerEnv(
        "PIXEL_PROMPT_SUBMIT_RATE_LIMIT_BURST_WINDOW_SECONDS",
        DEFAULT_SUBMIT_ATTEMPT_BURST_WINDOW_SECONDS,
      ),
    },
    {
      limit: parsePositiveIntegerEnv(
        "PIXEL_PROMPT_SUBMIT_RATE_LIMIT_SUSTAINED_MAX",
        DEFAULT_SUBMIT_ATTEMPT_SUSTAINED_LIMIT,
      ),
      windowSeconds: parsePositiveIntegerEnv(
        "PIXEL_PROMPT_SUBMIT_RATE_LIMIT_SUSTAINED_WINDOW_SECONDS",
        DEFAULT_SUBMIT_ATTEMPT_SUSTAINED_WINDOW_SECONDS,
      ),
    },
  ].sort((left, right) => left.windowSeconds - right.windowSeconds);
}

function getAnonymousRequestFingerprint(request: Request) {
  const forwardedFor = getFirstHeaderValue(request.headers, ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"]) ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const clientHints = getFirstHeaderValue(request.headers, ["sec-ch-ua", "sec-ch-ua-platform"]) ?? "";

  return hashKeyPart(`${forwardedFor}|${userAgent}|${acceptLanguage}|${clientHints}`);
}

function resolveRateLimitScope(request: Request, sessionToken?: string): RateLimitScope {
  if (sessionToken) {
    return {
      key: `session:${hashSessionToken(sessionToken)}`,
      type: "session",
    };
  }

  return {
    key: `anonymous:${getAnonymousRequestFingerprint(request)}`,
    type: "anonymous_fingerprint",
  };
}

function buildBucketKey(scope: RateLimitScope, action: RateLimitedAction, policy: RateLimitPolicy) {
  return `${scope.key}:${action}:${policy.windowSeconds}`;
}

function calculateAllowance(input: {
  now: Date;
  policy: RateLimitPolicy;
  requestCount: number;
  scopeType: RateLimitScopeType;
  windowStartedAt: Date;
}) {
  const nowMs = input.now.getTime();
  const windowMs = input.policy.windowSeconds * 1000;
  const windowStartedAtMs = input.windowStartedAt.getTime();
  const retryAfterSeconds =
    input.requestCount > input.policy.limit
      ? Math.max(1, Math.ceil((windowStartedAtMs + windowMs - nowMs) / 1000))
      : 0;

  return {
    allowed: input.requestCount <= input.policy.limit,
    limit: input.policy.limit,
    remaining: Math.max(input.policy.limit - input.requestCount, 0),
    retryAfterSeconds,
    scopeType: input.scopeType,
    windowSeconds: input.policy.windowSeconds,
  } satisfies RateLimitAllowance;
}

function pruneMemoryBuckets(nowMs: number, maxWindowSeconds: number) {
  const store = getRateLimitStore();
  const oldestAllowedUpdatedAtMs = nowMs - maxWindowSeconds * 2 * 1000;

  for (const [key, bucket] of store.entries()) {
    if (bucket.updatedAtMs < oldestAllowedUpdatedAtMs) {
      store.delete(key);
    }
  }
}

function consumeMemoryAllowance(input: {
  action: RateLimitedAction;
  now: Date;
  policies: RateLimitPolicy[];
  scope: RateLimitScope;
}) {
  const nowMs = input.now.getTime();
  const maxWindowSeconds = input.policies.reduce((maximum, policy) => Math.max(maximum, policy.windowSeconds), 0);
  pruneMemoryBuckets(nowMs, maxWindowSeconds);
  const store = getRateLimitStore();
  const allowances = input.policies.map((policy) => {
    const bucketKey = buildBucketKey(input.scope, input.action, policy);
    const bucket = store.get(bucketKey);
    const windowMs = policy.windowSeconds * 1000;
    const withinWindow = bucket != null && nowMs - bucket.windowStartedAtMs < windowMs;
    const requestCount = withinWindow ? bucket.requestCount + 1 : 1;
    const windowStartedAtMs = withinWindow ? bucket.windowStartedAtMs : nowMs;

    store.set(bucketKey, {
      requestCount,
      updatedAtMs: nowMs,
      windowStartedAtMs,
    });

    return calculateAllowance({
      now: input.now,
      policy,
      requestCount,
      scopeType: input.scope.type,
      windowStartedAt: new Date(windowStartedAtMs),
    });
  });

  return allowances.reduce<RateLimitAllowance | null>((selected, allowance) => {
    if (allowance.allowed) {
      return selected;
    }

    if (selected == null) {
      return allowance;
    }

    if (allowance.retryAfterSeconds > selected.retryAfterSeconds) {
      return allowance;
    }

    if (allowance.retryAfterSeconds === selected.retryAfterSeconds && allowance.windowSeconds > selected.windowSeconds) {
      return allowance;
    }

    return selected;
  }, null);
}

async function lockRateLimitBucket(executor: RateLimitExecutor, bucketKey: string) {
  await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${bucketKey}), 1)`);
}

async function consumeDatabaseAllowance(input: {
  action: RateLimitedAction;
  now: Date;
  policies: RateLimitPolicy[];
  scope: RateLimitScope;
}) {
  return getDatabase().transaction(async (tx) => {
    const blockedAllowances: RateLimitAllowance[] = [];

    for (const policy of input.policies) {
      const bucketKey = buildBucketKey(input.scope, input.action, policy);
      await lockRateLimitBucket(tx, bucketKey);

      const existingBucket = await tx
        .select()
        .from(requestRateLimitBuckets)
        .where(
          and(
            eq(requestRateLimitBuckets.scopeKey, input.scope.key),
            eq(requestRateLimitBuckets.action, input.action),
            eq(requestRateLimitBuckets.windowSeconds, policy.windowSeconds),
          ),
        )
        .limit(1);
      const bucket = existingBucket[0];
      const windowMs = policy.windowSeconds * 1000;
      const windowStartedAt =
        bucket != null && input.now.getTime() - bucket.windowStartedAt.getTime() < windowMs
          ? bucket.windowStartedAt
          : input.now;
      const requestCount =
        bucket != null && input.now.getTime() - bucket.windowStartedAt.getTime() < windowMs
          ? bucket.requestCount + 1
          : 1;

      if (bucket == null) {
        await tx.insert(requestRateLimitBuckets).values({
          scopeKey: input.scope.key,
          scopeType: input.scope.type,
          action: input.action,
          windowSeconds: policy.windowSeconds,
          requestCount,
          windowStartedAt,
          createdAt: input.now,
          updatedAt: input.now,
        });
      } else {
        await tx
          .update(requestRateLimitBuckets)
          .set({
            requestCount,
            scopeType: input.scope.type,
            windowStartedAt,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(requestRateLimitBuckets.scopeKey, input.scope.key),
              eq(requestRateLimitBuckets.action, input.action),
              eq(requestRateLimitBuckets.windowSeconds, policy.windowSeconds),
            ),
          );
      }

      const allowance = calculateAllowance({
        now: input.now,
        policy,
        requestCount,
        scopeType: input.scope.type,
        windowStartedAt,
      });

      if (!allowance.allowed) {
        blockedAllowances.push(allowance);
      }
    }

    return blockedAllowances.reduce<RateLimitAllowance | null>((selected, allowance) => {
      if (selected == null) {
        return allowance;
      }

      if (allowance.retryAfterSeconds > selected.retryAfterSeconds) {
        return allowance;
      }

      if (allowance.retryAfterSeconds === selected.retryAfterSeconds && allowance.windowSeconds > selected.windowSeconds) {
        return allowance;
      }

      return selected;
    }, null);
  });
}

export async function consumeSubmitAttemptRateLimit(request: Request, sessionToken?: string) {
  const policies = getSubmitAttemptPolicies();
  const scope = resolveRateLimitScope(request, sessionToken);
  const now = new Date();

  if (!hasDatabaseUrl()) {
    return consumeMemoryAllowance({
      action: "submit_attempt",
      now,
      policies,
      scope,
    });
  }

  return consumeDatabaseAllowance({
    action: "submit_attempt",
    now,
    policies,
    scope,
  });
}

export function resetRequestRateLimitStoreForTests() {
  getRateLimitStore().clear();
}
