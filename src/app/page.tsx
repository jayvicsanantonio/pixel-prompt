import { levels } from "@/content";
import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT } from "@/lib/game";
import styles from "./page.module.css";

const pillars = [
  {
    title: "Observe",
    body: "Study a target image closely enough to notice subject, material, style, and composition.",
  },
  {
    title: "Prompt",
    body: "Describe the image under a short character limit so each word carries intent.",
  },
  {
    title: "Compare",
    body: "Score the generated result against the target and learn from retries instead of guessing blindly.",
  },
];

const repoAreas = [
  "src/app for the web surface",
  "src/server for persistence and provider adapters",
  "src/content for levels and tip rules",
  "tests for unit and end-to-end coverage",
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Phase 0 foundation scaffold</p>
        <h1>Pixel Prompt</h1>
        <p className={styles.summary}>
          The repository now has a live Next.js application shell, testing harness, and folder boundaries for
          gameplay, server logic, content, and analytics work.
        </p>
      </section>

      <section className={styles.panel}>
        <h2>Core loop</h2>
        <div className={styles.pillars}>
          {pillars.map((pillar) => (
            <article key={pillar.title} className={styles.card}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>Current stack</h2>
          <ul className={styles.list}>
            <li>Next.js 16.2.1 with React 19.2.4</li>
            <li>PostgreSQL plus Drizzle ORM</li>
            <li>PostHog for analytics</li>
            <li>Vitest, React Testing Library, and Playwright</li>
            <li>{PROMPT_CHARACTER_LIMIT}-character prompt limit and {MAX_ATTEMPTS_PER_LEVEL} scored attempts per level</li>
          </ul>
        </article>

        <article className={styles.panel}>
          <h2>Repo structure</h2>
          <ul className={styles.list}>
            {repoAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </article>

        <article className={styles.panel}>
          <h2>Seeded thresholds</h2>
          <ul className={styles.list}>
            {levels.map((level) => (
              <li key={level.id}>
                Level {level.number}: {level.threshold}%
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
