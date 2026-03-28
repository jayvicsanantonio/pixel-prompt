# Execution Plan

## Purpose

This document breaks the product into implementation-ready phases for a web-first MVP, while leaving room for structured post-MVP expansion.

Legend:

- `[MVP]` required for first playable release
- `[Post-MVP]` intentionally deferred until after the core loop is proven
- `Dependency:` key prerequisite for the task or phase

## Phase 0: Discovery and Product Framing

Goal:

- lock the MVP scope, gameplay rules, and content model before coding spreads across too many assumptions

Tasks:

- [MVP] Review and approve `PRD.md`, `README.md`, and this task plan.
- [MVP] Confirm first-release product constraints:
  - anonymous or authenticated users
  - number of launch levels
  - exact prompt character limit
  - exact scoring threshold format
- [MVP] Define the first level progression set and threshold curve.
- [MVP] Decide the first scoring strategy and fallback behavior on scoring failure.
- [MVP] Decide whether retry tips are heuristic, model-assisted, or hybrid in MVP.
- [MVP] Write success criteria for the first playable build.
- [Post-MVP] Define content expansion strategy for level packs and challenge modes.

Exit criteria:

- MVP boundaries are explicit.
- Open questions blocking implementation are reduced to a small set.

## Phase 1: UX and Game Flow Design

Goal:

- translate product states into a clean, testable web app flow

Dependency:

- Phase 0 decisions on MVP states and rules

Tasks:

- [MVP] Create screen list for all primary states:
  - landing / intro
  - start game
  - active level
  - generating
  - result / scoring
  - retry
  - level complete
  - failure after all attempts
  - resume progress
  - final completion / summary
- [MVP] Define navigation rules between states.
- [MVP] Draft wireframes for the gameplay screen with emphasis on:
  - target image prominence
  - short prompt input
  - attempts remaining
  - score feedback
  - retry guidance
- [MVP] Define tone and copy principles for instructions, errors, success, and failure states.
- [MVP] Specify loading-state behavior for generation and scoring latency.
- [MVP] Specify empty, error, and timeout states.
- [MVP] Define responsive behavior for desktop and mobile layouts.
- [Post-MVP] Explore richer result visualizations and score breakdown UI.

Exit criteria:

- Every major product state has a designed UI path.
- The gameplay screen can be implemented without unresolved interaction gaps.

## Phase 2: App Setup and Engineering Foundation

Goal:

- establish the application scaffold, tooling, and baseline quality controls

Dependency:

- Phase 1 screen and flow direction

Tasks:

- [MVP] Choose framework and scaffold the web app.
- [MVP] Configure TypeScript, linting, formatting, and environment handling.
- [MVP] Set up a baseline folder structure for:
  - routes or pages
  - components
  - domain logic
  - server APIs
  - content or level definitions
  - analytics
  - tests
- [MVP] Define design tokens for spacing, type scale, colors, and motion.
- [MVP] Add a basic shell layout and shared UI primitives.
- [MVP] Configure error boundaries and request error handling patterns.
- [MVP] Add placeholder environment variables for generation and scoring providers.
- [MVP] Add basic CI checks for linting and tests.
- [Post-MVP] Add preview deployment automation and stricter release gating.

Exit criteria:

- The app runs locally.
- The team has a clean structure for building the gameplay loop without early refactors.

## Phase 3: Game Domain and Level Content Model

Goal:

- define the data structures that drive gameplay, progression, and future content expansion

Dependency:

- Phase 0 decisions on level count and progression rules

Tasks:

- [MVP] Define types or schemas for:
  - level
  - target image
  - score threshold
  - attempt
  - level result
  - session progress
- [MVP] Create a data-driven level definition format.
- [MVP] Seed the first set of curated levels.
- [MVP] Add validation for malformed level data.
- [MVP] Define level ordering and unlock rules.
- [MVP] Define prompt validation rules and character counting behavior.
- [MVP] Create fixture data for local development and tests.
- [Post-MVP] Add support for themes, packs, and alternate difficulty tracks.

Exit criteria:

- Levels are defined outside UI code.
- A developer can add a new level without touching core gameplay logic.

## Phase 4: Core Gameplay Shell

Goal:

