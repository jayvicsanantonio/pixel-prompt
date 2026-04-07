"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { levels, tipRules, uiCopy } from "@/content";
import { toPlayerFacingScore, type ActiveLevelScreenState, type GameProgress, type LandingExperienceState, type Level, type LevelAttempt } from "@/lib/game";
import styles from "./active-level-screen.module.css";

interface ActiveLevelScreenProps {
  state: ActiveLevelScreenState;
  submissionEndpoint?: string;
}

interface SubmitAttemptSuccessResponse {
  ok: true;
  transition: "retry" | "passed" | "failed" | "rejected" | "error" | "completed";
  attempt: LevelAttempt;
  currentLevel: Level | null;
  landing: LandingExperienceState;
  progress: GameProgress;
}

interface SubmitAttemptErrorResponse {
  ok: false;
  code: string;
  message: string;
}

const tipRuleBodies = new Map(tipRules.map((tipRule) => [tipRule.id, tipRule.body]));

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getLevelProgress(progress: GameProgress, levelId: string) {
  return progress.levels.find((levelProgress) => levelProgress.levelId === levelId) ?? null;
}

function getFirstTipBody(tipIds: string[]) {
  for (const tipId of tipIds) {
    const body = tipRuleBodies.get(tipId);

    if (body) {
      return body;
    }
  }

  return null;
}

function buildLiveSummaryPreview(progress: GameProgress) {
  const levelSummaries = levels.map((level) => {
    const levelProgress = getLevelProgress(progress, level.id);

    return {
      levelId: level.id,
      levelNumber: level.number,
      levelTitle: level.title,
      bestScore: levelProgress?.bestScore ?? 0,
      attemptsUsed: levelProgress?.attemptsUsed ?? 0,
      replayHref: `/play?level=${level.number}`,
    };
  });

  const completedLevels = levelSummaries.filter((levelSummary) => levelSummary.bestScore > 0);
  const firstCompletedLevel = completedLevels[0] ?? null;
  const lastCompletedLevel = completedLevels[completedLevels.length - 1] ?? null;
  const improvementDelta =
    firstCompletedLevel && lastCompletedLevel ? lastCompletedLevel.bestScore - firstCompletedLevel.bestScore : 0;
  const improvementSummary =
    firstCompletedLevel && lastCompletedLevel && completedLevels.length > 1
      ? `You finished ${Math.abs(improvementDelta)} points ${
          improvementDelta >= 0 ? "stronger" : "lower"
        } on ${lastCompletedLevel.levelTitle} than on ${firstCompletedLevel.levelTitle}.`
      : "You cleared the opening run. Replay a level to push the score higher.";

  return {
    levelsCompleted: progress.levels.filter((levelProgress) => levelProgress.completedAt != null).length,
    totalAttemptsUsed: progress.totalAttemptsUsed,
    bestScores: levelSummaries,
    improvementDelta,
    improvementSummary,
    encouragement: uiCopy.gameplay.summary.encouragement,
  };
}

function buildLiveFailureSummary(level: Level, attempt: LevelAttempt, progress: GameProgress) {
  const tipBody = getFirstTipBody(attempt.result.tipIds);

  if (tipBody) {
    return tipBody;
  }

  const strongestAttemptScore = attempt.result.strongestAttemptScore ?? getLevelProgress(progress, level.id)?.bestScore ?? 0;

  return `Best score ${strongestAttemptScore}% on Level ${level.number}. Restart and tighten the biggest visual differences.`;
}

function buildLiveResultSummary(level: Level, attempt: LevelAttempt) {
  const score = attempt.result.score;

  if (!score) {
    return "The attempt could not be scored.";
  }

  if (score.passed) {
    return `Score ${Math.round(score.normalized)}% cleared the ${level.threshold}% pass score.`;
  }

  return (
    getFirstTipBody(attempt.result.tipIds) ??
    `Score ${Math.round(score.normalized)}% missed the ${level.threshold}% pass score. Tighten the prompt and try again.`
  );
}

