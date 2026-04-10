# Phase 1 Agent 5 Task: QA Matrix

Status: completed on 2026-04-07

This matrix turns the PRD edge cases and `TASKS.md` acceptance criteria into a concrete verification plan for the current repository state. It separates coverage that already exists in automated tests from flows that still need manual browser validation once the `/play` route is wired to the live backend in Phase 2.

## Ownership Legend

- Agent 2: player UI, client validation, keyboard flow, responsive and recoverable screen states
- Agent 3: session state, persistence, resume/restart/replay invariants, server validation, idempotency
- Agent 4: generation/scoring providers, failure taxonomy, timeouts, content-policy and asset-loading behavior
- Agent 5: level fairness, tip quality, analytics validation, and release sign-off

## Coverage Legend

- Automated: directly covered by the current unit or HTTP tests
- Partial: core logic is covered, but browser-level or full integration verification is still required
- Manual: no direct automated coverage yet; validate during Phase 2 or Phase 3 QA

## Core Regression Sweep

| Flow | Owners | Expected behavior | Coverage | Current evidence |
| --- | --- | --- | --- | --- |
| First visit and new run start | Agent 2, Agent 3 | Landing explains the premise quickly, new run starts at Level 1, and no session is created until needed | Automated | `tests/unit/app/landing-screen.test.tsx`, `tests/unit/server/game-http.test.ts` |
| Resume existing run | Agent 2, Agent 3 | Landing offers resume, restores the current level, and keeps cleared progress intact | Automated | `tests/unit/app/landing-screen.test.tsx`, `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-http-analytics.test.ts` |
| Passing attempt advances progression | Agent 2, Agent 3, Agent 4 | Valid scored submission advances to the next level and retains best-score history | Automated | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-session-state.test.ts` |
| Failed scored attempt returns tips | Agent 2, Agent 3, Agent 5 | Below-threshold result consumes one attempt, shows tips, and keeps the level active | Automated | `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-http.test.ts` |
| Final failure exposes restart path | Agent 2, Agent 3 | Third scored miss fails the level, surfaces strongest-attempt context, and requires restart before more submissions | Automated | `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-session-state.test.ts` |
| Replay keeps unlocked progression | Agent 2, Agent 3 | Replaying a cleared level never reduces the highest unlocked level | Automated | `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-session-state.test.ts` |
| Final level completion shows summary | Agent 2, Agent 3 | Clearing the seeded run exposes summary and replay entry points | Automated | `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-http-analytics.test.ts` |
| Gameplay telemetry is emitted once per real transition | Agent 3, Agent 5 | Landing, start/resume, level-start, and happy/failure gameplay analytics are emitted without duplicate idempotent retries | Automated | `tests/unit/app/landing-screen.test.tsx`, `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-analytics.test.ts`, `tests/unit/server/game-http-analytics.test.ts` |

## PRD Edge-Case Matrix

| Scenario | Owners | Expected behavior | Coverage | Current evidence | Manual QA focus |
| --- | --- | --- | --- | --- | --- |
| Empty prompt submission | Agent 2, Agent 3 | Client blocks empty submission, server returns `empty_prompt`, typed draft stays intact, attempts do not decrement | Automated | `tests/unit/app/active-level-screen.test.tsx`, `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-http-analytics.test.ts` | Re-check the same behavior after Phase 2 replaces the mocked `/play` flow |
| Prompt exceeds 120-character limit | Agent 2, Agent 3 | Client and server block over-limit prompts, Unicode counting is consistent, attempts do not decrement | Partial | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-session-persistence.test.ts`, `tests/unit/app/active-level-screen.test.tsx` | Add a live browser check that the real form prevents over-limit submission without dropping the draft |
| Provider content-policy rejection | Agent 3, Agent 4 | Rejection is structured, recoverable, visible to the player, and does not consume an attempt | Automated | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-session-state.test.ts`, `tests/unit/server/game-http-analytics.test.ts` | Validate final user-facing copy once live UI wiring lands |
| Player refreshes during generation | Agent 3, Agent 4 | Progress is not corrupted; the attempt resolves to a recovered pending state or a refunded attempt | Automated | Interrupted request refunds are covered in `tests/unit/server/game-http.test.ts` and `tests/unit/server/game-session-state.test.ts`, including an in-flight request abort regression | Run a real browser refresh during an in-flight request once the live submission path exists |
| Generation succeeds but scoring fails | Agent 3, Agent 4 | Failure is visible and recoverable, and the submission does not consume a scored attempt | Partial | Analytics and provider-path coverage exist in `tests/unit/server/game-analytics.test.ts` and `tests/unit/server/game-http-analytics.test.ts` | Add an HTTP or browser test for the exact UI recovery path after a scoring-only failure |
| Scoring succeeds but generated asset cannot be displayed | Agent 2, Agent 3 | Player sees a recoverable error state rather than a broken result screen, and progress remains intact | Manual | Provider-side `asset_unavailable` telemetry exists, but there is no direct display-failure UI test yet | Add a browser test that simulates a broken generated image response and validates recovery copy |
| Network interruption during submission | Agent 2, Agent 3 | Draft and progress survive the interruption, and duplicate retries do not double-consume attempts | Automated | Idempotency and refunded interrupted attempts are covered in `tests/unit/server/game-http.test.ts`; client-side recovery and draft preservation are covered in `tests/unit/app/active-level-screen.test.tsx` | Re-run the same flow against live providers during launch rehearsal |
| Player exits mid-level and later resumes | Agent 3 | Resume returns the saved run, active level, attempts remaining, and strongest progress without resetting the run | Automated | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-session-state.test.ts`, `tests/unit/server/game-http-analytics.test.ts` | Confirm landing and `/play` stay visually aligned after Phase 2 integration |
| Stored progress references a removed or unavailable level | Agent 3, Agent 5 | Resume falls back to the nearest valid current level and does not crash the run | Automated | `tests/unit/server/game-session-state.test.ts`, `tests/unit/server/live-state.test.ts`, `tests/unit/server/game-http.test.ts` | Re-run against database-backed sessions during final launch rehearsal |
| Target image is too difficult for its threshold | Agent 5, Agent 4 | QA flags the level for retuning or replacement when pass rates and qualitative reviews show unfair difficulty | Manual | Seeded thresholds and scoring evaluation notes exist in `src/content/levels/index.ts` and `docs/foundation/scoring-consistency-evaluation.md` | Review real playtest pass rates and strongest-attempt distributions per level |
| Similarity scoring is inconsistent on acceptable matches | Agent 4, Agent 5 | Fixture review and tuning notes identify mismatches that should be handled by scorer changes or threshold changes | Partial | `docs/foundation/scoring-consistency-evaluation.md`, `tests/unit/server/mock-attempt-evaluator.test.ts` | Repeat the review with real target assets and production scorer outputs |
| Prompt is valid but intentionally nonsensical | Agent 4, Agent 5 | The prompt is still scored, attempts are consumed only for technically successful submissions, and tips remain reasonable | Automated | Seeded nonsensical-but-valid prompts now run across all three levels in `tests/unit/server/game-http.test.ts`; low-quality scoring rules remain documented in `docs/foundation/scoring-consistency-evaluation.md` | Recheck against the live scorer once real target/generated assets exist |
| Rapid retry or double-submit | Agent 3 | Duplicate in-flight submissions return the same result, consume only one attempt, and do not duplicate analytics | Automated | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-http-analytics.test.ts` | Reconfirm in the browser with double-click and repeated keyboard submission once wired live |
| Service rate limits or provider timeouts | Agent 3, Agent 4 | Structured recoverable failure is shown, attempt is preserved, and failure analytics capture the provider category | Automated | `tests/unit/server/game-http.test.ts`, `tests/unit/server/game-http-analytics.test.ts`, `tests/unit/providers/image-generation.test.ts`, `tests/unit/providers/image-scoring.test.ts` | Re-check the same copy paths during final browser QA once the live providers are enabled |

## Launch-Blocking Gaps Still Open

- Generated-image display failure still needs a dedicated UI recovery path test.

## Suggested Phase 2 Verification Order

1. Re-run the automated server and app suites after the real `/play` submission wiring lands.
2. Execute manual browser QA for refresh-during-generation and broken generated-image display against live providers.
3. Validate analytics integrity in PostHog for one happy path, one failed retry path, and one provider-failure path.
4. Review seeded level fairness with real scorer outputs before broadening the content pack.