- implement the main user-facing loop without yet depending on production model integrations

Dependency:

- Phases 1 through 3

Tasks:

- [MVP] Build landing page and start-game entry point.
- [MVP] Build resume-progress entry point with placeholder persisted state.
- [MVP] Build active level screen.
- [MVP] Implement prompt input with:
  - character counter
  - submission validation
  - disabled states
- [MVP] Show attempts remaining and required threshold on the level screen.
- [MVP] Implement generating state UI.
- [MVP] Implement result screen structure with slots for:
  - target image
  - generated image
  - score
  - pass/fail outcome
  - tips
- [MVP] Implement retry and next-level transitions.
- [MVP] Implement failure-after-all-attempts screen.
- [MVP] Implement final completion summary shell.
- [MVP] Build the flow first against mock generation and mock scoring responses.

Exit criteria:

- The app has a complete playable loop using mock services.

## Phase 5: Image Generation Integration

Goal:

- connect prompt submission to a real image-generation provider through a stable server-side interface

Dependency:

- Phase 4 mock gameplay loop complete

Tasks:

- [MVP] Define a provider-agnostic generation service interface.
- [MVP] Implement the first generation provider adapter.
- [MVP] Add server-side request validation and error handling.
- [MVP] Persist generation request metadata needed for debugging and analytics.
- [MVP] Store or reference generated outputs in a consistent format.
- [MVP] Handle generation failures without consuming an attempt unless the product chooses otherwise.
- [MVP] Add timeout and retry policies for provider calls.
- [MVP] Replace mock generation in the gameplay loop with the real integration behind a feature flag.
- [Post-MVP] Add support for multiple providers or fallback routing.

Exit criteria:

- A real prompt can generate a playable result in the app.

## Phase 6: Similarity Scoring Integration

Goal:

- turn generated output into a fair, normalized score that drives progression

Dependency:

- Phase 5 real generation integration

Tasks:

- [MVP] Define a scoring service interface separate from generation logic.
- [MVP] Implement the first scoring adapter or scoring method.
- [MVP] Normalize provider output into a consistent player-facing score.
- [MVP] Implement pass/fail logic using per-level thresholds.
- [MVP] Persist raw scoring payloads needed for later tuning.
- [MVP] Add fallback behavior when scoring fails:
  - non-destructive error state
  - ability to retry safely
- [MVP] Calibrate initial thresholds using seeded level content and internal playtesting.
- [Post-MVP] Add richer scoring breakdowns by visual dimension.

Exit criteria:

- The real gameplay loop can score attempts and determine progression reliably.

## Phase 7: Retry Tips and Coaching Layer

Goal:

- provide useful improvement guidance instead of generic pass/fail messaging

Dependency:

- Phase 6 scoring behavior available

Tasks:

- [MVP] Define initial tip categories:
  - medium
  - subject
  - context
  - style
  - materials
  - textures
  - shapes
  - composition
  - time period or artistic era when relevant
- [MVP] Design a tip output format that is concise and actionable.
- [MVP] Implement first-pass tip generation logic using heuristics or structured rules.
- [MVP] Ensure failed attempts return at least one actionable suggestion.
- [MVP] Avoid generic advice that does not tell the player what to add or clarify.
- [MVP] Add internal examples for tip QA.
- [Post-MVP] Experiment with model-assisted coaching or comparative prompt feedback.

Exit criteria:

- Failed attempts produce useful retry guidance that a beginner can act on immediately.

## Phase 8: State Management and Persistence

Goal:

- preserve progress, restore sessions cleanly, and avoid state loss across visits

Dependency:

- Phase 4 gameplay shell, plus phase-specific data contracts from phases 5 through 7

Tasks:

- [MVP] Define client and server state boundaries.
- [MVP] Implement gameplay session state for:
  - current level
  - current attempt count
  - latest result
  - unlocked progress
- [MVP] Decide and implement MVP persistence approach:
  - browser-local only
  - account-backed
  - hybrid
- [MVP] Persist best score, completion status, and unlocked levels.
- [MVP] Implement resume behavior from landing page.
- [MVP] Handle refresh during non-terminal states safely.
- [MVP] Add migration strategy for level content changes where practical.
- [Post-MVP] Add cross-device synced progress if not included in MVP.