function buildLiveScreenState(input: {
  previousState: ActiveLevelScreenState;
  transition: SubmitAttemptSuccessResponse["transition"];
  attempt: LevelAttempt;
  progress: GameProgress;
  currentLevel: Level | null;
}): ActiveLevelScreenState {
  const attemptedLevel = levels.find((level) => level.id === input.attempt.levelId) ?? input.previousState.level;
  const attemptedLevelProgress = getLevelProgress(input.progress, attemptedLevel.id);
  const nextLevel =
    input.transition === "passed" && input.currentLevel && input.currentLevel.id !== attemptedLevel.id ? input.currentLevel : null;
  const strongestAttemptScore =
    input.attempt.result.strongestAttemptScore ?? attemptedLevelProgress?.bestScore ?? input.previousState.failurePreview.strongestAttemptScore;

  return {
    level: attemptedLevel,
    attemptsUsed: attemptedLevelProgress?.attemptsUsed ?? input.previousState.attemptsUsed,
    attemptsRemaining: attemptedLevelProgress?.attemptsRemaining ?? input.previousState.attemptsRemaining,
    promptDraft: input.attempt.promptText,
    resultPreview: {
      generatedImageAlt: "Generated image preview for the latest submitted prompt.",
      score: input.attempt.result.score ?? input.previousState.resultPreview.score,
      summary: buildLiveResultSummary(attemptedLevel, input.attempt),
    },
    continuation: {
      attemptsRemainingAfterResult:
        attemptedLevelProgress?.attemptsRemaining ?? input.previousState.continuation.attemptsRemainingAfterResult,
      nextLevelHref: nextLevel ? `/play?level=${nextLevel.number}` : null,
      nextLevelNumber: nextLevel?.number ?? null,
      nextLevelTitle: nextLevel?.title ?? null,
      restartLevelHref: `/play?level=${attemptedLevel.number}`,
    },
    failurePreview: {
      strongestAttemptScore,
      summary: buildLiveFailureSummary(attemptedLevel, input.attempt, input.progress),
    },
    summaryPreview: buildLiveSummaryPreview(input.progress),
  };
}

