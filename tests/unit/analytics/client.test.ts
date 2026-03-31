import { beforeEach, describe, expect, it, vi } from "vitest";

const { capture } = vi.hoisted(() => ({
  capture: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture,
  },
}));

import { captureClientAnalyticsEvent } from "@/lib/analytics/client";

describe("client analytics capture", () => {
  beforeEach(() => {
    capture.mockClear();
    window.sessionStorage.clear();
  });

  it("forwards the resolved distinct id into client event properties", () => {
    captureClientAnalyticsEvent({
      name: "landing_viewed",
      occurredAt: "2026-03-29T08:00:00.000Z",
    });

    expect(capture).toHaveBeenCalledWith(
      "landing_viewed",
      expect.objectContaining({
        distinct_id: expect.stringMatching(/^session:/),
      }),
    );
  });
});
