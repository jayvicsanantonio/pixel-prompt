"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { levels, uiCopy } from "@/content";
import { captureClientAnalyticsEvent } from "@/lib/analytics/client";
import {
  toPlayerFacingScore,
  type ActiveLevelScreenState,
  type GameProgress,
  type LandingExperienceState,
  type Level,
  type LevelAttempt,
} from "@/lib/game";
import { buildFailurePreview, buildResultPreview, buildSummaryPreview, findLevelProgress } from "@/lib/game/screen-state";
import styles from "./active-level-screen.module.css";

interface ActiveLevelScreenProps {
  state: ActiveLevelScreenState;
  submissionEndpoint?: string;
  restartLevelEndpoint?: string;
  replayLevelEndpoint?: string;
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

interface ProgressMutationSuccessResponse {
  ok: true;
  currentLevel: Level | null;
  landing: LandingExperienceState;
  progress: GameProgress;
}

interface ProgressMutationErrorResponse {
  ok: false;
  code: string;
  message: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function safeCaptureClientAnalyticsEvent(event: Parameters<typeof captureClientAnalyticsEvent>[0]) {
  try {
    captureClientAnalyticsEvent(event);
  } catch {
    // Telemetry failures must never block gameplay transitions.
  }
}

function buildLiveScreenState(input: {
  previousState: ActiveLevelScreenState;
  transition: SubmitAttemptSuccessResponse["transition"];
  attempt: LevelAttempt;
  progress: GameProgress;
  currentLevel: Level | null;
}): ActiveLevelScreenState {
  const attemptedLevel = levels.find((level) => level.id === input.attempt.levelId) ?? input.previousState.level;
  const attemptedLevelProgress = findLevelProgress(input.progress, attemptedLevel.id);
  const nextLevel =
    input.transition === "passed" && input.currentLevel && input.currentLevel.id !== attemptedLevel.id ? input.currentLevel : null;
  const strongestAttemptScore =
    input.attempt.result.strongestAttemptScore ?? attemptedLevelProgress?.bestScore ?? input.previousState.failurePreview.strongestAttemptScore;

  return {
    level: attemptedLevel,
    attemptsUsed: attemptedLevelProgress?.attemptsUsed ?? input.previousState.attemptsUsed,
    attemptsRemaining: attemptedLevelProgress?.attemptsRemaining ?? input.previousState.attemptsRemaining,
    promptDraft: input.attempt.promptText,
    resultPreview: buildResultPreview(attemptedLevel, input.attempt),
    continuation: {
      attemptsRemainingAfterResult:
        attemptedLevelProgress?.attemptsRemaining ?? input.previousState.continuation.attemptsRemainingAfterResult,
      nextLevelHref: nextLevel ? `/play?level=${nextLevel.number}` : null,
      nextLevelNumber: nextLevel?.number ?? null,
      nextLevelTitle: nextLevel?.title ?? null,
      restartLevelHref: `/play?level=${attemptedLevel.number}`,
    },
    failurePreview: {
      // Preserve the previously known strongest score if the live response omits it during a client-side transition.
      ...buildFailurePreview({
        level: attemptedLevel,
        attempt: input.attempt,
        progress: input.progress,
      }),
      strongestAttemptScore,
    },
    summaryPreview: buildSummaryPreview(input.progress),
  };
}

function buildResetScreenState(input: {
  previousState: ActiveLevelScreenState;
  currentLevel: Level;
  progress: GameProgress;
}): ActiveLevelScreenState {
  const currentLevelProgress = findLevelProgress(input.progress, input.currentLevel.id);
  const nextLevel = levels.find((level) => level.number === input.currentLevel.number + 1) ?? null;

  return {
    ...input.previousState,
    level: input.currentLevel,
    attemptsUsed: currentLevelProgress?.attemptsUsed ?? 0,
    attemptsRemaining: currentLevelProgress?.attemptsRemaining ?? input.currentLevel.maxAttempts,
    promptDraft: "",
    continuation: {
      attemptsRemainingAfterResult: currentLevelProgress?.attemptsRemaining ?? input.currentLevel.maxAttempts,
      nextLevelHref: nextLevel ? `/play?level=${nextLevel.number}` : null,
      nextLevelNumber: nextLevel?.number ?? null,
      nextLevelTitle: nextLevel?.title ?? null,
      restartLevelHref: `/play?level=${input.currentLevel.number}`,
    },
    summaryPreview: buildSummaryPreview(input.progress),
  };
}

export function ActiveLevelScreen({
  state: initialState,
  submissionEndpoint,
  restartLevelEndpoint,
  replayLevelEndpoint,
}: ActiveLevelScreenProps) {
  const [state, setState] = useState(initialState);
  const [promptText, setPromptText] = useState(initialState.promptDraft);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<
    "active" | "generating" | "result" | "success" | "retry" | "failure" | "summary"
  >(initialState.initialScreenMode ?? "active");
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState(initialState.promptDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioningLevel, setIsTransitioningLevel] = useState(false);
  const inspectDialogRef = useRef<HTMLDivElement | null>(null);
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastStartedLevelKeyRef = useRef<string | null>(null);
  const characterCount = promptText.length;
  const characterLimit = state.level.promptCharacterLimit;
  const isOverLimit = characterCount > characterLimit;
  const promptFeedbackId = validationMessage ? "prompt-feedback" : undefined;
  const promptDescribedBy = ["prompt-guidance", "prompt-counter", promptFeedbackId].filter(Boolean).join(" ");
  const playerFacingScore = toPlayerFacingScore(state.resultPreview.score);
  const hasRetryRemaining = state.continuation.attemptsRemainingAfterResult > 0;

  const buildLevelStartedKey = useCallback(
    (level: Level, analyticsOverride?: ActiveLevelScreenState["analytics"]) =>
      `${analyticsOverride?.runId ??
        state.analytics?.runId ??
        analyticsOverride?.anonymousPlayerId ??
        state.analytics?.anonymousPlayerId ??
        "anon"}:${level.id}:${level.number}`,
    [state.analytics?.anonymousPlayerId, state.analytics?.runId],
  );

  const emitLevelStarted = useCallback(
    (level: Level, analyticsOverride?: ActiveLevelScreenState["analytics"], occurredAt = new Date().toISOString()) => {
      safeCaptureClientAnalyticsEvent({
        name: "level_started",
        occurredAt,
        anonymousPlayerId: analyticsOverride?.anonymousPlayerId ?? state.analytics?.anonymousPlayerId,
        ...(analyticsOverride?.runId ?? state.analytics?.runId
          ? {
              runId: analyticsOverride?.runId ?? state.analytics?.runId,
            }
          : {}),
        levelId: level.id,
        levelNumber: level.number,
        threshold: level.threshold,
        attemptWindow: level.maxAttempts,
      });
      lastStartedLevelKeyRef.current = buildLevelStartedKey(level, analyticsOverride);
    },
    [buildLevelStartedKey, state.analytics?.anonymousPlayerId, state.analytics?.runId],
  );

  async function mutateLevelProgress(endpoint: string | undefined, levelId: string) {
    if (!endpoint) {
      return false;
    }

    setIsTransitioningLevel(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          levelId,
        }),
      });
      const body = (await response.json()) as ProgressMutationSuccessResponse | ProgressMutationErrorResponse;
      const currentLevel = body.ok ? body.currentLevel : null;