export function ActiveLevelScreen({ state: initialState, submissionEndpoint }: ActiveLevelScreenProps) {
  const [state, setState] = useState(initialState);
  const [promptText, setPromptText] = useState(initialState.promptDraft);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<
    "active" | "generating" | "result" | "success" | "retry" | "failure" | "summary"
  >("active");
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inspectDialogRef = useRef<HTMLDivElement | null>(null);
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const characterCount = promptText.length;
  const characterLimit = state.level.promptCharacterLimit;
  const isOverLimit = characterCount > characterLimit;
  const promptFeedbackId = validationMessage ? "prompt-feedback" : undefined;
  const promptDescribedBy = ["prompt-guidance", "prompt-counter", promptFeedbackId].filter(Boolean).join(" ");
  const playerFacingScore = toPlayerFacingScore(state.resultPreview.score);
  const hasRetryRemaining = state.continuation.attemptsRemainingAfterResult > 0;

  useEffect(() => {
    if (!isTargetExpanded) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialogElementCandidate = inspectDialogRef.current;
    const triggerElement = inspectTriggerRef.current;

    if (!dialogElementCandidate) {
      return;
    }

    const dialogElement: HTMLDivElement = dialogElementCandidate;

    const getFocusableElements = () =>
      Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled"),
      );

    const focusableElements = getFocusableElements();
    const initialFocusTarget = focusableElements[0] ?? dialogElement;
    initialFocusTarget.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsTargetExpanded(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusableElements = getFocusableElements();

      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const firstFocusableElement = currentFocusableElements[0];
      const lastFocusableElement = currentFocusableElements[currentFocusableElements.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === firstFocusableElement || !dialogElement.contains(activeElement)) {
          event.preventDefault();
          lastFocusableElement.focus();
        }

        return;
      }

      if (!activeElement || activeElement === lastFocusableElement || !dialogElement.contains(activeElement)) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    }

    dialogElement.addEventListener("keydown", handleKeyDown);

    return () => {
      dialogElement.removeEventListener("keydown", handleKeyDown);

      const focusRestoreTarget =
        previousFocusRef.current && previousFocusRef.current.isConnected ? previousFocusRef.current : triggerElement;

      focusRestoreTarget?.focus();
    };
  }, [isTargetExpanded]);

  async function submitPrompt() {
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

    if (!submissionEndpoint) {
      setScreenMode("generating");
      return;
    }

    setScreenMode("generating");
    setIsSubmitting(true);

    try {
      const response = await fetch(submissionEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          levelId: state.level.id,
          promptText: trimmedPrompt,
        }),
      });
      const body = (await response.json()) as SubmitAttemptSuccessResponse | SubmitAttemptErrorResponse;

      if (!body.ok) {
        setValidationMessage(body.message);
        setScreenMode("active");
        return;
      }

      if (!body.attempt.result.score) {
        setValidationMessage(body.attempt.result.errorMessage ?? "The attempt could not be completed. Try again.");
        setScreenMode("active");
        return;
      }

      setState((previousState) =>
        buildLiveScreenState({
          previousState,
          transition: body.transition,
          attempt: body.attempt,
          progress: body.progress,
          currentLevel: body.currentLevel,
        }),
      );
      setPromptText(trimmedPrompt);
      setScreenMode("result");
    } catch {
      setValidationMessage("The attempt could not be submitted. Try again.");
      setScreenMode("active");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderTargetStudyFrame(ariaLabel: string, expanded = false) {
    return (
      <div
        className={`${styles.studyFrame} ${expanded ? styles.studyFrameExpanded : ""}`.trim()}
        role="img"
        aria-label={ariaLabel}
      >
        <div className={styles.wall} />
        <div className={styles.table} />
        <div className={styles.cloth} />
        <div className={styles.bottle} />
        <div className={styles.plate} />
        <div className={styles.pearLeft} />
        <div className={styles.pearRight} />
      </div>
    );
  }

  function renderSummaryPage() {
    const summaryImprovementLabel = `${state.summaryPreview.improvementDelta > 0 ? "+" : ""}${state.summaryPreview.improvementDelta} pts`;
    const finalReplayLevel = state.summaryPreview.bestScores[state.summaryPreview.bestScores.length - 1];

    return (
      <main className={styles.page}>
        <section className={`${styles.promptPanel} ${styles.summaryPanel}`.trim()}>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>{uiCopy.gameplay.summary.eyebrow}</p>
            <h1 className={styles.promptTitle}>{uiCopy.gameplay.summary.title}</h1>
            <p className={styles.promptBody}>{uiCopy.gameplay.summary.body}</p>
          </header>

          <article className={`${styles.scoreHero} ${styles.scoreHeroPass}`} role="status">
            <div>
              <p className={styles.statLabel}>{uiCopy.gameplay.summary.packResult}</p>
              <p className={styles.scoreValue}>
                {state.summaryPreview.levelsCompleted}/{state.summaryPreview.bestScores.length}
              </p>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreHeadline}>{uiCopy.gameplay.summary.headline}</p>
              <p className={styles.scoreSummary}>{state.summaryPreview.improvementSummary}</p>
            </div>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.summary.levelsCleared}</span>
              <strong className={styles.statValue}>{state.summaryPreview.levelsCompleted}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.summary.totalAttempts}</span>
              <strong className={styles.statValue}>{state.summaryPreview.totalAttemptsUsed}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.summary.improvementTrend}</span>
              <strong className={styles.statValue}>{summaryImprovementLabel}</strong>
            </article>
          </div>

          <section className={styles.resultPanel}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>{uiCopy.gameplay.summary.replayEyebrow}</p>
                <h2 className={styles.resultPanelTitle}>{uiCopy.gameplay.summary.replayTitle}</h2>
              </div>
              <p className={styles.helperText}>{uiCopy.gameplay.summary.replayHelper}</p>
            </div>

            <div className={styles.summaryGrid}>
              {state.summaryPreview.bestScores.map((levelSummary) => (
                <article key={levelSummary.levelId} className={styles.summaryCard}>
                  <p className={styles.statLabel}>Level {levelSummary.levelNumber}</p>
                  <h3 className={styles.summaryTitle}>{levelSummary.levelTitle}</h3>
                  <p className={styles.summaryMeta}>
                    {uiCopy.gameplay.summary.buildReplayMeta(levelSummary.bestScore, levelSummary.attemptsUsed)}
                  </p>
                  <a className={styles.secondaryButton} href={levelSummary.replayHref}>
                    {uiCopy.gameplay.summary.buildReplayCta(levelSummary.levelNumber)}
                  </a>
                </article>
              ))}
            </div>
          </section>

          <article className={`${styles.feedback} ${styles.success}`}>
            <p className={styles.statLabel}>{uiCopy.gameplay.summary.nextReturn}</p>
            <p className={styles.submittedPrompt}>{state.summaryPreview.encouragement}</p>
          </article>

          <div className={styles.actionRow}>
            {finalReplayLevel ? (
              <a className={styles.button} href={finalReplayLevel.replayHref}>
                {uiCopy.gameplay.summary.replayFinalCta}
              </a>
            ) : null}
            <Link className={styles.secondaryButton} href="/">
              {uiCopy.gameplay.summary.backCta}
            </Link>
          </div>
        </section>
      </main>
    );
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

          {submissionEndpoint ? (
            <div className={styles.actionRow}>
              <button className={styles.button} type="button" disabled={isSubmitting}>
                {isSubmitting ? "Working..." : "Result incoming"}
              </button>
            </div>
          ) : (
            <div className={styles.actionRow}>
              <button className={styles.button} type="button" onClick={() => setScreenMode("result")}>
                Reveal Mock Result
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
                Back to Prompt
              </button>
            </div>
          )}
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
            <h2 className={styles.promptTitle}>
              {state.continuation.nextLevelTitle ? "Carry the momentum into the next image" : "Close out the run cleanly"}
            </h2>
            <p className={styles.promptBody}>
              {state.continuation.nextLevelTitle
                ? "Passing the threshold should roll straight into the next challenge. This mock continuation keeps the next level and replay options visible without exposing internal scoring details."
                : "The final cleared level should hand off to a compact summary instead of dropping the player into a dead end."}
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
            ) : (
              <button className={styles.button} type="button" onClick={() => setScreenMode("summary")}>
                View Final Summary
              </button>
            )}
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
          <p className={styles.eyebrow}>{uiCopy.gameplay.failure.eyebrow}</p>
          <h2 className={styles.promptTitle}>{uiCopy.gameplay.failure.title}</h2>
          <p className={styles.promptBody}>{uiCopy.gameplay.failure.body}</p>
        </header>

        <article className={`${styles.scoreHero} ${styles.scoreHeroFail}`} role="status">
          <div>
            <p className={styles.statLabel}>{uiCopy.gameplay.failure.strongestAttempt}</p>
            <p className={styles.scoreValue}>{state.failurePreview.strongestAttemptScore}%</p>
          </div>
          <div className={styles.scoreMeta}>
            <p className={styles.scoreHeadline}>{uiCopy.gameplay.failure.headline}</p>
            <p className={styles.scoreSummary}>{uiCopy.gameplay.failure.summary}</p>
          </div>
        </article>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>{uiCopy.gameplay.failure.threshold}</span>
            <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>{uiCopy.gameplay.failure.lastResult}</span>
            <strong className={styles.statValue}>{playerFacingScore.percentage}%</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>{uiCopy.gameplay.failure.attemptsLeft}</span>
            <strong className={styles.statValue}>{state.continuation.attemptsRemainingAfterResult}</strong>
          </article>
        </div>

        <section className={styles.resultPanel}>
          <div className={styles.resultPanelHeader}>
            <div>
              <p className={styles.eyebrow}>{uiCopy.gameplay.failure.contextEyebrow}</p>
              <h3 className={styles.resultPanelTitle}>{uiCopy.gameplay.failure.contextTitle}</h3>
            </div>
          </div>

          <p className={styles.targetCaption}>{state.failurePreview.summary}</p>

          <article className={styles.statCard}>
            <span className={styles.statLabel}>Last Submitted Prompt</span>
            <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
          </article>
        </section>

        <div className={styles.actionRow}>
          <a className={styles.button} href={state.continuation.restartLevelHref}>
            {uiCopy.gameplay.failure.restartCta}
          </a>
          <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("result")}>
            {uiCopy.gameplay.failure.reviewCta}
          </button>
        </div>
      </>
    );
  }

  if (screenMode === "summary") {
    return renderSummaryPage();
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

          {renderTargetStudyFrame(state.level.targetImage.alt)}

          <p className={styles.targetCaption}>
            Keep the target visible while you write. The mock artwork here stands in for the curated level image until
            the real asset pipeline lands.
          </p>

          <div className={styles.inspectControls}>
            <button
              ref={inspectTriggerRef}
              className={`${styles.secondaryButton} ${styles.inspectButton}`.trim()}
              type="button"
              onClick={() => setIsTargetExpanded(true)}
            >
              Expand Target Image
            </button>
            <p className={styles.helperText}>Use the larger study view on smaller screens when the framing needs a closer read.</p>
          </div>
        </section>

        <section className={styles.promptPanel}>{renderPromptPanel()}</section>
      </div>

      {isTargetExpanded ? (
        <div
          ref={inspectDialogRef}
          className={styles.inspectOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-target-title"
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsTargetExpanded(false);
            }
          }}
        >
          <div className={styles.inspectSheet}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>Expanded Target</p>
                <h2 className={styles.resultPanelTitle} id="expanded-target-title">
                  {state.level.title}
                </h2>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={() => setIsTargetExpanded(false)}>
                Close Study View
              </button>
            </div>

            {renderTargetStudyFrame(`Expanded view of ${state.level.targetImage.alt}`, true)}

            <p className={styles.targetCaption}>
              Inspect the composition, object spacing, and lighting cue placement here, then return to the prompt with
              the target still fresh in memory.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
