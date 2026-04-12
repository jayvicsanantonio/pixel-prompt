import { uiCopy } from "@/content";
import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, type LandingExperienceState, type Level } from "@/lib/game";
import { TargetStudyFrame } from "@/components/game/target-study-frame";
import { LandingAnalytics, NewRunLink, ResumeRunLink } from "./landing-telemetry";
import styles from "./landing-screen.module.css";

interface LandingScreenProps {
  landingState: LandingExperienceState;
  levels: Level[];
}

export function LandingScreen({ landingState, levels }: LandingScreenProps) {
  const landingCopy = uiCopy.landing;
  const featuredLevel = levels[0];
  const resumeLabel = landingCopy.resume.buildLabel(
    landingState.resume.currentLevelNumber,
    landingState.resume.available,
  );

  return (
    <main className={styles.page}>
      <LandingAnalytics landingState={landingState} />

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{landingCopy.eyebrow}</p>
            <h1 className={styles.headline}>{landingCopy.headline}</h1>
            <p className={styles.summary}>{landingCopy.summary}</p>
            <p className={styles.supportCopy}>{landingCopy.buildSupportCopy(MAX_ATTEMPTS_PER_LEVEL)}</p>
            <div className={styles.actionStack}>
              <article className={styles.actionCard}>
                <p className={styles.actionLabel}>{landingCopy.newRun.label}</p>
                <h2 className={styles.actionTitle}>{landingCopy.newRun.title}</h2>
                <p className={styles.actionBody}>{landingCopy.newRun.body}</p>
                <div className={styles.buttonRow}>
                  <NewRunLink className={styles.primaryAction} href={landingState.startHref} landingState={landingState}>
                    {landingCopy.newRun.cta}
                  </NewRunLink>
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
                    <ResumeRunLink
                      className={styles.secondaryAction}
                      href={landingState.resume.href}
                      landingState={landingState}
                    >
                      {resumeLabel}
                    </ResumeRunLink>
                  ) : (
                    <button className={styles.ghostAction} type="button" disabled>
                      {resumeLabel}
                    </button>
                  )}
                </div>
              </article>
            </div>
          </div>

          {featuredLevel ? (
            <aside className={styles.previewPanel} aria-labelledby="featured-level-title">
              <div className={styles.previewHeader}>
                <p className={styles.sectionLabel}>Featured Target</p>
                <h2 className={styles.previewTitle} id="featured-level-title">
                  {featuredLevel.title}
                </h2>
                <p className={styles.previewBody}>{featuredLevel.description}</p>
              </div>

              <TargetStudyFrame
                ariaLabel={`Target preview for ${featuredLevel.title}: ${featuredLevel.targetImage.alt}`}
                className={styles.previewFrame}
              />

              <div className={styles.previewMeta}>
                <span className={styles.metricPill}>Threshold {featuredLevel.threshold}%</span>
                <span className={styles.metricPill}>{featuredLevel.difficulty} difficulty</span>
                <span className={styles.metricPill}>{featuredLevel.theme} study</span>
              </div>

              <p className={styles.previewCaption}>{featuredLevel.targetImage.alt}</p>
            </aside>
          ) : null}
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
