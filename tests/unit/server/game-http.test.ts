import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postReplayLevel } from "@/app/api/game/replay-level/route";
import { POST as postRestartLevel } from "@/app/api/game/restart-level/route";
import { GET as getResumeProgress } from "@/app/api/game/resume-progress/route";
import { POST as postSubmitAttempt } from "@/app/api/game/submit-attempt/route";
import { MOCK_IMAGE_PNG_BASE64, seedMockTargetAssets } from "@/server/providers";
import type { ImageGenerationProvider } from "@/server/providers/contracts";
import { getOrCreateSession, mutateSession, resetSessionStoreForTests, SESSION_COOKIE_NAME } from "@/server/game/session-store";
import * as imageGenerationProviderModule from "@/server/providers/image-generation";

function getCookieHeader(response: Response) {
  return response.headers.get("set-cookie");
}

function getSessionTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  return match?.[1] ?? null;
}

async function createSessionToken() {
  const { token } = await getOrCreateSession();
  return token;
}

async function submitAttempt(sessionToken: string, levelId: string, promptText: string) {
  return postSubmitAttempt(
    new Request("http://localhost/api/game/submit-attempt", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        levelId,
        promptText,
      }),
    }),
  );
}

describe("game http handlers", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEnableOpenAiInTests = process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;
  const originalEnableOpenAiScoring = process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING;
  const originalGeneratedOutputDir = process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR;
  const originalTargetAssetDir = process.env.PIXEL_PROMPT_TARGET_ASSET_DIR;
  let generatedOutputDir = "";
  let targetAssetDir = "";

  beforeEach(async () => {
    generatedOutputDir = path.join(process.cwd(), ".tmp", `vitest-generated-${Date.now()}`);
    targetAssetDir = path.join(process.cwd(), ".tmp", `vitest-targets-${Date.now()}`);
    process.env.PIXEL_PROMPT_GENERATED_OUTPUT_DIR = generatedOutputDir;
    process.env.PIXEL_PROMPT_TARGET_ASSET_DIR = targetAssetDir;
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });
    await seedMockTargetAssets(targetAssetDir, ["level-1"]);
    resetSessionStoreForTests();
  });

  afterEach(async () => {
    await rm(generatedOutputDir, { recursive: true, force: true });
    await rm(targetAssetDir, { recursive: true, force: true });

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalEnableOpenAiInTests === undefined) {
      delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION;
    } else {
      process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = originalEnableOpenAiInTests;
    }

    if (originalEnableOpenAiScoring === undefined) {
      delete process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING;
    } else {
      process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING = originalEnableOpenAiScoring;
    }

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

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the empty resume payload without creating a session", async () => {
    const response = await getResumeProgress(new Request("http://localhost/api/game/resume-progress"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCookieHeader(response)).toBeNull();
    expect(body).toMatchObject({
      ok: true,
      landing: {
        startHref: "/play?level=1",
        resume: {
          available: false,
          href: "/play?level=1",
          currentLevelNumber: null,
          attemptsRemaining: 0,
        },
      },
      currentLevel: {
        id: "level-1",
        number: 1,
      },
      progress: null,
    });
  });

  it("rejects invalid prompt submissions without consuming attempts", async () => {
    const sessionToken = await createSessionToken();

    const invalidResponse = await postSubmitAttempt(
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

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "empty_prompt",
    });

    const resumedResponse = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );
    const resumedBody = await resumedResponse.json();

    expect(resumedBody.progress.totalAttemptsUsed).toBe(0);
    expect(resumedBody.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      attemptsUsed: 0,
      attemptsRemaining: 3,
    });
  });

  it("rejects over-limit prompts without consuming attempts", async () => {
    const sessionToken = await createSessionToken();

    const invalidResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "a".repeat(121),
        }),
      }),
    );

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "prompt_too_long",
    });

    const resumedResponse = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );
    const resumedBody = await resumedResponse.json();

    expect(resumedBody.progress.totalAttemptsUsed).toBe(0);
    expect(resumedBody.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      attemptsUsed: 0,
      attemptsRemaining: 3,
    });
  });

  it("recovers resume and submission flows when stored progress references an unavailable current level", async () => {
    const sessionToken = await createSessionToken();

    const setupSubmitResponse = await submitAttempt(
      sessionToken,
      "level-1",
      "sunlit still life of pears and a bottle on a wooden table",
    );
    expect(setupSubmitResponse.status).toBe(200);
    await expect(setupSubmitResponse.json()).resolves.toMatchObject({
      ok: true,
      transition: "passed",
    });

    await mutateSession(sessionToken, (session) => ({
      session: {
        ...session,
        progress: {
          ...session.progress,
          currentLevelId: "removed-level",
        },
      },
      value: undefined,
    }));

    const resumedResponse = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );
    const resumedBody = await resumedResponse.json();

    expect(resumedResponse.status).toBe(200);
    expect(resumedBody).toMatchObject({
      currentLevel: {
        id: "level-2",
        number: 2,
      },
      landing: {
        resume: {
          available: true,
          href: "/play?level=2&resume=1",
          currentLevelNumber: 2,
        },
      },
    });

    const resumedSubmitResponse = await submitAttempt(
      sessionToken,
      "level-2",
      "cinematic neon portrait in a wet alley at midnight with urban signs",
    );
    const resumedSubmitBody = await resumedSubmitResponse.json();

    expect(resumedSubmitResponse.status).toBe(200);
    expect(resumedSubmitBody).toMatchObject({
      ok: true,
      transition: "passed",
      progress: {
        currentLevelId: "level-3",
        highestUnlockedLevelNumber: 3,
      },
    });
  });

  it("returns a 400 for malformed JSON payloads", async () => {
    const invalidResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{",
      }),
    );

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "invalid_json",
    });
  });

  it("returns a 400 for non-object JSON payloads without minting a session", async () => {
    const invalidResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "null",
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(getCookieHeader(invalidResponse)).toBeNull();
    await expect(invalidResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      message: "Request body must be a JSON object.",
    });
  });

  it("returns a 400 for invalid JSON field types without minting a session", async () => {
    const invalidResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: 123,
        }),
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(getCookieHeader(invalidResponse)).toBeNull();
    await expect(invalidResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      message: "Both levelId and promptText are required.",
    });
  });

  it("ignores malformed cookie segments while reading the session token", async () => {
    const sessionToken = await createSessionToken();
    const response = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `bad-cookie; ${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCookieHeader(response)).toContain(`${SESSION_COOKIE_NAME}=${sessionToken}`);
    expect(body).toMatchObject({
      ok: true,
      progress: {
        currentLevelId: "level-1",
      },
    });
  });

  it("records valid submissions and advances the run state", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "passed",
      attempt: {
        levelId: "level-1",
        consumedAttempt: true,
      },
      currentLevel: {
        id: "level-2",
        number: 2,
      },
      progress: {
        currentLevelId: "level-2",
        highestUnlockedLevelNumber: 2,
        totalAttemptsUsed: 1,
      },
    });
  });

  it("routes submissions through the OpenAI generation provider when explicitly enabled in tests", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = "1";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          created: 1_775_529_600,
          data: [
            {
              b64_json: MOCK_IMAGE_PNG_BASE64,
              revised_prompt: "refined still life prompt",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
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
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.attempt.generation).toMatchObject({
      provider: "openai",
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
      revisedPrompt: "refined still life prompt",
    });
  });

  it("keeps internal scoring reasoning out of the public attempt payload", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION = "1";
    process.env.PIXEL_PROMPT_ENABLE_OPENAI_SCORING = "1";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            created: 1_775_529_600,
            data: [
              {
                b64_json: MOCK_IMAGE_PNG_BASE64,
                revised_prompt: "refined still life prompt",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              normalizedScore: 73,
              reasoning: "Internal scorer note",
              breakdown: {
                medium: 70,
                subject: 74,
                context: 71,
                style: 69,
                materials: 75,
                textures: 72,
                shapes: 73,
                composition: 68,
                time_period: 76,
              },
            }),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
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
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.attempt.result.scoringReasoning).toBeUndefined();
  });

  it("attaches retry tips to scored failed submissions", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "retry",
      attempt: {
        consumedAttempt: true,
        result: {
          tipIds: ["tip-composition-still-life-crop", "tip-context-specificity"],
        },
      },
    });
  });

  it("scores technically successful off-topic prompts as normal failed attempts", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "spaceship battle in deep space",
        }),
      }),
    );
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "retry",
      attempt: {
        consumedAttempt: true,
        result: {
          status: "scored",
          outcome: "failed",
          score: {
            normalized: 35,
            passed: false,
            threshold: 50,
          },
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 1,
      },
    });
  });

  it.each([
    {
      levelId: "level-1",
      promptText: "banana theorem whispers beside cardboard lanterns",
      expectedTipId: "tip-composition-still-life-crop",
    },
    {
      levelId: "level-2",
      promptText: "marble thunder sings under paper bicycles",
      expectedTipId: "tip-context-urban-night",
    },
    {
      levelId: "level-3",
      promptText: "upside-down soup library orbiting velvet ladders",
      expectedTipId: "tip-composition-historical-arches",
    },
  ])(
    "treats nonsensical but valid prompts as scored failed attempts for $levelId",
    async ({ levelId, promptText, expectedTipId }) => {
      const sessionToken = await createSessionToken();
      const unlockAttemptsByLevelId: Record<string, Array<{ levelId: string; promptText: string }>> = {
        "level-1": [],
        "level-2": [
          {
            levelId: "level-1",
            promptText: "sunlit still life of pears and a bottle on a wooden table",
          },
        ],
        "level-3": [
          {
            levelId: "level-1",
            promptText: "sunlit still life of pears and a bottle on a wooden table",
          },
          {
            levelId: "level-2",
            promptText: "cinematic neon portrait in a wet alley at midnight with urban signs",
          },
        ],
      };

      for (const unlockAttempt of unlockAttemptsByLevelId[levelId]) {
        const unlockResponse = await submitAttempt(sessionToken, unlockAttempt.levelId, unlockAttempt.promptText);

        expect(unlockResponse.status).toBe(200);
      }

      const submitResponse = await postSubmitAttempt(
        new Request("http://localhost/api/game/submit-attempt", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          },
          body: JSON.stringify({
            levelId,
            promptText,
          }),
        }),
      );
      const submitBody = await submitResponse.json();

      expect(submitResponse.status).toBe(200);
      expect(submitBody.ok).toBe(true);
      expect(submitBody.transition).toBe("retry");
      expect(submitBody.attempt.consumedAttempt).toBe(true);
      expect(submitBody.attempt.result).toMatchObject({
        status: "scored",
        outcome: "failed",
        tipIds: expect.arrayContaining([expectedTipId]),
        score: {
          passed: false,
        },
      });
      expect(submitBody.attempt.result.score.normalized).toBeLessThan(submitBody.attempt.result.score.threshold);
    },
  );

  it("accepts prompts at the Unicode character limit", async () => {
    const sessionToken = await createSessionToken();
    const emojiPrompt = "🎨".repeat(120);

    const submitResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: emojiPrompt,
        }),
      }),
    );

    expect(submitResponse.status).toBe(200);
    await expect(submitResponse.json()).resolves.toMatchObject({
      ok: true,
      attempt: {
        promptText: emojiPrompt,
      },
    });
  });

  it("does not mint a session cookie for a first submission to the wrong level", async () => {
    const mismatchResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          levelId: "level-2",
          promptText: "sunlit still life",
        }),
      }),
    );

    expect(mismatchResponse.status).toBe(409);
    expect(getCookieHeader(mismatchResponse)).toBeNull();
    await expect(mismatchResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "level_mismatch",
    });
  });

  it("preserves attempts when the mock provider reports a technical failure", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "error",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        result: {
          status: "technical_failure",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("preserves attempts when generation is rate-limited", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "error",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        result: {
          status: "technical_failure",
          failureKind: "rate_limited",
          errorCode: "mock_generation_rate_limit",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("preserves attempts when the mock provider reports a content-policy rejection", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #policy",
        }),
      }),
    );
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "rejected",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        result: {
          status: "content_policy_rejected",
          failureKind: "content_policy_rejection",
          errorCode: "mock_policy_rejection",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("preserves attempts when scoring reports a content-policy rejection", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "rejected",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        generation: {
          assetKey: expect.stringContaining("generated/mock/level-1/"),
        },
        result: {
          status: "content_policy_rejected",
          failureKind: "content_policy_rejection",
          errorCode: "mock_scoring_policy_rejection",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("preserves attempts when scoring is rate-limited after generation succeeds", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "error",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        generation: {
          assetKey: expect.stringContaining("generated/mock/level-1/"),
        },
        result: {
          status: "technical_failure",
          failureKind: "rate_limited",
          errorCode: "mock_scoring_rate_limit",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("preserves attempts when the mock provider reports an interrupted request", async () => {
    const sessionToken = await createSessionToken();

    const submitResponse = await postSubmitAttempt(
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
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "error",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        result: {
          status: "technical_failure",
          failureKind: "interrupted",
          errorCode: "mock_generation_interrupted",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("refunds the attempt when the request disconnects during generation", async () => {
    const sessionToken = await createSessionToken();
    const controller = new AbortController();

    const submitResponsePromise = postSubmitAttempt(
      new Request("http://localhost/api/game/submit-attempt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
          promptText: "sunlit still life #slow",
        }),
        signal: controller.signal,
      }),
    );

    await Promise.resolve();
    controller.abort("client disconnected");

    const submitResponse = await submitResponsePromise;
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody).toMatchObject({
      ok: true,
      transition: "error",
      attempt: {
        levelId: "level-1",
        consumedAttempt: false,
        result: {
          status: "technical_failure",
          failureKind: "interrupted",
          errorCode: "mock_generation_interrupted",
        },
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 0,
      },
    });
  });

  it("requires a restart after the final failed attempt", async () => {
    const sessionToken = await createSessionToken();

    for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
      const response = await postSubmitAttempt(
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

      expect(response.status).toBe(200);
    }

    const blockedResponse = await postSubmitAttempt(
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

    expect(blockedResponse.status).toBe(409);
    await expect(blockedResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "restart_required",
    });
  });

  it("returns a level_changed conflict when the run changes during provider evaluation", async () => {
    const sessionToken = await createSessionToken();
    let resolveGenerationGate = () => {};
    let markGenerationStarted = () => {};
    const generationGate = new Promise<void>((resolve) => {
      resolveGenerationGate = resolve;
    });
    const generationStarted = new Promise<void>((resolve) => {
      markGenerationStarted = resolve;
    });

    vi.spyOn(imageGenerationProviderModule, "getImageGenerationProvider").mockReturnValue({
      providerId: "delayed-mock-image",
      modelRef: {
        provider: "mock",
        model: "delayed-mock-image",
      },
      async generateImage() {
        markGenerationStarted();
        await generationGate;

        return {
          ok: false,
          kind: "technical_failure",
          code: "delayed_mock_generation_failure",
          message: "Delayed mock generation failure.",
          retryable: true,
          consumeAttempt: false,
        };
      },
    } satisfies ImageGenerationProvider);

    const responsePromise = submitAttempt(sessionToken, "level-1", "sunlit still life");

    await generationStarted;
    await mutateSession(sessionToken, (session) => ({
      session: {
        ...session,
        progress: {
          ...session.progress,
          runId: "run-raced",
        },
      },
      value: null,
    }));
    resolveGenerationGate();

    const response = await responsePromise;

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "level_changed",
    });
  });

  it("deduplicates concurrent submissions against the same session", async () => {
    const sessionToken = await createSessionToken();

    const [firstResponse, secondResponse] = await Promise.all([
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
    expect(secondResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(secondBody.attempt.id).toBe(firstBody.attempt.id);

    const resumedResponse = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }),
    );
    const resumedBody = await resumedResponse.json();

    expect(resumedBody.progress.totalAttemptsUsed).toBe(1);
    expect(resumedBody.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      attemptsUsed: 1,
      attemptsRemaining: 2,
    });
  });

  it("deduplicates concurrent first submissions before a session cookie exists", async () => {
    const [firstResponse, secondResponse] = await Promise.all([
      postSubmitAttempt(
        new Request("http://localhost/api/game/submit-attempt", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "pixel-prompt-test",
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
            "user-agent": "pixel-prompt-test",
          },
          body: JSON.stringify({
            levelId: "level-1",
            promptText: "vague",
          }),
        }),
      ),
    ]);
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();
    const firstSessionToken = getSessionTokenFromCookieHeader(getCookieHeader(firstResponse));
    const secondSessionToken = getSessionTokenFromCookieHeader(getCookieHeader(secondResponse));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstBody.attempt.id).toBe(secondBody.attempt.id);
    expect(firstSessionToken).toBeTruthy();
    expect(secondSessionToken).toBe(firstSessionToken);

    const resumedResponse = await getResumeProgress(
      new Request("http://localhost/api/game/resume-progress", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${firstSessionToken}`,
        },
      }),
    );
    const resumedBody = await resumedResponse.json();

    expect(resumedBody.progress.totalAttemptsUsed).toBe(1);
    expect(resumedBody.progress.levels[0]).toMatchObject({
      attemptsUsed: 1,
      attemptsRemaining: 2,
    });
  });

  it("returns the same pass result for concurrent duplicate submissions that advance the run", async () => {
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
            promptText: "sunlit still life of pears and a bottle on a wooden table",
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
            promptText: "sunlit still life of pears and a bottle on a wooden table",
          }),
        }),
      ),
    ]);
    const firstBody = await firstResponse.json();
    const duplicateBody = await duplicateResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(200);
    expect(duplicateBody.attempt.id).toBe(firstBody.attempt.id);
    expect(duplicateBody.transition).toBe("passed");
    expect(duplicateBody.progress.totalAttemptsUsed).toBe(1);
    expect(duplicateBody.progress.currentLevelId).toBe("level-2");
  });

  it("restarts a failed level through the live progress mutation route", async () => {
    const sessionToken = await createSessionToken();

    for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
      const response = await submitAttempt(sessionToken, "level-1", "vague");
      expect(response.status).toBe(200);
    }

    const restartResponse = await postRestartLevel(
      new Request("http://localhost/api/game/restart-level", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-1",
        }),
      }),
    );
    const restartBody = await restartResponse.json();

    expect(restartResponse.status).toBe(200);
    expect(restartBody).toMatchObject({
      ok: true,
      currentLevel: {
        id: "level-1",
        number: 1,
      },
      progress: {
        currentLevelId: "level-1",
        totalAttemptsUsed: 3,
      },
    });
    expect(restartBody.progress.levels[0]).toMatchObject({
      levelId: "level-1",
      status: "in_progress",
      currentAttemptCycle: 2,
      attemptsUsed: 0,
      attemptsRemaining: 3,
    });
  });

  it("replays a cleared level after run completion through the live progress mutation route", async () => {
    const sessionToken = await createSessionToken();

    const passingPrompts = [
      ["level-1", "sunlit still life pears bottle wooden table warm"],
      ["level-2", "cinematic neon portrait in a wet alley at midnight with urban signs"],
      ["level-3", "ornate warm stone courtyard with layered arches and historical architecture"],
    ] as const;

    for (const [levelId, promptText] of passingPrompts) {
      const response = await submitAttempt(sessionToken, levelId, promptText);
      expect(response.status).toBe(200);
    }

    const replayResponse = await postReplayLevel(
      new Request("http://localhost/api/game/replay-level", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({
          levelId: "level-3",
        }),
      }),
    );
    const replayBody = await replayResponse.json();

    expect(replayResponse.status).toBe(200);
    expect(replayBody).toMatchObject({
      ok: true,
      currentLevel: {
        id: "level-3",
        number: 3,
      },
      progress: {
        currentLevelId: "level-3",
        highestUnlockedLevelNumber: 3,
        totalAttemptsUsed: 3,
      },
    });
    expect(replayBody.progress.levels[2]).toMatchObject({
      levelId: "level-3",
      status: "in_progress",
      currentAttemptCycle: 2,
      attemptsUsed: 0,
      attemptsRemaining: 3,
      completedAt: expect.any(String),
    });
  });
});
