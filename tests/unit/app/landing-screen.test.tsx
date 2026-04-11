import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureClientAnalyticsEvent } = vi.hoisted(() => ({
  captureClientAnalyticsEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client", () => ({
  captureClientAnalyticsEvent,
}));

import { LandingScreen } from "@/components/landing/landing-screen";
import { levels } from "@/content";
import { getMockLandingState } from "@/server/game/mock-landing-state";

describe("LandingScreen", () => {
  afterEach(() => {
    captureClientAnalyticsEvent.mockReset();
  });

  it("renders the start CTA and empty resume state", () => {
    render(<LandingScreen landingState={getMockLandingState()} levels={levels} />);

    expect(screen.getByRole("heading", { name: /study the image\. write the prompt\./i })).toBeInTheDocument();
    expect(
      screen.getByText("Each level shows a target image. Write a short prompt, get a match score, and clear the level."),
    ).toBeInTheDocument();
    expect(screen.getByText("You get up to 3 attempts per level. Each miss turns into quick feedback.")).toBeInTheDocument();
    expect(screen.queryByText(/MVP loop/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Game" })).toHaveAttribute("href", "/play?level=1");
    expect(screen.getByText("Resume appears here after your first scored attempt.")).toBeInTheDocument();
    expect(screen.getByText("Pass at 50% match")).toBeInTheDocument();
    expect(screen.getByText("Pass at 60% match")).toBeInTheDocument();
    expect(screen.getByText("Pass at 70% match")).toBeInTheDocument();
    expect(captureClientAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "landing_viewed",
      }),
    );
  });

  it("renders the resume CTA when a saved run exists", () => {
    render(<LandingScreen landingState={getMockLandingState({ canResume: true })} levels={levels} />);

    const resumeLink = screen.getByRole("link", { name: "Resume Level 2" });
    const resumeCard = resumeLink.closest("article");

    expect(resumeLink).toHaveAttribute("href", "/play?level=2&resume=1");
    expect(resumeCard).not.toBeNull();
    expect(within(resumeCard as HTMLElement).getByText(/continue at/i)).toBeInTheDocument();
    expect(resumeCard).toHaveTextContent("2 attempts left.");
    expect(resumeCard).toHaveTextContent("1 level");
    expect(resumeCard).toHaveTextContent("54%");
    expect(captureClientAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "resume_offered",
        runId: "run-mock",
        levelId: "level-2",
      }),
    );
  });

  it("captures start and resume funnel events from the landing CTAs", () => {
    render(<LandingScreen landingState={getMockLandingState({ canResume: true })} levels={levels} />);

    captureClientAnalyticsEvent.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Start Game" }));
    fireEvent.click(screen.getByRole("link", { name: "Start Game" }));
    fireEvent.click(screen.getByRole("link", { name: "Resume Level 2" }));
    fireEvent.click(screen.getByRole("link", { name: "Resume Level 2" }));

    expect(captureClientAnalyticsEvent.mock.calls.map(([event]) => event.name)).toEqual([
      "game_started",
      "game_started",
      "resume_started",
    ]);
    expect(captureClientAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "game_started",
        entry: "new",
      }),
    );
    expect(captureClientAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "game_started",
        entry: "resume",
        runId: "run-mock",
      }),
    );
    expect(captureClientAnalyticsEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: "resume_started",
        runId: "run-mock",
        currentLevelId: "level-2",
      }),
    );
  });
});
