# Pixel Prompt Execution Plan

## Purpose

This document turns `PRD.md` into an implementation plan for a focused `5 sub-agent` build. The repository is still pre-scaffold, so the first requirement is to create clear ownership boundaries and handoff contracts before parallel implementation starts.

Practical rule:

- keep `PRD.md` as the source of product truth
- keep this document as the source of execution order, ownership, and delivery status
- update both when behavior or scope changes

## Recommended 5-Agent Split

### Agent 1: Product and Architecture Lead

Mission:

- turn the PRD into a concrete product and technical blueprint
- establish repo structure, shared contracts, and integration rules
- keep the other agents unblocked

Primary skills:

- senior full-stack architecture
- product decomposition and acceptance-criteria design
- Next.js and TypeScript project setup
- schema and API contract design
- testing strategy
- CI and developer workflow design

Owns:

- app scaffold and baseline tooling
- shared types and domain model
- provider interfaces for generation and scoring
- content and analytics contract definitions
- asset storage strategy for target and generated images
- generated-image retention policy
- MVP persistence and identity strategy
- deployment and staging strategy
- analytics provider and SDK setup
- environment variable contract
- error model and loading-state conventions
- local development workflow
- initial test harness and CI baseline

Must deliver:

- initial app scaffold
- folder structure for app, server, content, and tests
- typed contract for levels, attempts, scores, and progress
- API boundaries for submit-attempt, resume-progress, and analytics ingestion
- baseline AI provider and model selection for generation and scoring
- asset storage decision for durable target and generated image references
- generated image retention policy for resume, replay, and history
- MVP persistence model decision: anonymous server-persisted progress keyed by a lightweight session identifier, with no account system in MVP
- deployment and staging plan for preview and production environments
- analytics provider configuration plan
- MVP slice plan
- dependency map and integration sequence

### Agent 2: Frontend Gameplay and UX Engineer

Mission:

- build the player-facing experience from landing screen through final summary
- make the gameplay loop fast, readable, and accessible

Primary skills:

- React and Next.js UI engineering
- async state and error-state design
- accessibility and keyboard UX
- visual systems and interaction design
- frontend testing

Owns:

- landing and intro flow
- start and resume entry points
- active level screen
- prompt input and character counter
- generating, result, retry, success, failure, and final summary states
- responsive behavior and keyboard-first flow

Must deliver:

- complete client UI for the MVP loop
- reusable gameplay components
- UX copy slots that can consume content and tip rules
- frontend validation states
- loading, error, and empty-state handling
- active level UI that keeps the target image visible during prompt writing and shows level number, attempts remaining, and required score threshold
- active level UI that avoids clutter which distracts from image observation
- result UI that presents the target image and generated image side by side or in an equally clear comparison layout
- mobile-friendly target image inspection, such as tap-to-expand or an equivalent zoomed study view
- player-facing score display as a percentage
- final summary that shows levels completed, total attempts used, best scores, and improvement trend
- replay entry points for completed levels
- failure state that can surface strongest attempt score and concise advice
- failure state that offers a restart-level action for failed levels
- final summary that encourages replay or future content return
- preservation of typed prompt on validation errors

### Agent 3: Backend and Game Systems Engineer

Mission:

- implement the durable game rules and persistence layer
- make attempts, progression, resume, and analytics reliable

Primary skills:

- backend API design
- database schema design
- transactional game-state logic
- analytics instrumentation
- reliability and abuse prevention
- automated testing for business rules

Owns:

- database schema and migrations
- session and progress persistence
- generated asset reference persistence
- attempt lifecycle rules
- threshold pass/fail logic
- retry and progression rules
- failed-level restart logic
- tip-selection orchestration
- replay-safe progression invariants
- analytics event emission
- rate limiting and server-side validation

Must deliver:

- persistent level progress and attempt history
- attempt schema that stores prompt text, generated image reference, and generation metadata such as provider, model version, and seed when available
- best-score retention per level for UX and analytics
- raw and normalized score storage for future threshold tuning
- server APIs or actions for gameplay state transitions
- restart-level flow that resets a failed level's attempts without deleting prior attempt history or analytics
- runtime tip-selection engine that consumes attempt context, score signals, and Agent 5 tip rules
- normalized event schema for product metrics
- safe failure and retry behavior for technical errors
- attempt-consumption rules that do not decrement on invalid submissions or technical failures
- replay support that never reduces unlocked progression
- tests for progression, attempt consumption, and resume logic

