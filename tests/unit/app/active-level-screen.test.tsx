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
