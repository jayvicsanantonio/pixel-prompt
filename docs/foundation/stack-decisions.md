# Phase 0 Task 1: Core Stack Decisions

Status: completed on 2026-03-29

Scope for this task:

- choose the framework
- choose the package manager
- choose the database
- choose the analytics provider
- choose the testing stack

## Decisions

### Framework

- Next.js App Router with React and TypeScript

Why this fits:

- keeps the client UI, server routes/actions, and shared types in one TypeScript codebase
- matches the PRD's web-first MVP and the recommended React-based stack direction already captured in `README.md`
- gives a clean path for server-only provider credentials and future preview/production deployment
- supports the image-heavy gameplay flow without introducing extra platform surface area this early

### Package Manager

- pnpm

Why this fits:

- fast, deterministic installs with a strict dependency graph
- scales cleanly if the repo later grows into a workspace with shared packages
- common pairing with Next.js, Playwright, Vitest, and Drizzle

### Database

- PostgreSQL as the system-of-record database
- Drizzle ORM plus `drizzle-kit` for schema management and migrations

Why this fits:

- the MVP data model is relational: levels, sessions, attempts, best scores, unlocked progress, analytics references
- durable anonymous progress and attempt history are better served by a real relational store than by local-only persistence
- Drizzle keeps schema and SQL close to the code while preserving strong TypeScript types for later shared contracts

### Analytics Provider

- PostHog

Why this fits:

- event-first product analytics aligns with the PRD metrics in `TASKS.md`
- supports funnels, retention, retries, completion analysis, and custom event properties without forcing a heavyweight data stack on day one
- works well with a Next.js app where some events will be emitted client-side and others server-side

### Testing Stack

- Vitest for unit and business-rule tests
- React Testing Library for component and interaction tests
- Playwright for end-to-end gameplay coverage

Why this fits:

- maps directly to the repo's future needs:
  - business-rule coverage for progression, retries, resume, and attempt fairness
  - UI behavior coverage for validation, keyboard flow, and result states
  - browser-level coverage for the playable loop
- keeps fast feedback for most tests while reserving Playwright for the small number of full-flow checks that actually need a browser

## Guardrails Enabled By These Choices

- keep provider credentials server-side only through Next.js server boundaries
- treat PostgreSQL as the durable source of truth for progress and attempt history
- keep analytics event names and payloads versioned in code rather than ad hoc in UI components
- preserve a single shared TypeScript contract layer between UI, backend, content, and adapters

## Explicitly Deferred To Later Phase 0 Tasks

These are not decided by this task and should be handled separately in the execution order from `TASKS.md`:

- baseline AI providers and models for generation and scoring
- asset storage strategy for target and generated images
- generated-image retention policy
- anonymous identity/session strategy details
- deployment, staging, and preview environment assumptions
- repo scaffold and local setup commands