### Agent 4: AI and Scoring Systems Engineer

Mission:

- make the core gameplay loop technically credible by owning model integration and scoring behavior

Primary skills:

- model API integration
- similarity and evaluation system design
- score normalization and calibration
- offline evaluation harness design
- prompt and vision workflow tuning

Owns:

- image generation adapter
- similarity scoring adapter
- score normalization strategy
- scoring breakdown fields and provider failure taxonomy
- deterministic fixtures and offline evaluation support
- latency and cost guardrails for provider usage

Must deliver:

- one working generation provider integration
- one working scoring strategy with normalized 0-100 outputs
- scoring payloads that the backend and UX can consume safely
- evaluation notes for score behavior and failure modes
- guidance for handling interrupted generation requests and provider timeouts
- evaluation notes for inconsistent but visually acceptable matches
- documented behavior for technically successful but low-quality or off-topic provider outputs on otherwise reasonable prompts
- structured handling for provider content-policy rejections so they surface cleanly and do not consume attempts

### Agent 5: Content, QA, and Telemetry Operator

Mission:

- make the learning loop fair, understandable, and measurable by owning level content, tip quality, QA, and analytics validation

Primary skills:

- level and curriculum design
- prompt pedagogy and feedback writing
- product analytics and event taxonomy design
- manual QA and edge-case testing
- difficulty tuning and playtest analysis

Owns:

- structured level content and seed data
- threshold tuning and difficulty progression
- retry tip heuristics and copy constraints
- analytics event dictionary and success-metric mapping
- QA matrix for gameplay states, edge cases, and fairness reviews
- playtest notes and launch-readiness validation

Must deliver:

- initial curated level set with Level 1 at 50, Level 2 at 60, and Level 3 at 70
- content schema population including category, difficulty, and theme metadata
- rule-based retry tips for missing visual specificity across medium, subject, context, style, materials, textures, shapes, composition, and time period or artistic era
- analytics event definitions explicitly mapped to PRD funnel, learning, and operational metrics
- QA coverage plan for gameplay, replay, resume, and failure states
- evaluation notes for threshold fairness and content difficulty
- draft UX copy for landing, input, generating, result, success, failure, replay, and summary states
- failure-state and summary copy that is encouraging, non-punitive, and invites replay or future return

## Ownership Boundaries

To prevent overlap:

- Agent 1 defines contracts, but does not own final feature implementation once a surface is assigned.
- Agent 2 owns all player-facing screens and component behavior.
- Agent 3 owns durable state transitions and persistence.
- Agent 4 owns provider-facing logic, scoring logic, and evaluation signals.
- Agent 5 owns level content, gameplay tuning, analytics definitions, and QA validation.

Shared rules:

- UI does not embed hard-coded game rules.
- backend does not hard-code level content in route handlers.
- provider-specific logic stays behind adapter interfaces.
- analytics names and payloads are defined once and reused everywhere.
- content, thresholds, and tip rules live in structured data rather than feature code.
- provider credentials remain server-only and are never exposed to the client.
- generated assets required for resume or history must have durable references.

## MVP Fixed Defaults

Unless explicitly changed later, the MVP uses these fixed values and behaviors:

- prompt character limit: 120 characters
- maximum scored attempts per level: 3
- seeded thresholds: Level 1 = 50, Level 2 = 60, Level 3 = 70
- target image stays visible throughout prompt writing
- target images are static per level in MVP
- player-facing scores are displayed as percentages
- players see only the aggregate percentage score in MVP; internal score breakdowns and reasoning fields are not player-facing
- MVP uses binary pass/fail at the level threshold; medal tiers are deferred
- progress persistence is anonymous and server-persisted via a lightweight session identifier; account support is out of scope for MVP
- generated attempt images use durable storage rather than ephemeral provider URLs, with retention policy documented in Phase 0
- technically successful but low-quality or off-topic provider outputs are still scored in MVP; provider retries and manual overrides are deferred

## Cross-Cutting Acceptance Criteria

These requirements apply across all phases and should be treated as non-negotiable acceptance checks:

### Gameplay Fairness

