"use client";

import Link from "next/link";
import { useState } from "react";
import { type ActiveLevelScreenState } from "@/lib/game";
import styles from "./active-level-screen.module.css";

interface ActiveLevelScreenProps {
  state: ActiveLevelScreenState;
}

export function ActiveLevelScreen({ state }: ActiveLevelScreenProps) {
  const [promptText, setPromptText] = useState(state.promptDraft);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<"active" | "generating">("active");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const characterCount = promptText.length;
  const characterLimit = state.level.promptCharacterLimit;
  const isOverLimit = characterCount > characterLimit;

  function submitPrompt() {
    const trimmedPrompt = promptText.trim();

    if (trimmedPrompt.length === 0) {
      setValidationMessage("Write a prompt before you submit.");
      return;
    }

    if (characterCount > characterLimit) {
      setValidationMessage(`Keep the prompt at ${characterLimit} characters or fewer.`);
      return;
    }

    setValidationMessage(null);
    setSubmittedPrompt(trimmedPrompt);
    setScreenMode("generating");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link className={styles.backLink} href="/">
          Back to Landing
        </Link>
        <div className={styles.topMeta}>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>Level</span>
            <strong className={styles.badgeValue}>
              {state.level.number}. {state.level.title}
            </strong>
          </article>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>Required Score</span>
            <strong className={styles.badgeValue}>{state.level.threshold}%</strong>
          </article>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>Attempts Left</span>
            <strong className={styles.badgeValue}>{state.attemptsRemaining}</strong>
          </article>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.targetPanel}>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>Target Image</p>
            <h1 className={styles.targetTitle}>{state.level.title}</h1>
            <p className={styles.targetDescription}>{state.level.description}</p>
          </header>

          <div className={styles.studyFrame} role="img" aria-label={state.level.targetImage.alt}>
            <div className={styles.wall} />
            <div className={styles.table} />
            <div className={styles.cloth} />
            <div className={styles.bottle} />
            <div className={styles.plate} />
            <div className={styles.pearLeft} />
            <div className={styles.pearRight} />
          </div>

          <p className={styles.targetCaption}>
            Keep the target visible while you write. The mock artwork here stands in for the curated level image until
            the real asset pipeline lands.
          </p>
        </section>

        <section className={styles.promptPanel}>
          {screenMode === "active" ? (
            <>
              <header className={styles.panelHeader}>
                <p className={styles.eyebrow}>Write Your Prompt</p>
                <h2 className={styles.promptTitle}>Describe what matters before you submit</h2>
                <p className={styles.promptBody}>
                  Aim for subject, material, lighting, and composition. This screen stays intentionally quiet so the
                  image remains the main reference.
                </p>
              </header>

              <div className={styles.statsGrid}>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Theme</span>
                  <strong className={styles.statValue}>{state.level.theme}</strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Difficulty</span>
                  <strong className={styles.statValue}>{state.level.difficulty}</strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Attempts Used</span>
                  <strong className={styles.statValue}>{state.attemptsUsed}</strong>
                </article>
              </div>

              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPrompt();
                }}
              >
                <label className={styles.label} htmlFor="prompt">
                  Prompt
                </label>
                <textarea
                  id="prompt"
                  aria-describedby="prompt-guidance prompt-counter prompt-feedback"
                  aria-invalid={validationMessage !== null}
                  className={styles.textarea}
                  name="prompt"
                  placeholder="sunlit pears and green bottle on a wooden table, warm studio still life"
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      submitPrompt();
                    }
                  }}
                />
                <div className={styles.formFooter}>
                  <p
                    className={`${styles.counter} ${isOverLimit ? styles.counterOverLimit : ""}`.trim()}
                    id="prompt-counter"
                  >
                    {characterCount}/{characterLimit} characters
                  </p>
                  <button className={styles.button} type="submit">
                    Generate Match
                  </button>
                </div>
              </form>

              <p className={styles.helperText}>
                <span id="prompt-guidance">Press Cmd+Enter or Ctrl+Enter to submit without leaving the textarea.</span>
              </p>

              {validationMessage ? (
                <p className={`${styles.feedback} ${styles.error}`} id="prompt-feedback" role="alert">
                  {validationMessage}
                </p>
              ) : null}

              <p className={styles.helperText}>
                This slice keeps the player draft intact when validation fails and makes the submission path usable
                from the keyboard before async generation exists.
              </p>
            </>
          ) : (
            <>
              <header className={styles.panelHeader}>
                <p className={styles.eyebrow}>Generating</p>
                <h2 className={styles.promptTitle}>Building your match image</h2>
                <p className={styles.promptBody}>
                  Pixel Prompt is now in the waiting state between submission and scoring. The real provider call lands
                  later; this mock state establishes the player-facing handoff.
                </p>
              </header>

              <div className={styles.progressTrack} aria-hidden="true">
                <div className={styles.progressBar} />
              </div>

              <article className={`${styles.feedback} ${styles.success}`} role="status">
                <p className={styles.statLabel}>Submitted Prompt</p>
                <p className={styles.submittedPrompt}>{submittedPrompt}</p>
              </article>

              <div className={styles.statsGrid}>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Required Score</span>
                  <strong className={styles.statValue}>{state.level.threshold}%</strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Attempts On The Line</span>
                  <strong className={styles.statValue}>1</strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Next State</span>
                  <strong className={styles.statValue}>Result</strong>
                </article>
              </div>

              <p className={styles.helperText}>
                This state keeps the target image visible and echoes the submitted prompt so the player understands what
                is currently being matched.
              </p>

              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setScreenMode("active")}
              >
                Back to Prompt
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
