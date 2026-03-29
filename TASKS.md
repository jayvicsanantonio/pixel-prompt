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
- environment variable contract
- error model and loading-state conventions
- local development workflow
- initial test harness and CI baseline

Must deliver:

- initial app scaffold
- folder structure for app, server, content, and tests
- typed contract for levels, attempts, scores, and progress
- API boundaries for submit-attempt, resume-progress, and analytics ingestion
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
- attempt lifecycle rules
- threshold pass/fail logic
- retry and progression rules
- analytics event emission
- rate limiting and server-side validation

Must deliver:

- persistent level progress and attempt history
- server APIs or actions for gameplay state transitions
- normalized event schema for product metrics
- safe failure and retry behavior for technical errors
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

- initial curated level set with thresholds
- rule-based retry tips for missing visual specificity
- analytics event definitions tied to product metrics
- QA coverage plan for gameplay, resume, and failure states
- evaluation notes for threshold fairness and content difficulty

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

## Phase Plan

### Phase 0: Foundation and Contracts

Primary owner:

- Agent 1

Support:

- Agent 3 reviews persistence model
- Agent 4 reviews provider interfaces and score payloads
- Agent 5 reviews content schema and analytics taxonomy

Tasks:

- choose the framework, package manager, database, and testing stack
- scaffold the app and repository structure
- define shared TypeScript types for level, attempt, score, result, and progress
- define content file format for levels and tip rules
- define provider interfaces for generation and scoring
- define event schema for analytics
- write local setup instructions into `README.md`

Exit criteria:

- repo boots locally
- shared contracts compile
- all agents can build against the same interfaces

### Phase 1: Parallel MVP Slice Development

Primary owners:

- Agent 2 on UI
- Agent 3 on game-state backend
- Agent 4 on provider integrations and scoring
- Agent 5 on content, QA, and telemetry

Tasks for Agent 2:

- build landing page and start/resume states
- build active level screen and prompt input
- build generating, result, retry, success, failure, and summary states
- wire the UI to mocked server contracts first

Tasks for Agent 3:

- implement persistence schema
- implement session, attempt, and progression logic
- implement submit-attempt and resume-progress endpoints
- implement analytics emission points

Tasks for Agent 4:

- integrate one generation path
- integrate one scoring path
- define normalized score outputs and reasoning fields
- define provider failure behavior and fallback signals
- create deterministic fixtures for scoring and integration tests

Tasks for Agent 5:

- create initial levels and threshold values
- define first-pass retry tip heuristics
- define analytics event dictionary and acceptance checks
- author QA matrix for edge cases and fairness reviews

Exit criteria:

- each workstream runs independently against shared contracts
- mocked end-to-end loop exists in frontend
- backend rules pass tests
- provider layer produces stable payloads
- content pack, telemetry schema, and QA matrix exist

### Phase 2: First End-to-End Playable Loop

Primary owners:

- Agent 2, Agent 3, Agent 4, Agent 5

Coordination owner:

- Agent 1

Tasks:

- connect frontend submission flow to real backend endpoint
- connect backend attempt processing to generation and scoring adapters
- display real score, pass/fail state, and retry tips
- decrement attempts only after valid scored submissions
- persist best score, attempt history, and unlocked level progression
- verify gameplay events and QA the happy-path plus core failure-path loop

Exit criteria:

- a player can start Level 1, submit a prompt, receive a score, retry, pass or fail, and resume later
- the happy path and core failure path are both validated

### Phase 3: Full MVP Completion

Primary owners:

- Agent 2 on summary and polish
- Agent 3 on resume and server reliability
- Agent 4 on scoring calibration and provider resilience
- Agent 5 on content expansion, threshold tuning, and analytics validation

Tasks:

- implement final completion summary
- implement multi-level progression with unlocks
- validate resume behavior across refresh and return sessions
- ensure analytics cover the full gameplay funnel
- tune thresholds and tip rules across the initial curated level set
- add failure handling for generation, scoring, and network issues
- run structured QA across the full level set

Exit criteria:

- the MVP level set is playable from start to finish
- progression and resume behavior are stable
- analytics and edge-case handling are in place
- content difficulty and score fairness have been reviewed

### Phase 4: Hardening and Launch Readiness

Primary owners:

- Agent 3, Agent 4, and Agent 5

Support:

- Agent 2 for UX polish
- Agent 1 for release checklist and technical debt triage

Tasks:

- add abuse controls and rate limiting
- verify accessibility and keyboard navigation
- improve loading and failure states
- add deterministic test fixtures for gameplay logic
- review score fairness on hard levels
- verify event integrity against product metrics
- clean up developer docs and deployment assumptions

Exit criteria:

- MVP is stable enough for limited user testing
- technical and scoring failures are observable and recoverable
- analytics and QA signals are strong enough to guide iteration

## Handoff Contracts

### Agent 1 -> Agent 2

- route structure
- shared types for all UI states
- mocked API response shapes
- design tokens or styling conventions

### Agent 1 -> Agent 3

- persistence model assumptions
- error contract
- analytics payload schema

### Agent 1 -> Agent 4

- provider interface contract
- result payload shape expected by the backend and UI

### Agent 1 -> Agent 5

- content schema
- analytics payload schema
- MVP acceptance criteria

### Agent 4 -> Agent 3

- generation request and result format
- score payload and normalization fields
- provider failure signals and retry-safe behavior

### Agent 3 -> Agent 2

- stable gameplay endpoints
- response shapes for result, retry, resume, and summary states
- error and validation response shapes

### Agent 4 -> Agent 5

- score breakdown signals
- provider caveats that affect threshold tuning
- failure taxonomy for QA coverage

### Agent 5 -> Agent 2

- content metadata for levels
- tip categories and copy constraints
- summary metrics and coaching copy constraints

### Agent 5 -> Agent 3

- analytics event dictionary
- QA assertions for progression and resume behavior
- content IDs, thresholds, and tip rule references

## Parallel Work Rules

- Agent 2 should start against mocks immediately after Phase 0.
- Agent 3 should own business rules in tests before wiring live providers.
- Agent 4 should create deterministic fixtures early so the rest of the system is testable without full live-model dependency.
- Agent 5 should define the initial content pack and event taxonomy before the first integration pass.
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
- each valid submission generates an image, receives a normalized score, and returns pass/fail
- failed attempts return actionable retry tips
- attempts, best scores, and unlocked progress persist correctly
- the final completion summary is shown at the end of the level set
- key analytics events are emitted across the full loop
- major technical failures are handled without corrupting progress

## Immediate Next Tasks

The first concrete tasks for the repo should be:

- choose and scaffold the app stack
- create the shared domain types and level content schema
- define the analytics event taxonomy and QA acceptance matrix
- create the first 3 seeded levels with target-image placeholders
- implement mocked attempt submission so the frontend loop can be built before provider wiring
- add `README.md` setup instructions once the scaffold exists

## Status

- `PRD.md`: defined
- `README.md`: defined
- `TASKS.md`: defined
- app scaffold: not started
- provider integrations: not started
- gameplay implementation: not started
