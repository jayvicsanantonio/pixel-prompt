import { beforeEach, describe, expect, it } from "vitest";

import { GET as getResumeProgress } from "@/app/api/game/resume-progress/route";
import { POST as postSubmitAttempt } from "@/app/api/game/submit-attempt/route";
import { resetSessionStoreForTests, SESSION_COOKIE_NAME } from "@/server/game/session-store";

function getCookieHeader(response: Response) {
  return response.headers.get("set-cookie");
}

function getSessionCookieValue(response: Response) {
  const cookieHeader = getCookieHeader(response);

  if (!cookieHeader) {
    throw new Error("Expected a session cookie to be set.");
  }

  const tokenPart = cookieHeader.split(";")[0];

  return tokenPart.slice(`${SESSION_COOKIE_NAME}=`.length);
}

describe("game http handlers", () => {
  beforeEach(() => {
    resetSessionStoreForTests();
  });

  it("creates a cookie-scoped session and returns the empty resume payload", async () => {
    const response = await getResumeProgress(new Request("http://localhost/api/game/resume-progress"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCookieHeader(response)).toContain(`${SESSION_COOKIE_NAME}=`);
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
      progress: {
        currentLevelId: "level-1",
        highestUnlockedLevelNumber: 1,
      },
    });
  });

  it("rejects invalid prompt submissions without consuming attempts", async () => {
    const resumeResponse = await getResumeProgress(new Request("http://localhost/api/game/resume-progress"));
    const sessionToken = getSessionCookieValue(resumeResponse);

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

  it("records valid submissions and advances the run state", async () => {
    const resumeResponse = await getResumeProgress(new Request("http://localhost/api/game/resume-progress"));
    const sessionToken = getSessionCookieValue(resumeResponse);

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

  it("preserves attempts when the mock provider reports a technical failure", async () => {
    const resumeResponse = await getResumeProgress(new Request("http://localhost/api/game/resume-progress"));
    const sessionToken = getSessionCookieValue(resumeResponse);

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
});