Exit criteria:

- A player can leave and return without losing meaningful progress.

## Phase 9: Analytics and Product Instrumentation

Goal:

- capture enough event data to evaluate onboarding, gameplay quality, and learning outcomes

Dependency:

- core loop and persistence mostly stable

Tasks:

- [MVP] Define analytics event taxonomy for:
  - landing viewed
  - start clicked
  - resume clicked
  - level started
  - prompt submitted
  - generation failed
  - scoring failed
  - score received
  - level passed
  - level failed
  - retry started
  - session completed
- [MVP] Define key event properties:
  - level id
  - attempt number
  - prompt length
  - score
  - threshold
  - pass/fail result
  - latency markers
- [MVP] Instrument the frontend and backend consistently.
- [MVP] Validate event firing in local and test environments.
- [MVP] Create a basic metric dashboard spec for launch review.
- [Post-MVP] Add deeper learning outcome reporting and cohort analysis.

Exit criteria:

- The team can measure funnel performance and basic learning signals from real usage.

## Phase 10: Testing and Quality Assurance

Goal:

- make the gameplay loop reliable enough to ship and tune confidently

Dependency:

- phases 4 through 9 at functional completeness

Tasks:

- [MVP] Add unit tests for prompt validation, threshold evaluation, and progression logic.
- [MVP] Add integration tests for generation and scoring service boundaries.
- [MVP] Add end-to-end tests for:
  - new player start flow
  - fail then retry flow
  - pass level flow
  - failure after all attempts
  - resume progress flow
- [MVP] Add mocks or fixtures to keep test runs deterministic.
- [MVP] Test error paths:
  - provider timeout
  - invalid response
  - scoring failure
  - stale persistence state
- [MVP] Run responsive and accessibility checks on major gameplay screens.
- [Post-MVP] Add load testing for provider-backed attempt volume.

Exit criteria:

- Core flows and critical failure paths are covered by automated tests.

## Phase 11: Polish, Performance, and Accessibility

Goal:

- make the app feel sharp, readable, and trustworthy enough for first release

Dependency:

- MVP feature completeness

Tasks:

- [MVP] Refine visual hierarchy for target image, prompt input, and score display.
- [MVP] Improve loading, transition, and motion behavior without slowing the experience.
- [MVP] Tune copy for clarity, brevity, and consistency.
- [MVP] Optimize image loading and rendering performance.
- [MVP] Improve keyboard and focus behavior across all states.
- [MVP] Check contrast, state visibility, and readable text sizing.
- [MVP] Review empty, error, retry, and completion microcopy.
- [Post-MVP] Add richer animations, unlock flourishes, and more expressive comparison tools.

Exit criteria:

- The app feels intentional and easy to understand on first use.

## Phase 12: Launch Preparation

Goal:

- prepare the MVP for a controlled public release or private playtest

Dependency:

- MVP complete and tested

Tasks:

- [MVP] Finalize launch level set and threshold tuning.
- [MVP] Review analytics coverage against launch questions.
- [MVP] Set up environment configuration for staging and production.
- [MVP] Validate provider quotas, failure handling, and abuse controls.
- [MVP] Prepare a short internal test script for launch verification.
- [MVP] Confirm fallback messaging for degraded provider behavior.
- [MVP] Create a launch checklist covering:
  - configuration
  - monitoring
  - analytics
  - critical flow QA
- [Post-MVP] Prepare roadmap update based on first cohort learnings.

Exit criteria:

- The team can deploy and observe the MVP with confidence.

## Recommended First Vertical Slice

If implementation starts immediately, build in this order:

1. Landing page plus start flow
2. One playable level using mocked generation and mocked scoring
3. Result screen with pass/fail logic and retries
4. Persistence of one user's level progress
5. Real generation integration
6. Real scoring integration
7. Tip refinement and analytics

This sequence keeps complexity contained while validating the product's central learning loop early.

## Immediate Next Tasks

- [MVP] Approve or revise the product rules in `PRD.md`.
- [MVP] Choose the app framework and initial stack.
- [MVP] Create the project scaffold.
- [MVP] Implement the first playable mocked level flow.
- [MVP] Start level data modeling and seed the first content set.