      if (!body.ok || !currentLevel) {
        setValidationMessage(body.ok ? uiCopy.gameplay.errors.actionFailed : body.message);
        setScreenMode("active");
        return false;
      }

      setValidationMessage(null);
      setSubmittedPrompt("");
      setPromptText("");
      setState((previousState) =>
        ({
          ...buildResetScreenState({
            previousState,
            currentLevel,
            progress: body.progress,
          }),
          analytics: {
            anonymousPlayerId: body.progress.playerId,
            runId: body.progress.runId,
          },
        }) satisfies ActiveLevelScreenState,
      );
      const occurredAt = new Date().toISOString();

      if (endpoint === restartLevelEndpoint) {
        safeCaptureClientAnalyticsEvent({
          name: "level_restarted",
          occurredAt,
          anonymousPlayerId: body.progress.playerId,
          runId: body.progress.runId,
          levelId: currentLevel.id,
          levelNumber: currentLevel.number,
          priorAttemptsUsed: state.attemptsUsed,
          bestScoreBeforeRestart: state.failurePreview.strongestAttemptScore,
        });
      }

      emitLevelStarted(
        currentLevel,
        {
          anonymousPlayerId: body.progress.playerId,
          runId: body.progress.runId,
        },
        occurredAt,
      );
      setScreenMode("active");
      return true;
    } catch {
      setValidationMessage(uiCopy.gameplay.errors.actionFailed);
      setScreenMode("active");
      return false;
    } finally {
      setIsTransitioningLevel(false);
    }
  }

  useEffect(() => {
    setState(initialState);
    setPromptText(initialState.promptDraft);
    setSubmittedPrompt(initialState.promptDraft);
    setValidationMessage(null);
    setScreenMode(initialState.initialScreenMode ?? "active");
    setIsSubmitting(false);
    setIsTargetExpanded(false);
    setIsTransitioningLevel(false);
  }, [initialState]);

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

  useEffect(() => {
    if (screenMode !== "active") {
      return;
    }

    const levelStartedKey = buildLevelStartedKey(state.level);

    if (lastStartedLevelKeyRef.current === levelStartedKey) {
      return;
    }

    emitLevelStarted(state.level);
  }, [buildLevelStartedKey, emitLevelStarted, screenMode, state.level]);

  async function submitPrompt() {
    const trimmedPrompt = promptText.trim();

    if (trimmedPrompt.length === 0) {
      setValidationMessage(uiCopy.gameplay.active.emptyValidation);
      return;
    }

    if (characterCount > characterLimit) {
      setValidationMessage(uiCopy.gameplay.active.buildOverLimitValidation(characterLimit));
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
        setValidationMessage(body.attempt.result.errorMessage ?? uiCopy.gameplay.errors.attemptIncomplete);
        setScreenMode("active");
        return;
      }

      setState((previousState) =>
        ({
          ...buildLiveScreenState({
            previousState,
            transition: body.transition,
            attempt: body.attempt,
            progress: body.progress,
            currentLevel: body.currentLevel,
          }),
          analytics: {
            anonymousPlayerId: body.progress.playerId,
            runId: body.progress.runId,
          },
        }) satisfies ActiveLevelScreenState,
      );
      setPromptText(trimmedPrompt);
      setScreenMode("result");
    } catch {
      setValidationMessage(uiCopy.gameplay.errors.submitFailed);
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
                  <p className={styles.statLabel}>
                    {uiCopy.gameplay.topBar.level} {levelSummary.levelNumber}
                  </p>
                  <h3 className={styles.summaryTitle}>{levelSummary.levelTitle}</h3>
                  <p className={styles.summaryMeta}>
                    {uiCopy.gameplay.summary.buildReplayMeta(levelSummary.bestScore, levelSummary.attemptsUsed)}
                  </p>
                  {replayLevelEndpoint ? (
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={isTransitioningLevel}
                      onClick={() => {
                        void mutateLevelProgress(replayLevelEndpoint, levelSummary.levelId);
                      }}
                    >
                      {uiCopy.gameplay.summary.buildReplayCta(levelSummary.levelNumber)}
                    </button>
                  ) : (
                    <a className={styles.secondaryButton} href={levelSummary.replayHref}>
                      {uiCopy.gameplay.summary.buildReplayCta(levelSummary.levelNumber)}
                    </a>
                  )}
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
              replayLevelEndpoint ? (
                <button
                  className={styles.button}
                  type="button"
                  disabled={isTransitioningLevel}
                  onClick={() => {
                    void mutateLevelProgress(replayLevelEndpoint, finalReplayLevel.levelId);
                  }}
                >
                  {uiCopy.gameplay.summary.replayFinalCta}
                </button>
              ) : (
                <a className={styles.button} href={finalReplayLevel.replayHref}>
                  {uiCopy.gameplay.summary.replayFinalCta}
                </a>
              )
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
            <p className={styles.eyebrow}>{uiCopy.gameplay.active.eyebrow}</p>
            <h2 className={styles.promptTitle}>{uiCopy.gameplay.active.title}</h2>
            <p className={styles.promptBody}>{uiCopy.gameplay.active.body}</p>
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
              {uiCopy.gameplay.active.label}
            </label>
            <textarea
              id="prompt"
              aria-describedby={promptDescribedBy}
              aria-invalid={validationMessage !== null}
              className={styles.textarea}
              name="prompt"
              placeholder={uiCopy.gameplay.active.placeholder}
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
                {uiCopy.gameplay.active.submitCta}
              </button>
            </div>
          </form>

          <p className={styles.helperText}>
            <span id="prompt-guidance">{uiCopy.gameplay.active.guidance}</span>
          </p>

          {validationMessage ? (
            <p className={`${styles.feedback} ${styles.error}`} id="prompt-feedback" role="alert">
              {validationMessage}
            </p>
          ) : null}

          <p className={styles.helperText}>{uiCopy.gameplay.active.helper}</p>
        </>
      );
    }

    if (screenMode === "generating") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>{uiCopy.gameplay.generating.eyebrow}</p>
            <h2 className={styles.promptTitle}>{uiCopy.gameplay.generating.title}</h2>
            <p className={styles.promptBody}>{uiCopy.gameplay.generating.body}</p>
          </header>

          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressBar} />
          </div>

          <article className={`${styles.feedback} ${styles.success}`} role="status">
            <p className={styles.statLabel}>{uiCopy.gameplay.generating.submittedPrompt}</p>
            <p className={styles.submittedPrompt}>{submittedPrompt}</p>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.generating.requiredScore}</span>
              <strong className={styles.statValue}>{state.level.threshold}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.generating.attemptsOnTheLine}</span>
              <strong className={styles.statValue}>1</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.generating.nextState}</span>
              <strong className={styles.statValue}>{uiCopy.gameplay.generating.nextStateValue}</strong>
            </article>
          </div>

          <p className={styles.helperText}>{uiCopy.gameplay.generating.helper}</p>

          {submissionEndpoint ? (
            <div className={styles.actionRow}>
              <button className={styles.button} type="button" disabled={isSubmitting}>
                {isSubmitting ? uiCopy.gameplay.generating.workingCta : uiCopy.gameplay.generating.pendingCta}
              </button>
            </div>
          ) : (
            <div className={styles.actionRow}>
              <button className={styles.button} type="button" onClick={() => setScreenMode("result")}>
                {uiCopy.gameplay.generating.revealCta}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
                {uiCopy.gameplay.generating.backCta}
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
            <p className={styles.eyebrow}>{uiCopy.gameplay.result.eyebrow}</p>
            <h2 className={styles.promptTitle}>{uiCopy.gameplay.result.title}</h2>
            <p className={styles.promptBody}>{uiCopy.gameplay.result.body}</p>
          </header>

          <article
            className={`${styles.scoreHero} ${playerFacingScore.passed ? styles.scoreHeroPass : styles.scoreHeroFail}`}
            role="status"
          >
            <div>
              <p className={styles.statLabel}>{uiCopy.gameplay.result.score}</p>
              <p className={styles.scoreValue}>{playerFacingScore.percentage}%</p>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreHeadline}>
                {playerFacingScore.passed ? uiCopy.gameplay.result.passedHeadline : uiCopy.gameplay.result.failedHeadline}
              </p>
              <p className={styles.scoreSummary}>
                {playerFacingScore.passed
                  ? uiCopy.gameplay.result.buildPassedSummary(playerFacingScore.threshold, state.level.number)
                  : uiCopy.gameplay.result.buildFailedSummary(playerFacingScore.threshold)}
              </p>
            </div>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.result.submittedPrompt}</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.result.threshold}</span>
              <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.result.outcome}</span>
              <strong className={styles.statValue}>
                {playerFacingScore.passed ? uiCopy.gameplay.result.passOutcome : uiCopy.gameplay.result.retryOutcome}
              </strong>
            </article>
          </div>

          <section className={styles.resultPanel} aria-labelledby="generated-match-title">
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>{uiCopy.gameplay.result.generatedImageEyebrow}</p>
                <h3 className={styles.resultPanelTitle} id="generated-match-title">
                  {uiCopy.gameplay.result.generatedImageTitle}
                </h3>
              </div>
              <p className={styles.helperText}>{uiCopy.gameplay.result.generatedImageHelper}</p>
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
                {uiCopy.gameplay.result.successCta}
              </button>
            ) : hasRetryRemaining ? (
              <button className={styles.button} type="button" onClick={() => setScreenMode("retry")}>
                {uiCopy.gameplay.result.retryCta}
              </button>
            ) : (
              <button className={styles.button} type="button" onClick={() => setScreenMode("failure")}>
                {uiCopy.gameplay.result.failureCta}
              </button>
            )}

            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
              {playerFacingScore.passed ? uiCopy.gameplay.result.passedSecondaryCta : uiCopy.gameplay.result.failedSecondaryCta}
            </button>
          </div>
        </>
      );
    }

    if (screenMode === "success") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>{uiCopy.gameplay.success.eyebrow}</p>
            <h2 className={styles.promptTitle}>{uiCopy.gameplay.success.buildTitle(Boolean(state.continuation.nextLevelTitle))}</h2>
            <p className={styles.promptBody}>{uiCopy.gameplay.success.buildBody(Boolean(state.continuation.nextLevelTitle))}</p>
          </header>

          <article className={`${styles.feedback} ${styles.success}`} role="status">
            <p className={styles.statLabel}>{uiCopy.gameplay.success.clearedWith}</p>
            <p className={styles.submittedPrompt}>
              {playerFacingScore.percentage}% match on {uiCopy.gameplay.topBar.level} {state.level.number}
            </p>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.success.unlocked}</span>
              <strong className={styles.statValue}>
                {state.continuation.nextLevelNumber ? `Level ${state.continuation.nextLevelNumber}` : "Summary"}
              </strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.success.unusedAttempts}</span>
              <strong className={styles.statValue}>{state.continuation.attemptsRemainingAfterResult}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.success.submittedPrompt}</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
          </div>

          <section className={styles.resultPanel}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>{uiCopy.gameplay.success.nextStepEyebrow}</p>
                <h3 className={styles.resultPanelTitle}>{state.continuation.nextLevelTitle ?? uiCopy.gameplay.success.fallbackTitle}</h3>
              </div>
            </div>

            <p className={styles.targetCaption}>{uiCopy.gameplay.success.buildNextStepCaption(state.continuation.nextLevelNumber)}</p>
          </section>

          <div className={styles.actionRow}>
            {state.continuation.nextLevelHref ? (
              <Link className={styles.button} href={state.continuation.nextLevelHref}>
                Continue to {uiCopy.gameplay.topBar.level} {state.continuation.nextLevelNumber}
              </Link>
            ) : (
              <button className={styles.button} type="button" onClick={() => setScreenMode("summary")}>
                {uiCopy.gameplay.success.viewSummaryCta}
              </button>
            )}
            {replayLevelEndpoint ? (
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={isTransitioningLevel}
                onClick={() => {
                  void mutateLevelProgress(replayLevelEndpoint, state.level.id);
                }}
              >
                {uiCopy.gameplay.success.replayCta}
              </button>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("active")}>
                {uiCopy.gameplay.success.replayCta}
              </button>
            )}
          </div>
        </>
      );
    }

    if (screenMode === "retry") {
      return (
        <>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>{uiCopy.gameplay.retry.eyebrow}</p>
            <h2 className={styles.promptTitle}>{uiCopy.gameplay.retry.title}</h2>
            <p className={styles.promptBody}>{uiCopy.gameplay.retry.body}</p>
          </header>

          <article className={`${styles.scoreHero} ${styles.scoreHeroFail}`} role="status">
            <div>
              <p className={styles.statLabel}>{uiCopy.gameplay.retry.attemptsLeft}</p>
              <p className={styles.scoreValue}>{state.continuation.attemptsRemainingAfterResult}</p>
            </div>
            <div className={styles.scoreMeta}>
              <p className={styles.scoreHeadline}>{uiCopy.gameplay.retry.buildHeadline(state.continuation.attemptsRemainingAfterResult)}</p>
              <p className={styles.scoreSummary}>{uiCopy.gameplay.retry.summary}</p>
            </div>
          </article>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.retry.currentScore}</span>
              <strong className={styles.statValue}>{playerFacingScore.percentage}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.retry.threshold}</span>
              <strong className={styles.statValue}>{playerFacingScore.threshold}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>{uiCopy.gameplay.retry.submittedPrompt}</span>
              <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
            </article>
          </div>

          <section className={styles.resultPanel}>
            <div className={styles.resultPanelHeader}>
              <div>
                <p className={styles.eyebrow}>{uiCopy.gameplay.retry.adviceEyebrow}</p>
                <h3 className={styles.resultPanelTitle}>{uiCopy.gameplay.retry.adviceTitle}</h3>
              </div>
            </div>

            <p className={styles.targetCaption}>{uiCopy.gameplay.retry.adviceBody}</p>
          </section>

          <div className={styles.actionRow}>
            <button className={styles.button} type="button" onClick={() => setScreenMode("active")}>
              {uiCopy.gameplay.retry.reviseCta}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setScreenMode("result")}>
              {uiCopy.gameplay.retry.reviewCta}
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
            <span className={styles.statLabel}>{uiCopy.gameplay.failure.lastSubmittedPrompt}</span>
            <strong className={styles.resultPrompt}>{submittedPrompt}</strong>
          </article>
        </section>

        <div className={styles.actionRow}>
          {restartLevelEndpoint ? (
            <button
              className={styles.button}
              type="button"
              disabled={isTransitioningLevel}
              onClick={() => {
                void mutateLevelProgress(restartLevelEndpoint, state.level.id);
              }}
            >
              {uiCopy.gameplay.failure.restartCta}
            </button>
          ) : (
            <a className={styles.button} href={state.continuation.restartLevelHref}>
              {uiCopy.gameplay.failure.restartCta}
            </a>
          )}
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
          {uiCopy.gameplay.backToLanding}
        </Link>
        <div className={styles.topMeta}>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>{uiCopy.gameplay.topBar.level}</span>
            <strong className={styles.badgeValue}>
              {state.level.number}. {state.level.title}
            </strong>
          </article>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>{uiCopy.gameplay.topBar.requiredScore}</span>
            <strong className={styles.badgeValue}>{state.level.threshold}%</strong>
          </article>
          <article className={styles.badge}>
            <span className={styles.badgeLabel}>{uiCopy.gameplay.topBar.attemptsLeft}</span>
            <strong className={styles.badgeValue}>{state.attemptsRemaining}</strong>
          </article>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.targetPanel}>
          <header className={styles.panelHeader}>
            <p className={styles.eyebrow}>{uiCopy.gameplay.targetPanel.eyebrow}</p>
            <h1 className={styles.targetTitle}>{state.level.title}</h1>
            <p className={styles.targetDescription}>{state.level.description}</p>
          </header>

          {renderTargetStudyFrame(state.level.targetImage.alt)}

          <p className={styles.targetCaption}>{uiCopy.gameplay.targetPanel.caption}</p>

          <div className={styles.inspectControls}>
            <button
              ref={inspectTriggerRef}
              className={`${styles.secondaryButton} ${styles.inspectButton}`.trim()}
              type="button"
              onClick={() => setIsTargetExpanded(true)}
            >
              {uiCopy.gameplay.targetPanel.expandCta}
            </button>
            <p className={styles.helperText}>{uiCopy.gameplay.targetPanel.expandHelper}</p>
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
                <p className={styles.eyebrow}>{uiCopy.gameplay.targetPanel.expandedEyebrow}</p>
                <h2 className={styles.resultPanelTitle} id="expanded-target-title">
                  {state.level.title}
                </h2>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={() => setIsTargetExpanded(false)}>
                {uiCopy.gameplay.targetPanel.closeCta}
              </button>
            </div>

            {renderTargetStudyFrame(`Expanded view of ${state.level.targetImage.alt}`, true)}

            <p className={styles.targetCaption}>{uiCopy.gameplay.targetPanel.expandedCaption}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
