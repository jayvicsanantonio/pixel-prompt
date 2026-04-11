"use client";

import Link from "next/link";
import { useEffect, useRef, type MutableRefObject } from "react";
import { uiCopy } from "@/content";
import { captureClientAnalyticsEvent } from "@/lib/analytics/client";
import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, type LandingExperienceState, type Level } from "@/lib/game";
import styles from "./landing-screen.module.css";

interface LandingScreenProps {
  landingState: LandingExperienceState;
  levels: Level[];
}

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
  const landingCopy = uiCopy.landing;
  const resumeLabel = landingCopy.resume.buildLabel(
    landingState.resume.currentLevelNumber,
    landingState.resume.available,
  );

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
            <p className={styles.eyebrow}>{landingCopy.eyebrow}</p>
            <h1 className={styles.headline}>{landingCopy.headline}</h1>
            <p className={styles.summary}>{landingCopy.summary}</p>
            <p className={styles.supportCopy}>{landingCopy.buildSupportCopy(MAX_ATTEMPTS_PER_LEVEL)}</p>
          </div>

          <div className={styles.actionStack}>
            <article className={styles.actionCard}>
              <p className={styles.actionLabel}>{landingCopy.newRun.label}</p>
              <h2 className={styles.actionTitle}>{landingCopy.newRun.title}</h2>
              <p className={styles.actionBody}>{landingCopy.newRun.body}</p>
              <div className={styles.buttonRow}>
                <Link className={styles.primaryAction} href={landingState.startHref} onClick={handleStartClick}>
                  {landingCopy.newRun.cta}
                </Link>
              </div>
            </article>

            <article
              className={`${styles.actionCard} ${
                landingState.resume.available ? styles.resumeReady : styles.resumeEmpty
              }`}
            >
              <p className={styles.actionLabel}>{landingCopy.resume.label}</p>
              <h2 className={styles.actionTitle}>{resumeLabel}</h2>
              <div className={styles.resumeMeta}>
                {landingState.resume.available ? (
                  <>
                    <p>
                      {landingCopy.resume.buildProgressLine(
                        landingState.resume.currentLevelTitle,
                        landingState.resume.attemptsRemaining,
                      )}
                    </p>
                    <p>
                      {landingCopy.resume.buildStatsLine(
                        landingState.resume.levelsCleared,
                        landingState.resume.bestScore ?? 0,
                      )}
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
            <span className={styles.sectionLabel}>{landingCopy.stats.promptBudget}</span>
            <strong className={styles.statValue}>{PROMPT_CHARACTER_LIMIT} chars</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.sectionLabel}>{landingCopy.stats.attemptsPerLevel}</span>
            <strong className={styles.statValue}>{MAX_ATTEMPTS_PER_LEVEL}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.sectionLabel}>{landingCopy.stats.launchLevels}</span>
            <strong className={styles.statValue}>{levels.length}</strong>
          </article>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <p className={styles.sectionLabel}>{landingCopy.roundStructure.label}</p>
          <h2 className={styles.sectionTitle}>{landingCopy.roundStructure.title}</h2>
        </header>
        <div className={styles.stepGrid}>
          {landingCopy.roundStructure.steps.map((step, index) => (
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
          <p className={styles.sectionLabel}>{landingCopy.levelPreview.label}</p>
          <h2 className={styles.sectionTitle}>{landingCopy.levelPreview.title}</h2>
        </header>
        <div className={styles.levelGrid}>
          {levels.map((level) => (
            <article key={level.id} className={styles.levelCard}>
              <p className={styles.levelMeta}>
                Level {level.number} · {level.difficulty}
              </p>
              <h3 className={styles.levelTitle}>{level.title}</h3>
              <p className={styles.levelDescription}>{level.description}</p>
              <p className={styles.levelThreshold}>{landingCopy.levelPreview.buildThresholdLabel(level.threshold)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
