import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureClientAnalyticsEvent } = vi.hoisted(() => ({
  captureClientAnalyticsEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client", () => ({
  captureClientAnalyticsEvent,
}));

import { ActiveLevelScreen } from "@/components/game/active-level-screen";
import { levels } from "@/content";
import { getMockActiveLevelState } from "@/server/game/mock-active-level-state";

describe("ActiveLevelScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    captureClientAnalyticsEvent.mockReset();
  });

  it("renders level metadata, attempts, and the target image study area", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    expect(screen.getByRole("link", { name: "Back to Landing" })).toHaveAttribute("href", "/");
    expect(screen.getByText("1. Sunlit Still Life")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A sunlit still life arranged on a wooden table." })).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
    expect(captureClientAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "level_started",
        runId: "run-mock",
        levelId: "level-1",
      }),
    );
  });

  it("updates the character counter as the player types", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const prompt = screen.getByLabelText("Prompt");

    fireEvent.change(prompt, { target: { value: "warm pears on a sunlit table" } });

    expect(prompt).toHaveValue("warm pears on a sunlit table");
    expect(screen.getByText("28/120 characters")).toBeInTheDocument();
  });

  it("syncs the rendered level and analytics payload when the state prop changes", () => {
    const { rerender } = render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    captureClientAnalyticsEvent.mockClear();

    rerender(
      <ActiveLevelScreen
        state={{
          ...getMockActiveLevelState({ levelNumber: 2, resume: true }),
          promptDraft: "cinematic neon portrait framed by wet reflections",
          analytics: {
            anonymousPlayerId: "player-next",
            runId: "run-next",
          },
        }}
      />,
    );

    expect(screen.getByText("2. Midnight Alley Portrait")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("cinematic neon portrait framed by wet reflections");
    expect(captureClientAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "level_started",
        runId: "run-next",
        levelId: "level-2",
      }),
    );
  });

  it("treats anonymous player changes as distinct level-start dedupe keys when no run exists", () => {
    const initialAnonymousState = {
      ...getMockActiveLevelState(),
      analytics: {
        anonymousPlayerId: "player-anon-a",
      },
    };
    const nextAnonymousState = {
      ...getMockActiveLevelState(),
      analytics: {
        anonymousPlayerId: "player-anon-b",
      },
    };
    const { rerender } = render(<ActiveLevelScreen state={initialAnonymousState} />);

    captureClientAnalyticsEvent.mockClear();
    rerender(<ActiveLevelScreen state={nextAnonymousState} />);

    expect(captureClientAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(captureClientAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "level_started",
        anonymousPlayerId: "player-anon-b",
        levelId: "level-1",
      }),
    );
    expect(captureClientAnalyticsEvent.mock.calls[0]?.[0]).not.toHaveProperty("runId");
  });

  it("opens a larger target study view for closer inspection", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const expandButton = screen.getByRole("button", { name: "Expand Target Image" });
    expandButton.focus();
    fireEvent.click(expandButton);

    const dialog = screen.getByRole("dialog", { name: "Sunlit Still Life" });
    const closeButton = screen.getByRole("button", { name: "Close Study View" });

    expect(dialog).toBeInTheDocument();
    expect(closeButton).toHaveFocus();
    expect(
      screen.getByRole("img", {
        name: "Expanded view of A sunlit still life arranged on a wooden table.",
      }),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Sunlit Still Life" })).not.toBeInTheDocument();
    expect(expandButton).toHaveFocus();
  });

  it("closes the study dialog when the backdrop is clicked", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    fireEvent.click(screen.getByRole("button", { name: "Expand Target Image" }));

    fireEvent.click(screen.getByRole("dialog", { name: "Sunlit Still Life" }));

    expect(screen.queryByRole("dialog", { name: "Sunlit Still Life" })).not.toBeInTheDocument();
  });

  it("preserves the typed draft when validation fails", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const prompt = screen.getByLabelText("Prompt");
    const tooLongPrompt = "a".repeat(121);

    fireEvent.change(prompt, { target: { value: tooLongPrompt } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Keep the prompt at 120 characters or fewer.");
    expect(prompt).toHaveValue(tooLongPrompt);
    expect(screen.getByText("121/120 characters")).toBeInTheDocument();
  });

  it("clears validation state once the draft changes again", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const prompt = screen.getByLabelText("Prompt");

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write a prompt before you submit.");
    expect(prompt).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(prompt, { target: { value: "sunlit pears and a bottle on wood" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(prompt).toHaveAttribute("aria-invalid", "false");
  });

  it("supports keyboard-first submission from the textarea", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const prompt = screen.getByLabelText("Prompt");
    const promptValue = "warm pears and a bottle in afternoon light";

    fireEvent.change(prompt, { target: { value: promptValue } });
    fireEvent.keyDown(prompt, { key: "Enter", metaKey: true });

    expect(screen.getByText("Building your match image")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(promptValue);
    expect(screen.getByRole("button", { name: "Back to Prompt" })).toBeInTheDocument();
  });

  it("submits through the real endpoint and auto-renders the returned score", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          transition: "retry",
          attempt: {
            id: "attempt-live-1",
            runId: "run-1",
            levelId: "level-1",
            attemptCycle: 1,
            attemptNumber: 1,
            promptText: "sunlit pears and a bottle on a wooden table",
            createdAt: "2026-04-07T08:00:00.000Z",
            consumedAttempt: true,
            generation: {
              provider: "mock",
              model: "mock-image",
              assetKey: "generated/level-1/attempt-live-1.png",
            },
            result: {
              status: "scored",
              outcome: "failed",
              strongestAttemptScore: 64,
              tipIds: ["tip-composition-specificity"],
              score: {
                raw: 0.64,
                normalized: 64,
                threshold: 50,
                passed: false,
                breakdown: {
                  composition: 52,
                },
                scorer: {
                  provider: "mock",
                  model: "mock-scorer",
                },
              },
            },
          },
          currentLevel: levels[0],
          landing: {
            startHref: "/play?level=1",
            resume: {
              available: true,
              href: "/play?level=1&resume=1",
              currentLevelNumber: 1,
              currentLevelTitle: "Sunlit Still Life",
              levelsCleared: 0,
              attemptsRemaining: 2,
              bestScore: 64,
              helperText: "Pick up the same run without replaying cleared progress.",
            },
          },
          progress: {
            playerId: "player-1",
            runId: "run-1",
            currentLevelId: "level-1",
            highestUnlockedLevelNumber: 1,
            totalAttemptsUsed: 1,
            canResume: true,
            lastActiveAt: "2026-04-07T08:00:00.000Z",
            levels: [
              {
                levelId: "level-1",
                status: "in_progress",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 64,
                strongestAttemptId: "attempt-live-1",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: "2026-04-07T08:00:00.000Z",
              },
              {
                levelId: "level-2",
                status: "locked",
                currentAttemptCycle: 1,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: null,
                strongestAttemptId: null,
                unlockedAt: null,
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: null,
              },
              {
                levelId: "level-3",
                status: "locked",
                currentAttemptCycle: 1,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: null,
                strongestAttemptId: null,
                unlockedAt: null,
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: null,
              },
            ],
          },
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

    render(<ActiveLevelScreen state={getMockActiveLevelState()} submissionEndpoint="/api/game/submit-attempt" />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "sunlit pears and a bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/submit-attempt",
      expect.objectContaining({
        method: "POST",
      }),
    );

    expect(await screen.findByText("Compare the target against your generated match")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("64%");
    expect(screen.getByText("Needs Retry")).toBeInTheDocument();
  });

  it("surfaces strongest-attempt context from the live failure response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          transition: "failed",
          attempt: {
            id: "attempt-live-2",
            runId: "run-1",
            levelId: "level-2",
            attemptCycle: 1,
            attemptNumber: 3,
            promptText: "cinematic neon portrait in a wet alley at midnight",
            createdAt: "2026-04-07T08:05:00.000Z",
            consumedAttempt: true,
            generation: {
              provider: "mock",
              model: "mock-image",
              assetKey: "generated/level-2/attempt-live-2.png",
            },
            result: {
              status: "scored",
              outcome: "failed",
              strongestAttemptScore: 59,
              tipIds: ["tip-context-urban-night"],
              score: {
                raw: 0.59,
                normalized: 59,
                threshold: 60,
                passed: false,
                breakdown: {
                  context: 34,
                  style: 45,
                },
                scorer: {
                  provider: "mock",
                  model: "mock-scorer",
                },
              },
            },
          },
          currentLevel: levels[1],
          landing: {
            startHref: "/play?level=1",
            resume: {
              available: true,
              href: "/play?level=2&resume=1",
              currentLevelNumber: 2,
              currentLevelTitle: "Midnight Alley Portrait",
              levelsCleared: 1,
              attemptsRemaining: 0,
              bestScore: 59,
              helperText: "Pick up the same run without replaying cleared progress.",
            },
          },
          progress: {
            playerId: "player-1",
            runId: "run-1",
            currentLevelId: "level-2",
            highestUnlockedLevelNumber: 2,
            totalAttemptsUsed: 4,
            canResume: true,
            lastActiveAt: "2026-04-07T08:05:00.000Z",
            levels: [
              {
                levelId: "level-1",
                status: "passed",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 68,
                strongestAttemptId: "attempt-live-1",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: "2026-04-07T08:00:00.000Z",
                lastCompletedAt: "2026-04-07T08:00:00.000Z",
                lastAttemptedAt: "2026-04-07T08:00:00.000Z",
              },
              {
                levelId: "level-2",
                status: "failed",
                currentAttemptCycle: 1,
                attemptsUsed: 3,
                attemptsRemaining: 0,
                bestScore: 59,
                strongestAttemptId: "attempt-live-2",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: "2026-04-07T08:05:00.000Z",
              },
              {
                levelId: "level-3",
                status: "locked",
                currentAttemptCycle: 1,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: null,
                strongestAttemptId: null,
                unlockedAt: null,
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: null,
              },
            ],
          },
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

    render(
      <ActiveLevelScreen
        state={getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 })}
        submissionEndpoint="/api/game/submit-attempt"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));

    expect(await screen.findByText("Compare the target against your generated match")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("59%");

    fireEvent.click(screen.getByRole("button", { name: "See Failure State" }));

    expect(screen.getByText("The best try stays with you")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("59%");
    expect(
      screen.getByText(
        "Call out the wet alley, neon signage, and late-night atmosphere directly so the portrait lands in the right environment.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces server submission errors without clearing the draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          code: "restart_required",
          message: "This level has no attempts left. Restart the level before submitting again.",
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ActiveLevelScreen state={getMockActiveLevelState()} submissionEndpoint="/api/game/submit-attempt" />);

    const prompt = screen.getByLabelText("Prompt");

    fireEvent.change(prompt, {
      target: { value: "sunlit pears and a bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This level has no attempts left. Restart the level before submitting again.",
    );
    expect(prompt).toHaveValue("sunlit pears and a bottle on a wooden table");
  });

  it("renders a result comparison with a player-facing percentage score", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "sunlit pears and a green bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));

    expect(screen.getByText("Compare the target against your generated match")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("68%");
    expect(screen.getByText("Threshold cleared")).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A sunlit still life arranged on a wooden table." })).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "A mock generated still life with warm fruit tones, a glass bottle, and softer edges than the target.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("subject")).not.toBeInTheDocument();
  });

  it("shows the success continuation path after a passing result", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "sunlit pears and a green bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Success Options" }));

    expect(screen.getByText("Carry the momentum into the next image")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("68% match on Level 1");
    expect(screen.getByText("Level 2 is ready to load with a fresh attempt counter.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to Level 2" })).toHaveAttribute("href", "/play?level=2");
    expect(screen.getByRole("button", { name: "Replay This Level" })).toBeInTheDocument();
  });

  it("returns to the prompt state when replaying a cleared level", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "sunlit pears and a green bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Success Options" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay This Level" }));

    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("sunlit pears and a green bottle on a wooden table");
  });

  it("shows the retry continuation path after a below-threshold result and keeps the draft for revision", () => {
    const resumedState = getMockActiveLevelState({ levelNumber: 2, resume: true });
    render(<ActiveLevelScreen state={resumedState} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Retry Options" }));

    expect(screen.getByText("Take another pass while the comparison is still fresh")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(screen.getByText("One retry remains")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revise Prompt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revise Prompt" }));

    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("cinematic neon portrait in a wet alley at midnight");
  });

  it("shows the final summary with replay entry points after clearing the last seeded level", () => {
    const finalLevelState = getMockActiveLevelState({ levelNumber: 3 });
    render(<ActiveLevelScreen state={finalLevelState} />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "ornate stone courtyard with warm light and repeating arches" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Success Options" }));

    expect(screen.getByRole("button", { name: "View Final Summary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Final Summary" }));

    expect(screen.getByText("You cleared the opening pack")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3/3");
    expect(screen.getByText("Levels Cleared")).toBeInTheDocument();
    expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    expect(screen.getByText("Improvement Trend")).toBeInTheDocument();
    expect(screen.queryByText("Target Image")).not.toBeInTheDocument();
    expect(screen.queryByText("Required Score")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "An ornate courtyard with layered arches and warm stone textures." })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Replay Level 1" })).toHaveAttribute("href", "/play?level=1");
    expect(screen.getByRole("link", { name: "Replay Level 2" })).toHaveAttribute("href", "/play?level=2");
    expect(screen.getByRole("link", { name: "Replay Level 3" })).toHaveAttribute("href", "/play?level=3");
    expect(screen.getByRole("link", { name: "Replay Final Level" })).toHaveAttribute("href", "/play?level=3");
    expect(screen.getByText("Replay a cleared level now, or come back when the next pack lands.")).toBeInTheDocument();
  });

  it("shows the failure state with strongest-attempt context after the last retry is spent", () => {
    const exhaustedState = getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 });
    render(<ActiveLevelScreen state={exhaustedState} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Failure State" }));

    expect(screen.getByText("The best try stays with you")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("59%");
    expect(screen.getByText("Close, but not through")).toBeInTheDocument();
    expect(screen.getByText("What to carry into the restart")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your best try found the mood. On the restart, lock the alley setting and framing in sooner.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Restart Level" })).toHaveAttribute("href", "/play?level=2");
    expect(screen.getByRole("button", { name: "Review Result Again" })).toBeInTheDocument();
  });

  it("can boot directly into the failure state for a saved failed level", () => {
    render(
      <ActiveLevelScreen
        state={{
          ...getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 3 }),
          initialScreenMode: "failure",
        }}
      />,
    );

    expect(screen.getByText("The best try stays with you")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("59%");
    expect(screen.getByText("cinematic neon portrait in a wet alley at midnight")).toBeInTheDocument();
  });

  it("restarts a failed level through the live restart endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          currentLevel: levels[1],
          landing: {
            startHref: "/play?level=1",
            resume: {
              available: true,
              href: "/play?level=2&resume=1",
              currentLevelNumber: 2,
              currentLevelTitle: "Midnight Alley Portrait",
              levelsCleared: 1,
              attemptsRemaining: 3,
              bestScore: 59,
              helperText: "Pick up the same run without replaying cleared progress.",
            },
          },
          progress: {
            playerId: "player-1",
            runId: "run-1",
            currentLevelId: "level-2",
            highestUnlockedLevelNumber: 2,
            totalAttemptsUsed: 3,
            canResume: true,
            lastActiveAt: "2026-04-07T08:10:00.000Z",
            levels: [
              {
                levelId: "level-1",
                status: "passed",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 68,
                strongestAttemptId: "attempt-live-1",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: "2026-04-07T08:00:00.000Z",
                lastCompletedAt: "2026-04-07T08:00:00.000Z",
                lastAttemptedAt: "2026-04-07T08:00:00.000Z",
              },
              {
                levelId: "level-2",
                status: "in_progress",
                currentAttemptCycle: 2,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: 59,
                strongestAttemptId: "attempt-live-2",
                unlockedAt: "2026-04-07T08:05:00.000Z",
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: "2026-04-07T08:10:00.000Z",
              },
              {
                levelId: "level-3",
                status: "locked",
                currentAttemptCycle: 1,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: null,
                strongestAttemptId: null,
                unlockedAt: null,
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: null,
              },
            ],
          },
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

    const exhaustedState = getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 });
    render(<ActiveLevelScreen state={exhaustedState} restartLevelEndpoint="/api/game/restart-level" />);

    captureClientAnalyticsEvent.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Failure State" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Level" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/restart-level",
      expect.objectContaining({
        method: "POST",
      }),
    );

    expect(await screen.findByText("2. Midnight Alley Portrait")).toBeInTheDocument();
    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("");
    expect(captureClientAnalyticsEvent.mock.calls.map(([event]) => event.name)).toEqual([
      "level_restarted",
      "level_started",
    ]);
    expect(captureClientAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "level_restarted",
        runId: "run-1",
        levelId: "level-2",
        priorAttemptsUsed: 2,
        bestScoreBeforeRestart: 59,
      }),
    );
    expect(captureClientAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "level_started",
        runId: "run-1",
        levelId: "level-2",
        levelNumber: 2,
        threshold: 60,
        attemptWindow: 3,
      }),
    );
  });

  it("keeps the restart transition successful when client analytics throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          currentLevel: levels[1],
          landing: {
            startHref: "/play?level=1",
            resume: {
              available: true,
              href: "/play?level=2&resume=1",
              currentLevelNumber: 2,
              currentLevelTitle: "Midnight Alley Portrait",
              levelsCleared: 1,
              attemptsRemaining: 3,
              bestScore: 59,
              helperText: "Pick up the same run without replaying cleared progress.",
            },
          },
          progress: {
            playerId: "player-1",
            runId: "run-1",
            currentLevelId: "level-2",
            highestUnlockedLevelNumber: 2,
            totalAttemptsUsed: 3,
            canResume: true,
            lastActiveAt: "2026-04-07T08:10:00.000Z",
            levels: [
              {
                levelId: "level-1",
                status: "passed",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 68,
                strongestAttemptId: "attempt-live-1",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: "2026-04-07T08:00:00.000Z",
                lastCompletedAt: "2026-04-07T08:00:00.000Z",
                lastAttemptedAt: "2026-04-07T08:00:00.000Z",
              },
              {
                levelId: "level-2",
                status: "in_progress",
                currentAttemptCycle: 2,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: 59,
                strongestAttemptId: "attempt-live-2",
                unlockedAt: "2026-04-07T08:05:00.000Z",
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: "2026-04-07T08:10:00.000Z",
              },
              {
                levelId: "level-3",
                status: "locked",
                currentAttemptCycle: 1,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: null,
                strongestAttemptId: null,
                unlockedAt: null,
                completedAt: null,
                lastCompletedAt: null,
                lastAttemptedAt: null,
              },
            ],
          },
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

    const exhaustedState = getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 });
    render(<ActiveLevelScreen state={exhaustedState} restartLevelEndpoint="/api/game/restart-level" />);

    captureClientAnalyticsEvent.mockClear();
    captureClientAnalyticsEvent.mockImplementation(() => {
      throw new Error("posthog unavailable");
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Failure State" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Level" }));

    expect(await screen.findByText("2. Midnight Alley Portrait")).toBeInTheDocument();
    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("");
    expect(screen.queryByText("That action did not go through. Try again.")).not.toBeInTheDocument();
    expect(captureClientAnalyticsEvent.mock.calls.map(([event]) => event.name)).toEqual([
      "level_restarted",
      "level_started",
    ]);
  });

  it("replays a cleared level from the summary through the live replay endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          currentLevel: levels[1],
          landing: {
            startHref: "/play?level=1",
            resume: {
              available: true,
              href: "/play?level=2&resume=1",
              currentLevelNumber: 2,
              currentLevelTitle: "Midnight Alley Portrait",
              levelsCleared: 1,
              attemptsRemaining: 3,
              bestScore: 63,
              helperText: "Replay any cleared level without losing your unlocked progress.",
            },
          },
          progress: {
            playerId: "player-1",
            runId: "run-1",
            currentLevelId: "level-2",
            highestUnlockedLevelNumber: 3,
            totalAttemptsUsed: 4,
            canResume: true,
            lastActiveAt: "2026-04-07T08:15:00.000Z",
            levels: [
              {
                levelId: "level-1",
                status: "passed",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 68,
                strongestAttemptId: "attempt-live-1",
                unlockedAt: "2026-04-07T08:00:00.000Z",
                completedAt: "2026-04-07T08:00:00.000Z",
                lastCompletedAt: "2026-04-07T08:00:00.000Z",
                lastAttemptedAt: "2026-04-07T08:00:00.000Z",
              },
              {
                levelId: "level-2",
                status: "in_progress",
                currentAttemptCycle: 2,
                attemptsUsed: 0,
                attemptsRemaining: 3,
                bestScore: 63,
                strongestAttemptId: "attempt-live-4",
                unlockedAt: "2026-04-07T08:05:00.000Z",
                completedAt: "2026-04-07T08:05:00.000Z",
                lastCompletedAt: "2026-04-07T08:05:00.000Z",
                lastAttemptedAt: "2026-04-07T08:15:00.000Z",
              },
              {
                levelId: "level-3",
                status: "passed",
                currentAttemptCycle: 1,
                attemptsUsed: 1,
                attemptsRemaining: 2,
                bestScore: 78,
                strongestAttemptId: "attempt-live-5",
                unlockedAt: "2026-04-07T08:10:00.000Z",
                completedAt: "2026-04-07T08:10:00.000Z",
                lastCompletedAt: "2026-04-07T08:10:00.000Z",
                lastAttemptedAt: "2026-04-07T08:10:00.000Z",
              },
            ],
          },
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

    const finalLevelState = getMockActiveLevelState({ levelNumber: 3 });
    render(<ActiveLevelScreen state={finalLevelState} replayLevelEndpoint="/api/game/replay-level" />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "ornate stone courtyard with warm light and repeating arches" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Success Options" }));
    fireEvent.click(screen.getByRole("button", { name: "View Final Summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay Level 2" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/replay-level",
      expect.objectContaining({
        method: "POST",
      }),
    );

    expect(await screen.findByText("2. Midnight Alley Portrait")).toBeInTheDocument();
    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("");
  });

  it("syncs the draft and resets local UI state when the parent provides a different level", () => {
    const initialState = getMockActiveLevelState();
    const resumedState = getMockActiveLevelState({ levelNumber: 2, resume: true });
    const { rerender } = render(<ActiveLevelScreen key={initialState.level.id} state={initialState} />);

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "temporary draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    expect(screen.getByText("Building your match image")).toBeInTheDocument();

    rerender(<ActiveLevelScreen key={`${resumedState.level.id}:${resumedState.promptDraft}`} state={resumedState} />);

    expect(screen.getByText("2. Midnight Alley Portrait")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("cinematic neon portrait in a wet alley at midnight");
    expect(screen.queryByText("Building your match image")).not.toBeInTheDocument();
  });
});
