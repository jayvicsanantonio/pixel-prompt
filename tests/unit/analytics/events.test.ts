import { describe, expect, it } from "vitest";

import { defineAnalyticsEvent } from "@/lib/analytics";

describe("analytics events", () => {
  it("validates gameplay events used for learning and operational metrics", () => {
    const event = defineAnalyticsEvent({
      name: "attempt_resolved",
      occurredAt: "2026-03-29T08:00:00.000Z",
      anonymousPlayerId: "anon_123",
      runId: "run_123",
      levelId: "level-1",
      attemptId: "attempt_123",
      attemptNumber: 2,
      promptLength: 76,
      threshold: 50,
      score: 64,
      passed: true,
      attemptsRemaining: 1,
      strongestAttemptScore: 64,
      tipsShown: true,
      totalDurationMs: 3900,
    });

    expect(event.name).toBe("attempt_resolved");
    expect(event.score).toBe(64);
  });

  it("supports provider failure telemetry without inventing new ad hoc shapes", () => {
    const event = defineAnalyticsEvent({
      name: "generation_completed",
      occurredAt: "2026-03-29T08:00:00.000Z",
      anonymousPlayerId: "anon_123",
      runId: "run_123",
      levelId: "level-2",
      attemptId: "attempt_456",
      provider: "openai",
      model: "gpt-image-1.5",
      durationMs: 4200,
      success: false,
      failureKind: "timeout",
    });

    expect(event.success).toBe(false);
    expect(event.failureKind).toBe("timeout");
  });

  it("keeps resume-offered aligned with level analytics fields", () => {
    const event = defineAnalyticsEvent({
      name: "resume_offered",
      occurredAt: "2026-03-29T08:00:00.000Z",
      anonymousPlayerId: "anon_123",
      runId: "run_123",
      levelId: "level-2",
      levelNumber: 2,
      highestUnlockedLevelNumber: 3,
    });

    expect(event.levelId).toBe("level-2");
    expect(event.levelNumber).toBe(2);
  });
});
