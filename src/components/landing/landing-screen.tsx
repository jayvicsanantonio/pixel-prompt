"use client";

import Link from "next/link";
import { useEffect, useRef, type MutableRefObject } from "react";
import { captureClientAnalyticsEvent } from "@/lib/analytics/client";
import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, type LandingExperienceState, type Level } from "@/lib/game";
import styles from "./landing-screen.module.css";

interface LandingScreenProps {
  landingState: LandingExperienceState;
  levels: Level[];
}

const learningSteps = [
  {
    title: "Study the target",
    body: "Keep the reference image visible while you scan for subject, material, lighting, and composition cues.",
  },
  {
    title: "Write a tight prompt",
    body: "The prompt limit keeps the challenge sharp, so players have to choose specific visual details instead of filler.",
  },
  {
    title: "Score and retry",
    body: "Each submission returns a match score, and failed attempts turn into guided practice instead of dead ends.",
  },
] as const;

function sendOneShotAnalytics(flagRef: MutableRefObject<boolean>, emitEvents: (occurredAt: string) => void) {
  if (flagRef.current) {
    return;
  }

  flagRef.current = true;
  emitEvents(new Date().toISOString());
}

export function LandingScreen({ landingState, levels }: LandingScreenProps) {
  const hasTrackedLandingView = useRef(false);
  const hasTrackedStartClick = useRef(false);
  const hasTrackedResumeClick = useRef(false);
  const resumeLabel = landingState.resume.available
    ? `Resume Level ${landingState.resume.currentLevelNumber}`
    : "Resume saved run";

  useEffect(() => {
    if (hasTrackedLandingView.current) {
      return;
    }

    hasTrackedLandingView.current = true;
    const occurredAt = new Date().toISOString();

    captureClientAnalyticsEvent({
      name: "landing_viewed",
      occurredAt,
    });

    if (landingState.resume.available) {
      captureClientAnalyticsEvent({
        name: "resume_offered",
        occurredAt,
        runId: landingState.resume.runId,
        levelId: landingState.resume.currentLevelId,
        levelNumber: landingState.resume.currentLevelNumber,
        highestUnlockedLevelNumber: landingState.resume.highestUnlockedLevelNumber,
      });
    }
  }, [landingState.resume]);

  function handleStartClick() {
    sendOneShotAnalytics(hasTrackedStartClick, (occurredAt) => {
      captureClientAnalyticsEvent({
        name: "game_started",
        occurredAt,
        entry: "new",
      });
    });
  }

  function handleResumeClick() {
    const resumeState = landingState.resume;

    if (!resumeState.available) {
      return;
    }

    sendOneShotAnalytics(hasTrackedResumeClick, (occurredAt) => {
      captureClientAnalyticsEvent({
        name: "game_started",
        occurredAt,
        runId: resumeState.runId,
        entry: "resume",
      });
      captureClientAnalyticsEvent({
        name: "resume_started",
        occurredAt,
        runId: resumeState.runId,
        currentLevelId: resumeState.currentLevelId,
      });
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Prompt Match Game</p>
            <h1 className={styles.headline}>Study the image. Write the prompt. Beat the threshold.</h1>
            <p className={styles.summary}>
              Pixel Prompt teaches prompt writing through short visual matching rounds. Players compare a target image,
              describe it under pressure, and learn from the score instead of guessing what mattered.
            </p>
            <p className={styles.supportCopy}>
              The MVP loop is deliberately tight: one target image, one concise prompt, one scored result, and up to{" "}
              {MAX_ATTEMPTS_PER_LEVEL} tries to improve before the level locks.
            </p>
          </div>

          <div className={styles.actionStack}>
            <article className={styles.actionCard}>
              <p className={styles.actionLabel}>New Run</p>
              <h2 className={styles.actionTitle}>Start fresh from Level 1</h2>
              <p className={styles.actionBody}>
                First-time players get the premise in one screen and can jump straight into the opening challenge.
              </p>
              <div className={styles.buttonRow}>
                <Link className={styles.primaryAction} href={landingState.startHref} onClick={handleStartClick}>
                  Start Game
                </Link>
              </div>
            </article>

            <article
              className={`${styles.actionCard} ${
                landingState.resume.available ? styles.resumeReady : styles.resumeEmpty
              }`}
            >
              <p className={styles.actionLabel}>Saved Run</p>
              <h2 className={styles.actionTitle}>{resumeLabel}</h2>
              <div className={styles.resumeMeta}>
                {landingState.resume.available ? (
                  <>
                    <p>
                      Continue at <strong>{landingState.resume.currentLevelTitle}</strong> with{" "}
                      <strong>{landingState.resume.attemptsRemaining}</strong> attempts left.
                    </p>
                    <p>
                      Cleared <strong>{landingState.resume.levelsCleared}</strong>{" "}
                      {landingState.resume.levelsCleared === 1 ? "level" : "levels"} and banked a best score of{" "}
                      <strong>{landingState.resume.bestScore}%</strong> on the current run.
                    </p>
                  </>
                ) : (
                  <p>{landingState.resume.helperText}</p>
                )}
              </div>
              <div className={styles.buttonRow}>
                {landingState.resume.available ? (
                  <Link className={styles.secondaryAction} href={landingState.resume.href} onClick={handleResumeClick}>
                    {resumeLabel}
                  </Link>
                ) : (
                  <span className={styles.ghostAction} aria-disabled="true">
                    {resumeLabel}
                  </span>
                )}
              </div>
            </article>
          </div>
        </div>

        <div className={styles.statRail}>
          <article className={styles.statCard}>
            <span className={styles.sectionLabel}>Prompt Budget</span>
            <strong className={styles.statValue}>{PROMPT_CHARACTER_LIMIT} chars</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.sectionLabel}>Attempts Per Level</span>
            <strong className={styles.statValue}>{MAX_ATTEMPTS_PER_LEVEL}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.sectionLabel}>Seeded Launch Levels</span>
            <strong className={styles.statValue}>{levels.length}</strong>
          </article>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <p className={styles.sectionLabel}>Round Structure</p>
          <h2 className={styles.sectionTitle}>A fast loop that teaches observation through repetition</h2>
        </header>
        <div className={styles.stepGrid}>
          {learningSteps.map((step, index) => (
            <article key={step.title} className={styles.stepCard}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <p className={styles.sectionLabel}>Level Preview</p>
          <h2 className={styles.sectionTitle}>The first three thresholds scale from warm-up to precision</h2>
        </header>
        <div className={styles.levelGrid}>
          {levels.map((level) => (
            <article key={level.id} className={styles.levelCard}>
              <p className={styles.levelMeta}>
                Level {level.number} · {level.difficulty}
              </p>
              <h3 className={styles.levelTitle}>{level.title}</h3>
              <p className={styles.levelDescription}>{level.description}</p>
              <p className={styles.levelThreshold}>Pass at {level.threshold}% match</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
