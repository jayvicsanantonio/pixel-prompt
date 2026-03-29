import { describe, expect, it } from "vitest";

import { getAnalyticsClientConfig, getAnalyticsServerConfig, toAnalyticsCaptureInput } from "@/lib/analytics";

describe("analytics configuration", () => {
  it("returns null when analytics env is unset", () => {
    expect(getAnalyticsClientConfig()).toBeNull();
    expect(getAnalyticsServerConfig()).toBeNull();
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
});