- invalid submissions do not consume attempts
- provider content-policy rejections do not consume attempts
- technical failures, provider timeouts, and scoring failures do not consume attempts
- interrupted generation requests resolve to a recovered pending state or a refunded attempt
- failed levels can be restarted with a fresh attempt cycle while preserving prior attempt history and analytics
- replaying completed levels never reduces unlocked progression
- best score per level is retained for UX and analytics

### Prompt and Interaction UX

- empty prompts and over-limit prompts are blocked in both client and server validation
- typed prompt text is preserved when validation fails
- keyboard-first submission and retry flow exists for the core gameplay loop
- the landing experience communicates the premise on first visit without a tutorial wall or multi-step modal sequence
- level number and required threshold are visible during active play
- the target image remains visible throughout prompt writing in MVP
- the active level screen avoids clutter that distracts from studying the target image
- smaller mobile viewports provide a way to inspect the target image at a larger size
- result states use a clear comparison layout between target and generated images
- player-facing scores are shown as percentages
- failure states show the strongest attempt score and concise advice
- failure-state copy is encouraging and non-punitive
- final summary shows levels completed, total attempts used, best scores, and improvement trend
- final summary encourages replay or future content return

### Content and Tip Quality

- level schema supports category, difficulty, theme, and future pack/group metadata
- retry tips cover medium, subject, context, style, materials, textures, shapes, composition, and time period or artistic era
- UI copy remains short, concrete, and understandable to beginners

### Reliability and Resume

- refresh during generation does not corrupt progress
- stored progress that references removed or unavailable levels recovers to the nearest valid state
- generation success plus scoring failure, asset display failure, and network interruption all fail visibly and recover cleanly

### Analytics and Operational Observability

- analytics events explicitly support the PRD metrics for funnel conversion, abandonment, retries, score improvement, prompt length, generation/scoring success, attempt latency, and technical failure rate
- event integrity is verified in both happy-path and failure-path flows

### Security and Accessibility

- provider credentials remain server-side only
- color contrast and non-color state signaling are validated before launch
- important UI states are accessible through keyboard navigation and understandable screen messaging

## Explicit PRD Edge Case Checklist

These cases must be represented in the QA matrix, assigned during implementation, and covered before launch:

- empty prompt submission: Agent 2 for client validation, Agent 3 for server validation
- prompt exceeds character limit: Agent 2 for client validation, Agent 3 for server validation
- provider content-policy rejection: Agent 4 returns structured rejection details, Agent 3 preserves attempts and surfaces recoverable error state
- player refreshes during generation: Agent 3 and Agent 4 define recovery or refund behavior
- generation succeeds but scoring fails: Agent 3 and Agent 4 handle retry-safe recovery
- scoring succeeds but generated asset cannot be displayed: Agent 2 and Agent 3 surface recoverable UI state
- network interruption during submission: Agent 2 and Agent 3 preserve user state and avoid corrupt progress
- player exits mid-level and later resumes: Agent 3 owns durable restore behavior
- stored progress references a removed or unavailable level: Agent 3 recovers to nearest valid state, Agent 5 verifies content migration expectations
- target image proves too difficult for its threshold: Agent 5 owns tuning, Agent 4 supports score-signal review
- similarity scoring is inconsistent for visually acceptable matches: Agent 4 owns evaluation, Agent 5 owns tuning response
- prompt is valid but intentionally nonsensical: Agent 4 and Agent 5 verify scoring and tip behavior remain reasonable
- rapid retry or double-submit: Agent 3 owns idempotency and duplicate-submit protection
- service rate limits or provider timeouts occur: Agent 3 and Agent 4 own graceful degradation and retry-safe behavior

## Analytics Coverage Requirements

The analytics event dictionary must support the PRD metrics at minimum:

- Core product metrics: landing-to-start conversion, level start rate, prompt submission rate, attempt completion rate, pass rate by level, retry rate by level, abandonment rate, resume rate, and full-run completion rate
- Learning and quality metrics: average attempts to pass, median best score by level, score improvement from first attempt to best attempt, percentage of players who improve after tips, and prompt length distribution
- Operational metrics: generation success rate, scoring success rate, end-to-end attempt latency, and technical failure rate per attempt
- Early success review: event outputs must support evaluation of whether users start quickly, complete at least one attempt, retry after failure, and improve on later attempts

## Phase Plan

### Phase 0: Foundation and Contracts

Primary owner:

- Agent 1

Support:

- Agent 3 reviews persistence model
- Agent 4 reviews provider interfaces and score payloads
- Agent 5 reviews content schema and analytics taxonomy

Tasks:

1. [x] choose the framework, package manager, database, analytics provider, and testing stack (`Next.js App Router`, `pnpm`, `PostgreSQL + Drizzle`, `PostHog`, `Vitest + React Testing Library + Playwright`)
2. [x] choose baseline AI providers and models for generation and scoring (`OpenAI`, `gpt-image-1.5` for generation, `gpt-5.4 mini` for scoring)
3. [x] choose the asset storage strategy for target images and generated outputs (`Amazon S3`, separate target-asset and generated-output buckets)
4. [x] document the generated-image retention policy and storage lifecycle (90-day generated-image retention; target assets retained until replaced)
5. [x] document the MVP persistence model and anonymous identity/session strategy (PostgreSQL source of truth; anonymous `pp_session` cookie with rolling 90-day expiry)
6. [x] scaffold the app and repository structure (Next.js app shell, test configs, server/content/test folders, reproducible `pnpm` lockfile)
7. [x] define shared TypeScript types for level, attempt, score, result, progress, and shared MVP constants such as prompt limit 120 and max attempts 3
8. [x] define content file format for levels, tip rules, and metadata fields such as category, difficulty, theme, and future pack/group identifiers
9. [x] encode the seeded level thresholds for the first 3 levels as 50, 60, and 70
10. [x] define provider interfaces for generation and scoring
11. [x] define MVP score transparency rules so only the aggregate percentage is player-facing
12. [x] define event schema for analytics and map it to the PRD metrics
13. [x] configure analytics SDK and infrastructure boundaries
14. [x] define deployment, staging, and preview environment assumptions
15. [x] write local setup instructions into `README.md`

Exit criteria:

- repo boots locally
- shared contracts compile
- all agents can build against the same interfaces
- provider, storage, and analytics decisions are documented
- MVP constants and persistence defaults are documented in one place

### Phase 1: Parallel MVP Slice Development

Primary owners:

- Agent 2 on UI
- Agent 3 on game-state backend
- Agent 4 on provider integrations and scoring
- Agent 5 on content, QA, and telemetry

Tasks for Agent 2:

- [x] build landing page and start/resume states
- [x] build active level screen and prompt input with visible level number, required threshold, remaining attempts, and target image
- [x] preserve typed prompt on validation errors and support keyboard-first input flow in the core loop
- [x] build generating state with submitted-prompt echo and waiting copy
- [x] build result state with target/generated comparison and player-facing percentage display
- [x] build retry and success continuation states
- [x] build failure state with strongest-attempt context and restart-level CTA
- [x] build replay entry states and final summary
- [x] define score presentation as a player-facing percentage display
- [x] implement a clear comparison layout for target and generated images in result states
- [x] add mobile target-image expansion or equivalent detailed inspection affordance
- [x] ensure failure UI can surface strongest attempt score and concise advice
- [x] implement restart-level CTA and flow from the failure state
- [x] implement responsive behavior for mobile, tablet, and desktop breakpoints
- [x] wire the UI to mocked server contracts first
- [x] add frontend tests for validation, retry, replay, and failure-state behavior

Tasks for Agent 3:

- implement persistence schema, including prompt text, generated image references, generation metadata, raw and normalized score storage, best score retention, and replay-safe progression fields
- implement session, attempt, progression, replay, and failed-level restart logic
- implement submit-attempt and resume-progress endpoints
- implement durable generated-asset reference persistence if resume/history requires it
- enforce attempt fairness so invalid submissions and technical failures do not decrement attempts
- implement tip-selection orchestration using Agent 4 score signals and Agent 5 tip rules
- implement double-submit protection and request idempotency
- implement analytics emission points
- add business-rule tests for attempt consumption, replay, and resume behavior

Tasks for Agent 4:

- integrate one generation path
- integrate one scoring path
- define normalized score outputs and reasoning fields
- define provider failure behavior, timeout behavior, and interrupted-request signals
- define content-policy rejection behavior and structured rejection payloads
- create deterministic fixtures for scoring and integration tests
- evaluate scoring consistency on visually acceptable matches
- document expected scoring behavior for low-quality or off-topic provider outputs that are technically successful

Tasks for Agent 5:

