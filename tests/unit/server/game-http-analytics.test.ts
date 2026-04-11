import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureServerAnalyticsEvents } = vi.hoisted(() => ({
  captureServerAnalyticsEvents: vi.fn(),
}));

vi.mock("@/server/analytics", () => ({
  captureServerAnalyticsEvents,
}));

import { GET as getResumeProgress } from "@/app/api/game/resume-progress/route";
import { POST as postSubmitAttempt } from "@/app/api/game/submit-attempt/route";
import { getOrCreateSession, resetSessionStoreForTests, SESSION_COOKIE_NAME } from "@/server/game/session-store";
import { seedMockTargetAssets } from "@/server/providers";

async function createSessionToken() {
  const { token } = await getOrCreateSession();
  return token;
}

async function flushBackgroundAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("game http analytics", () => {
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
  const originalTargetAssetDir = process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
  let generatedOutputDir = "";
  let targetAssetDir = "";

  beforeEach(() => {
    resetSessionStoreForTests();
    captureServerAnalyticsEvents.mockReset();
  });

  beforeEach(async () => {
    generatedOutputDir = path.join(process.cwd(), ".tmp", `vitest-analytics-generated-${Date.now()}`);
    targetAssetDir = path.join(process.cwd(), ".tmp", `vitest-analytics-targets-${Date.now()}`);
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = generatedOutputDir;
    process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = targetAssetDir;
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });
    await seedMockTargetAssets(targetAssetDir, ["level-1", "level-2", "level-3"]);
  });

  afterEach(async () => {
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });

    if (originalGeneratedOutputDir === undefined) {
      delete process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
    } else {
      process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = originalGeneratedOutputDir;
    }

    if (originalTargetAssetDir === undefined) {
      delete process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
    } else {
      process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = originalTargetAssetDir;
    }
  });

  it("emits landing and resume-offered events from resume-progress", async () => {
    const sessionToken = await createSessionToken();

    await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "vague",
        }),
      }),
    );
    await flushBackgroundAnalytics();

    captureServerAnalyticsEvents.mockClear();

    const response = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "landing_viewed",
        runId: expect.any(String),
      }),
      expect.objectContaining({
        name: "resume_offered",
        levelId: "level-1",
        levelNumber: 1,
      }),
    ]);
  });

  it("emits validation-failed analytics for invalid prompts on an existing run", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "   ",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_validation_failed",
        reason: "empty",
        levelId: "level-1",
      }),
    ]);
  });

  it("emits submission, provider, attempt, and level-completion events for a passing attempt", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life of pears and a bottle on a wooden table",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0].map((event: { name: string }) => event.name)).toEqual([
      "prompt_submitted",
      "generation_completed",
      "scoring_completed",
      "attempt_resolved",
      "level_completed",
    ]);
  });

  it("emits prompt submission and generation failure telemetry for technical failures", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #timeout",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: false,
        failureKind: "timeout",
      }),
    ]);
  });

  it("emits rate-limit telemetry when generation is rate-limited", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #rate-limit",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: false,
        failureKind: "rate_limited",
      }),
    ]);
  });

  it("emits interrupted failure telemetry when a provider request is interrupted", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #interrupt",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: false,
        failureKind: "interrupted",
      }),
    ]);
  });

  it("emits scoring rejection telemetry for content-policy failures after generation succeeds", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #score-policy",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: true,
        failureKind: undefined,
      }),
      expect.objectContaining({
        name: "scoring_completed",
        success: false,
        failureKind: "content_policy_rejection",
      }),
    ]);
  });

  it("emits scoring rate-limit telemetry after generation succeeds", async () => {
    const sessionToken = await createSessionToken();

    const response = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #score-rate-limit",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        name: "prompt_submitted",
      }),
      expect.objectContaining({
        name: "generation_completed",
        success: true,
        failureKind: undefined,
      }),
      expect.objectContaining({
        name: "scoring_completed",
        success: false,
        failureKind: "rate_limited",
      }),
    ]);
  });

  it("emits run completion on the final cleared level", async () => {
    const sessionToken = await createSessionToken();

    await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life of pears and a bottle on a wooden table",
        }),
      }),
    );
    await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-2",
          promptText: "cinematic neon portrait in a wet alley at midnight with urban signs",
        }),
      }),
    );
    await flushBackgroundAnalytics();

    captureServerAnalyticsEvents.mockClear();

    const finalResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-3",
          promptText: "historical ornate stone courtyard with layered arches and warm architecture",
        }),
      }),
    );

    expect(finalResponse.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
    expect(captureServerAnalyticsEvents.mock.calls[0]?.[0].map((event: { name: string }) => event.name)).toEqual([
      "prompt_submitted",
      "generation_completed",
      "scoring_completed",
      "attempt_resolved",
      "level_completed",
      "run_completed",
    ]);
  });

  it("does not emit duplicate analytics for concurrent idempotent retries", async () => {
    const sessionToken = await createSessionToken();

    const [firstResponse, duplicateResponse] = await Promise.all([
      postSubmitAttempt(
        new Request("http://localhost/api/game/submit-attempt", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          },
          body: JSON.stringify({
            levelId: "level-1",
            promptText: "vague",
          }),
        }),
      ),
      postSubmitAttempt(
        new Request("http://localhost/api/game/submit-attempt", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          },
          body: JSON.stringify({
            levelId: "level-1",
            promptText: "vague",
          }),
        }),
      ),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(200);
    await flushBackgroundAnalytics();
    expect(captureServerAnalyticsEvents).toHaveBeenCalledTimes(1);
  });
});
