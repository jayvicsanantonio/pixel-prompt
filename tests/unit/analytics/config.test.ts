import { beforeEach, describe, expect, it } from "vitest";

import { getAnalyticsConfig, resolveAnalyticsDistinctId, toAnalyticsCaptureInput } from "@/lib/analytics";

describe("analytics configuration", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("returns null when analytics env is unset", () => {
    expect(getAnalyticsConfig()).toBeNull();
  });

  it("builds a capture payload from the typed event shape", () => {
    const payload = toAnalyticsCaptureInput({
      name: "landing_viewed",
      occurredAt: "2026-03-29T08:00:00.000Z",
      anonymousPlayerId: "anon_123",
    });

    expect(payload).toEqual({
      distinctId: "anon_123",
      event: "landing_viewed",
      properties: {
        occurredAt: "2026-03-29T08:00:00.000Z",
        anonymousPlayerId: "anon_123",
      },
    });
  });

  it("creates a stable browser-session distinct id when no identity is available", () => {
    const event = {
      name: "landing_viewed" as const,
      occurredAt: "2026-03-29T08:00:00.000Z",
    };

    const first = resolveAnalyticsDistinctId(event);
    const second = resolveAnalyticsDistinctId(event);

    expect(first).toMatch(/^session:/);
    expect(second).toBe(first);
  });
});
