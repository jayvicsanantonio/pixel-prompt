import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActiveLevelScreen } from "@/components/game/active-level-screen";
import { getMockActiveLevelState } from "@/server/game/mock-active-level-state";

describe("ActiveLevelScreen", () => {
  it("renders level metadata, attempts, and the target image study area", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    expect(screen.getByRole("link", { name: "Back to Landing" })).toHaveAttribute("href", "/");
    expect(screen.getByText("1. Sunlit Still Life")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A sunlit still life arranged on a wooden table." })).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
  });

  it("updates the character counter as the player types", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    const prompt = screen.getByLabelText("Prompt");

    fireEvent.change(prompt, { target: { value: "warm pears on a sunlit table" } });

    expect(prompt).toHaveValue("warm pears on a sunlit table");
    expect(screen.getByText("28/120 characters")).toBeInTheDocument();
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

  it("renders a result comparison with a player-facing percentage score", () => {
    render(<ActiveLevelScreen state={getMockActiveLevelState()} />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "sunlit pears and a green bottle on a wooden table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Mock Result" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Reveal Mock Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Success Options" }));

    expect(screen.getByText("Carry the momentum into the next image")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("68% match on Level 1");
    expect(screen.getByText("Level 2 is ready to load with a fresh attempt counter.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to Level 2" })).toHaveAttribute("href", "/play?level=2");
    expect(screen.getByRole("button", { name: "Replay This Level" })).toBeInTheDocument();
  });

  it("shows the retry continuation path after a below-threshold result and keeps the draft for revision", () => {
    const resumedState = getMockActiveLevelState({ levelNumber: 2, resume: true });
    render(<ActiveLevelScreen state={resumedState} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Mock Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Retry Options" }));

    expect(screen.getByText("Take another pass while the comparison is still fresh")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(screen.getByText("One retry remains")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revise Prompt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revise Prompt" }));

    expect(screen.getByText("Describe what matters before you submit")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("cinematic neon portrait in a wet alley at midnight");
  });

  it("shows the failure state with strongest-attempt context after the last retry is spent", () => {
    const exhaustedState = getMockActiveLevelState({ levelNumber: 2, resume: true, attemptsUsed: 2 });
    render(<ActiveLevelScreen state={exhaustedState} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Mock Result" }));
    fireEvent.click(screen.getByRole("button", { name: "See Failure State" }));

    expect(screen.getByText("You ran out of attempts, but the best try is still visible")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("59%");
    expect(screen.getByText("Closest run fell just short")).toBeInTheDocument();
    expect(screen.getByText("What to carry into the restart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart Level" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Result Again" })).toBeInTheDocument();
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