- create initial levels and threshold values with category, difficulty, and theme metadata
- define first-pass retry tip heuristics across all PRD visual-detail categories
- define analytics event dictionary mapped to the PRD metrics and acceptance checks
- author QA matrix that enumerates all PRD edge cases and assigns ownership
- define copy guidelines for short, concrete, beginner-friendly UX text
- draft UX copy for all MVP states and CTA labels
- draft non-punitive failure copy and replay-or-return encouragement for the final summary

Exit criteria:

- each workstream runs independently against shared contracts
- mocked end-to-end loop exists in frontend
- backend rules pass tests
- provider layer produces stable payloads
- content pack, telemetry schema, and QA matrix exist
- acceptance criteria for prompt validation, attempts, replay, and failure handling are testable

### Phase 2: First End-to-End Playable Loop

Primary owners:

- Agent 2, Agent 3, Agent 4, Agent 5

Coordination owner:

- Agent 1

Tasks:

- connect frontend submission flow to real backend endpoint
- connect backend attempt processing to generation and scoring adapters
- display real score, pass/fail state, retry tips, and strongest-attempt context on failure
- connect restart-level UI and backend flow so failed levels can be retried immediately
- wire the runtime tip-selection engine to score breakdowns, attempt history, and Agent 5 tip rules
- decrement attempts only after valid scored submissions
- persist best score, attempt history, and unlocked level progression
- recover safely from refresh or disconnect during generation
- verify gameplay events and QA the happy-path plus core failure-path loop

Exit criteria:

- a player can start Level 1, submit a prompt, receive a score, retry, pass or fail, and resume later
- the happy path and core failure path are both validated
- invalid submissions and technical failures do not reduce attempts

### Phase 3: Full MVP Completion

Primary owners:

- Agent 2 on summary and polish
- Agent 3 on resume and server reliability
- Agent 4 on scoring calibration and provider resilience
- Agent 5 on content expansion, threshold tuning, and analytics validation

Tasks:

- implement final completion summary with levels completed, attempts used, best scores, and improvement trend
- implement multi-level progression with unlocks and replay of completed levels
- ensure failed levels offer a restart path without soft-locking progression
- surface replay entry points without regressing unlocked progression
- validate resume behavior across refresh, return sessions, and orphaned progress that references removed levels
- ensure analytics cover the full gameplay funnel and the PRD-defined success metrics
- tune thresholds and tip rules across the initial curated level set
- add failure handling for generation, scoring, asset-display, network, and provider rate-limit issues
- run structured QA across the full level set, including nonsensical-but-valid prompts and scoring inconsistency reviews

Exit criteria:

- the MVP level set is playable from start to finish
- progression and resume behavior are stable
- analytics and edge-case handling are in place
- content difficulty and score fairness have been reviewed
- replay works without reducing unlocked progression

### Phase 4: Hardening and Launch Readiness

Primary owners:

- Agent 3, Agent 4, and Agent 5

Support:

- Agent 2 for UX polish
- Agent 1 for release checklist and technical debt triage

Tasks:

- add abuse controls and rate limiting
- verify accessibility, keyboard navigation across all interactive screens, color contrast, and non-color state signaling
- run copy audit for short, concrete, beginner-friendly language
- improve loading and failure states
- verify responsive behavior across mobile, tablet, and desktop breakpoints
- add deterministic test fixtures for gameplay logic
- validate end-to-end attempt latency and perceived responsiveness during model requests
- verify progress-corruption protection across refresh and network interruption
- review score fairness on hard levels
- verify event integrity against product metrics
- verify provider credentials and secrets remain server-only
- configure staging and production deployment paths, environment variables, and preview workflow
- clean up developer docs and deployment assumptions

Exit criteria:

- MVP is stable enough for limited user testing
- technical and scoring failures are observable and recoverable
- analytics and QA signals are strong enough to guide iteration

## Handoff Contracts

### Agent 1 -> Agent 2

- route structure
- shared types for all UI states
- shared MVP constants for prompt limit, attempt count, and score presentation
- mocked API response shapes
- design tokens or styling conventions

### Agent 1 -> Agent 3

- persistence model assumptions
- error contract
- analytics payload schema
- asset storage strategy and replay invariants
- session and identity assumptions for anonymous server-persisted progress

### Agent 1 -> Agent 4

- provider interface contract
- result payload shape expected by the backend and UI
- chosen baseline providers and model assumptions

