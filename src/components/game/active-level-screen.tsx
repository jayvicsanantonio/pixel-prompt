"use client";

import Link from "next/link";
import { useState } from "react";
import { toPlayerFacingScore, type ActiveLevelScreenState } from "@/lib/game";
import styles from "./active-level-screen.module.css";

interface ActiveLevelScreenProps {
  state: ActiveLevelScreenState;
}

export function ActiveLevelScreen({ state }: ActiveLevelScreenProps) {
  const [promptText, setPromptText] = useState(state.promptDraft);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<"active" | "generating" | "result" | "success" | "retry" | "failure">("active");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const characterCount = promptText.length;
  const characterLimit = state.level.promptCharacterLimit;
  const isOverLimit = characterCount > characterLimit;
  const promptFeedbackId = validationMessage ? "prompt-feedback" : undefined;
  const promptDescribedBy = ["prompt-guidance", "prompt-counter", promptFeedbackId].filter(Boolean).join(" ");
  const playerFacingScore = toPlayerFacingScore(state.resultPreview.score);
  const hasRetryRemaining = state.continuation.attemptsRemainingAfterResult > 0;

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

  function renderPromptPanel() {
    if (screenMode === "active") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>Write Your Prompt</p>
            <h2 className={styles.promptTitle}>Describe what matters before you submit</h2>
            <p className={styles.promptBody}>
              Aim for subject, material, lighting, and composition. This screen stays intentionally quiet so the image
              remains the main reference.
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
              aria-describedby={promptDescribedBy}
              aria-invalid={validationMessage !== null}
              className={styles.textarea}
              name="prompt"
              placeholder="sunlit pears and green bottle on a wooden table, warm studio still life"
              value={promptText}
              onChange={(event) => {
                setPromptText(event.target.value);

                if (validationMessage !== null) {
                  setValidationMessage(null);
                }
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitPrompt();
                }
              }}
            />
            <div className={styles.formFooter}>
              <p className={`${styles.counter} ${isOverLimit ? styles.counterOverLimit : ""}`.trim()} id="prompt-counter">
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
            This slice keeps the player draft intact when validation fails and makes the submission path usable from
            the keyboard before async generation exists.
          </p>
        </>
      );
    }

    if (screenMode === "generating") {
      return (
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
            This state keeps the target image visible and echoes the submitted prompt so the player understands what is
            currently being matched.
          </p>

          <div className={styles.actionRow}>
            <button className={styles.button} type="button" onClick={() => setScreenMode("result")}>
              Reveal Mock Result
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
              Back to Prompt
            </button>
          </div>
        </>
      );
    }

    if (screenMode === "result") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>Result</p>
            <h2 className={styles.promptTitle}>Compare the target against your generated match</h2>
            <p className={styles.promptBody}>
              The player-facing score is a single percentage. Internal scoring signals stay hidden while the result
              screen keeps the comparison easy to scan.
            </p>
          </header>

          <article
            className={`${styles.scoreHero} ${playerFacingScore.passed ? styles.scoreHeroPass : styles.scoreHeroFail}`}
            role="status"
          >
            <div>
              <p className={styles.statLabel}>Match Score</p>
              <p className={styles.scoreValue}>{playerFacingScore.percentage}%</p>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreHeadline}>{playerFacingScore.passed ? "Threshold cleared" : "Below the pass line"}</p>
              <p className={styles.scoreSummary}>
                {playerFacingScore.passed
                  ? `This mock attempt beats the ${playerFacingScore.threshold}% requirement for Level ${state.level.number}.`
                  : `This mock attempt misses the ${playerFacingScore.threshold}% requirement, so the next slice will handle the retry path.`}
              </p>
            </div>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Submitted Prompt</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Threshold</span>
              <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Outcome</span>
              <strong className={styles.statValue}>{playerFacingScore.passed ? "Pass" : "Needs Retry"}</strong>
            </article>
          </div>

          <section className={styles.resultPanel} aria-labelledby="generated-match-title">
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>Generated Image</p>
                <h3 className={styles.resultPanelTitle} id="generated-match-title">
                  Mock result preview
                </h3>
              </div>
              <p className={styles.helperText}>Target stays pinned on the left for direct visual comparison.</p>
            </div>

            <div className={styles.generatedFrame} role="img" aria-label={state.resultPreview.generatedImageAlt}>
              <div className={styles.generatedGlow} />
              <div className={styles.generatedGrid} />
              <div className={styles.generatedBlobOne} />
              <div className={styles.generatedBlobTwo} />
              <div className={styles.generatedBlobThree} />
              <div className={styles.generatedAccent} />
            </div>

            <p className={styles.targetCaption}>{state.resultPreview.summary}</p>
          </section>

          <div className={styles.actionRow}>
            {playerFacingScore.passed ? (
              <button className={styles.button} type="button" onClick={() => setScreenMode("success")}>
                See Success Options
              </button>
            ) : hasRetryRemaining ? (
              <button className={styles.button} type="button" onClick={() => setScreenMode("retry")}>
                See Retry Options
              </button>
            ) : (
              <button className={styles.button} type="button" onClick={() => setScreenMode("failure")}>
                See Failure State
              </button>
            )}

            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
              {playerFacingScore.passed ? "Replay Prompt" : "Adjust Prompt"}
            </button>
          </div>
        </>
      );
    }

    if (screenMode === "success") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>Level Cleared</p>
            <h2 className={styles.promptTitle}>Carry the momentum into the next image</h2>
            <p className={styles.promptBody}>
              Passing the threshold should roll straight into the next challenge. This mock continuation keeps the next
              level and replay options visible without exposing internal scoring details.
            </p>
          </header>

          <article className={`${styles.feedback} ${styles.success}`} role="status">
            <p className={styles.statLabel}>Cleared With</p>
            <p className={styles.submittedPrompt}>
              {playerFacingScore.percentage}% match on Level {state.level.number}
            </p>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Unlocked</span>
              <strong className={styles.statValue}>
                {state.continuation.nextLevelNumber ? `Level ${state.continuation.nextLevelNumber}` : "Summary"}
              </strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Unused Attempts</span>
              <strong className={styles.statValue}>{state.continuation.attemptsRemainingAfterResult}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Submitted Prompt</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
          </div>

          <section className={styles.resultPanel}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>Next Step</p>
                <h3 className={styles.resultPanelTitle}>
                  {state.continuation.nextLevelTitle ?? "Final summary flow comes next"}
                </h3>
              </div>
            </div>

            <p className={styles.targetCaption}>
              {state.continuation.nextLevelTitle
                ? `Level ${state.continuation.nextLevelNumber} is ready to load with a fresh attempt counter.`
                : "This is the end of the seeded content pack, so the final summary state is the next UI slice."}
            </p>
          </section>

          <div className={styles.actionRow}>
            {state.continuation.nextLevelHref ? (
              <Link className={styles.button} href={state.continuation.nextLevelHref}>
                Continue to Level {state.continuation.nextLevelNumber}
              </Link>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
              Replay This Level
            </button>
          </div>
        </>
      );
    }

    if (screenMode === "retry") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>Retry Ready</p>
            <h2 className={styles.promptTitle}>Take another pass while the comparison is still fresh</h2>
            <p className={styles.promptBody}>
              A below-threshold score should lead directly into another attempt when retries remain. This branch keeps
              the remaining-attempt context and the revise action in one place.
            </p>
          </header>

          <article className={`${styles.scoreHero} ${styles.scoreHeroFail}`} role="status">
            <div>
              <p className={styles.statLabel}>Attempts Left</p>
              <p className={styles.scoreValue}>{state.continuation.attemptsRemainingAfterResult}</p>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreHeadline}>
                {state.continuation.attemptsRemainingAfterResult === 1 ? "One retry remains" : "Retries remain"}
              </p>
              <p className={styles.scoreSummary}>
                Tighten the prompt around context, materials, or composition, then submit again without losing the
                draft.
              </p>
            </div>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Current Score</span>
              <strong className={styles.statValue}>{playerFacingScore.percentage}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Threshold</span>
              <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Submitted Prompt</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
          </div>

          <section className={styles.resultPanel}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>Retry Advice</p>
                <h3 className={styles.resultPanelTitle}>Revise the draft, then resubmit</h3>
              </div>
            </div>

            <p className={styles.targetCaption}>
              The prompt draft stays in the textarea, so the player can edit specific details instead of rewriting from
              scratch.
            </p>
          </section>

          <div className={styles.actionRow}>
            <button className={styles.button} type="button" onClick={() => setScreenMode("active")}>
              Revise Prompt
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("result")}>
              Review Result Again
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <header className={styles.panelHeader}>
          <p className={styles.eyebrow}>Level Failed</p>
          <h2 className={styles.promptTitle}>You ran out of attempts, but the best try is still visible</h2>
          <p className={styles.promptBody}>
            The failure state should surface the strongest attempt without sounding punitive. The actual restart flow is
            a separate task, but the player-facing restart CTA belongs here.
          </p>
        </header>

        <article className={`${styles.scoreHero} ${styles.scoreHeroFail}`} role="status">
          <div>
            <p className={styles.statLabel}>Strongest Attempt</p>
            <p className={styles.scoreValue}>{state.failurePreview.strongestAttemptScore}%</p>
          </div>
          <div className={styles.scoreMeta}>
            <p className={styles.scoreHeadline}>Closest run fell just short</p>
            <p className={styles.scoreSummary}>
              Keep the best score visible so a restart feels like a reset, not a punishment.
            </p>
          </div>
        </article>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Threshold</span>
            <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Last Result</span>
            <strong className={styles.statValue}>{playerFacingScore.percentage}%</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Attempts Left</span>
            <strong className={styles.statValue}>{state.continuation.attemptsRemainingAfterResult}</strong>
          </article>
        </div>

        <section className={styles.resultPanel}>
          <div className={styles.resultPanelHeader}>
            <div>
              <p className={styles.eyebrow}>Strongest Attempt Context</p>
              <h3 className={styles.resultPanelTitle}>What to carry into the restart</h3>
            </div>
          </div>

          <p className={styles.targetCaption}>{state.failurePreview.summary}</p>

          <article className={styles.statCard}>
            <span className={styles.statLabel}>Last Submitted Prompt</span>
            <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
          </article>
        </section>

        <div className={styles.actionRow}>
          <button className={styles.button} type="button">
            Restart Level
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("result")}>
            Review Result Again
          </button>
        </div>
      </>
    );
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

        <section className={styles.promptPanel}>{renderPromptPanel()}</section>
      </div>
    </main>
  );
}
