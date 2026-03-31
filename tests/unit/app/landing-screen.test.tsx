import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingScreen } from "@/components/landing/landing-screen";
import { levels } from "@/content";
import { getMockLandingState } from "@/server/game/mock-landing-state";

describe("LandingScreen", () => {
  it("renders the start CTA and empty resume state", () => {
    render(<LandingScreen landingState={getMockLandingState()} levels={levels} />);

    expect(screen.getByRole("heading", { name: /study the image\. write the prompt\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Game" })).toHaveAttribute("href", "/play");
    expect(screen.getByText("Resume appears here after your first scored attempt.")).toBeInTheDocument();
    expect(screen.getByText("Pass at 50% match")).toBeInTheDocument();
    expect(screen.getByText("Pass at 60% match")).toBeInTheDocument();
    expect(screen.getByText("Pass at 70% match")).toBeInTheDocument();
  });

  it("renders the resume CTA when a saved run exists", () => {
    render(<LandingScreen landingState={getMockLandingState({ canResume: true })} levels={levels} />);

    const resumeLink = screen.getByRole("link", { name: "Resume Level 2" });
    const resumeCard = resumeLink.closest("article");

    expect(resumeLink).toHaveAttribute("href", "/play");
    expect(resumeCard).not.toBeNull();
    expect(within(resumeCard as HTMLElement).getByText(/continue at/i)).toBeInTheDocument();
    expect(resumeCard).toHaveTextContent("2 attempts left.");
    expect(resumeCard).toHaveTextContent("54%");
  });
});