### Agent 1 -> Agent 5

- content schema
- analytics payload schema
- MVP acceptance criteria
- metadata requirements for category, difficulty, theme, and future pack/group support

### Agent 4 -> Agent 3

- generation request and result format
- raw score payload, normalization fields, and storage requirements
- generation metadata fields and content-policy rejection signals
- provider failure signals and retry-safe behavior
- timeout and interrupted-request recovery signals
- score breakdown signals required for tip selection

### Agent 3 -> Agent 2

- stable gameplay endpoints
- response shapes for result, retry, restart, resume, replay, and summary states
- historical attempt context needed to surface strongest attempt score on failure
- error and validation response shapes

### Agent 4 -> Agent 5

- score breakdown signals
- provider caveats that affect threshold tuning
- failure taxonomy for QA coverage

### Agent 5 -> Agent 2

- content metadata for levels
- tip categories and copy constraints
- summary metrics and coaching copy constraints
- UX copy review guidance for beginner-friendly messaging
- drafted UX copy for MVP states
- non-punitive failure copy and replay-or-return encouragement

### Agent 5 -> Agent 3

- analytics event dictionary
- QA assertions for progression and resume behavior
- content IDs, thresholds, and tip rule references
- explicit edge-case checklist for backend recovery behavior
- tip rule definitions consumed by the runtime tip-selection engine

## Parallel Work Rules

- Agent 2 should start against mocks immediately after Phase 0.
- Agent 3 should own business rules in tests before wiring live providers.
- Agent 4 should create deterministic fixtures early so the rest of the system is testable without full live-model dependency.
- Agent 5 should define the initial content pack and event taxonomy before the first integration pass.
- the tip-selection engine should be integrated before content tuning is considered complete.
- restart-level flow should be implemented before failure-state polish is considered complete.
- edge-case recovery rules should be implemented before broad polish work begins.
- Agent 1 should only take back implementation work when a contract conflict or architecture change blocks multiple agents.

## Recommended Order of Work

1. Agent 1 scaffolds the repo and freezes the first set of contracts.
2. Agents 2, 3, 4, and 5 work in parallel against those contracts.
3. Agent 1 runs the first integration pass and resolves contract drift.
4. Agents 2, 3, 4, and 5 close the first playable loop together.
5. Agents 3, 4, and 5 harden reliability, fairness, and telemetry while Agent 2 finishes polish.

## MVP Definition of Done

The PRD is considered implemented at MVP level when:

- a user can start or resume a session
- the user can play through a curated sequence of levels
- failed levels can be restarted immediately without losing prior attempt history
- completed levels can be replayed without reducing unlocked progression
- each valid submission generates an image, receives a normalized score, and returns pass/fail
- the active level UI shows the target image, required threshold, attempts remaining, and level number
- result screens compare the target image against the generated image in a clear side-by-side or equivalent layout
- failed attempts return actionable retry tips
- failure after all attempts shows the strongest attempt score and concise advice
- failure after all attempts offers a restart path and does not soft-lock the player
- attempts, best scores, and unlocked progress persist correctly
- raw and normalized scores are both stored for tuning and analytics
- invalid submissions and technical failures do not consume attempts
- the final completion summary is shown at the end of the level set
- the final completion summary includes levels completed, attempts used, best scores, and improvement trend
- the final completion summary encourages replay or future content return
- key analytics events are emitted across the full loop and map cleanly to the PRD metrics
- major technical failures are handled without corrupting progress

## Immediate Next Tasks

The first concrete tasks for the repo should be:

- choose and scaffold the app stack, analytics provider, and baseline AI providers
- choose the asset storage strategy for target and generated images
- document the MVP constants: 120-character prompt limit, 3-attempt cap, and seeded thresholds of 50, 60, and 70
- document the MVP defaults for visible target image, percentage score display, anonymous server-persisted progress, and generated-image retention
- create the shared domain types and level content schema
- define the analytics event taxonomy, PRD metric mapping, and QA acceptance matrix
- create the first 3 seeded levels with target-image placeholders
- implement mocked attempt submission so the frontend loop can be built before provider wiring
- add `README.md` setup instructions once the scaffold exists

## Status

- `PRD.md`: defined
- `README.md`: defined
- `TASKS.md`: defined
- app scaffold: completed
- provider integrations: not started
- gameplay implementation: in progress
