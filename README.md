# Pixel Prompt

## Overview

Pixel Prompt is a web-first game that teaches players how to write better image-generation prompts by turning prompt writing into a visual matching challenge.

In each level, the player sees a target image and must write a short prompt that recreates something visually similar. The app generates an image from the player's prompt, compares it to the target, produces a similarity score, and decides whether the player passed the level. The game is designed to make prompt writing feel approachable, skill-based, and replayable.

This repository is the starting point for the product and implementation work.

## Why This App Exists

Most beginners struggle to write strong image prompts because they do not yet know how to notice and name the visual details that matter. They often describe only the obvious subject and miss the medium, composition, materials, textures, lighting, style, or context that actually shape the result.

Pixel Prompt exists to train that observational skill through repeated play:

- Players learn by comparing what they intended with what the model produced.
- Short prompt limits force concise, intentional descriptions.
- Scoring creates a clear feedback loop.
- Retry tips turn failure into guided practice.
- Level progression gives structure and a sense of mastery.

## Core Gameplay Summary

The core round loop is straightforward:

1. The player enters a level and sees a target image.
2. The player writes a short prompt within a tight character limit.
3. The system generates an image from that prompt.
4. The system compares the generated image with the target image.
5. The player receives a score and pass/fail result.
6. If the score is below the threshold, the player gets targeted tips and can try again.
7. The player either clears the level, uses all attempts, or exits and resumes later.

Baseline game rules:

- Prompt length target: about 120 characters maximum
- Attempts per level: up to 3
- Difficulty: threshold increases by level
- Early thresholds:
  - Level 1: 50%
  - Level 2: 60%
  - Level 3: 70%

## Target Audience

Primary audience:

- Beginners who want to learn how to write better image prompts
- Curious users who enjoy short, skill-based web games
- Creators and hobbyists who want practical prompt practice, not just theory

Secondary audience:

- Intermediate users who want to sharpen image description precision
- Educators or workshop facilitators who want a lightweight training tool

## Proposed Tech Direction

This should be built as a modern web app with a clear path from MVP to a more scalable live product.

Suggested stack direction:

- Frontend: React with TypeScript
- App framework: Next.js or another React-based full-stack framework with server actions or API routes
- Styling: a utility-first CSS layer or a lightweight component system with strong design tokens
- State management: local UI state plus a predictable shared store for gameplay and async request state
- Backend: framework-hosted API layer for game sessions, generation requests, scoring, and progress persistence
- Database: relational database for levels, attempts, results, and progression
- Asset storage: object storage for target image metadata and generated result references
- Model adapters:
  - image generation provider abstraction
  - similarity scoring provider abstraction
- Analytics: event-based product analytics pipeline

## Phase 0 Stack Decisions

The first execution task is now decided and documented.

- Framework: Next.js App Router with React and TypeScript
- Package manager: pnpm
- Database: PostgreSQL with Drizzle ORM and `drizzle-kit` migrations
- Analytics provider: PostHog
- Testing stack: Vitest, React Testing Library, and Playwright

Detailed rationale and guardrails live in `docs/foundation/stack-decisions.md`.

## Phase 0 AI Provider Decisions

The second execution task is now decided and documented.

- Baseline provider: OpenAI
- Generation model: `gpt-image-1.5`
- Scoring model: `gpt-5.4 mini`

Detailed rationale, source links, and fallback notes live in `docs/foundation/ai-provider-decisions.md`.

## Phase 0 Asset Storage Decision

The third execution task is now decided and documented.

- Storage provider: Amazon S3
- Target assets: versioned bucket for curated level images
- Generated outputs: private bucket for player attempt images served through signed access

Detailed rationale and access-pattern notes live in `docs/foundation/asset-storage-decision.md`.

## Phase 0 Retention Policy

The fourth execution task is now decided and documented.

- Target images: retained until content is explicitly replaced or removed
- Generated attempt images: retained for 90 days, then hard-deleted
- Database attempt metadata: retained longer than the generated image object

Detailed lifecycle rules live in `docs/foundation/asset-retention-policy.md`.

## Phase 0 Persistence Decision

The fifth execution task is now decided and documented.

- Progress is server-persisted in PostgreSQL
- Identity is anonymous and browser-scoped in MVP
- Resume is driven by an opaque HTTP-only session cookie

Detailed persistence and session rules live in `docs/foundation/persistence-model.md`.

## Suggested High-Level Architecture

The product can be organized into a few clear domains:

### Client App

- Landing and onboarding flow
- Level selection and progression UI
- Active gameplay UI
- Result, retry, and completion screens
- Resume progress handling

### Game Application Layer

- Session lifecycle management
- Level rules and thresholds
- Attempt validation
- Pass/fail resolution
- Tip generation orchestration

### Content Layer

- Level definitions
- Target image metadata
- Difficulty settings
- Tip heuristics and prompt coaching rules

### Generation Layer

- Accept player prompt
- Send generation request to selected provider
- Track request state
- Store generated output and request metadata

### Scoring Layer

- Compare target and generated output
- Normalize similarity output into a player-facing score
- Return supporting breakdown data for future feedback improvements

### Persistence Layer

- User progress
- Attempt history
- Best scores
- Resume state
- Completion summaries

## Suggested MVP Scope

The MVP should prove the core learning loop before expanding content or adding social features.

Recommended MVP scope:

- Web app with landing page and start flow
- Small curated level set
- Single-player progression through sequential levels
- Prompt entry with enforced character limit
- Up to 3 attempts per level
- Image generation integration through one provider
- Similarity scoring integration through one provider or scoring approach
- Threshold-based pass/fail logic
- Basic targeted retry tips
- Local or account-based progress persistence
- Final summary screen after completing the MVP level set
- Core analytics on funnel, attempts, pass rates, and retries

Not required for MVP:

- Daily challenges
- Multiplayer or competitive modes
- User-generated level packs
- Prompt sharing
- Rich scoring explainability
- Advanced personalization

## Future Ideas

- More level packs with themed difficulty tracks
- Daily challenge mode
- Hint system with score penalties
- Timed mode
- Coach mode that explains why one prompt is stronger than another
- Difficulty branches based on player performance
- Seasonal content drops
- Leaderboards or friend challenges
- Accessibility-focused descriptive practice modes
- Adaptive tip generation based on common player mistakes

## Local Setup

### Prerequisites

- Node.js 22.x was used to verify the current scaffold
- `pnpm` 10.33.0
- PostgreSQL for later backend tasks
- AWS credentials and S3 buckets for later asset-storage tasks
- OpenAI credentials for later generation and scoring tasks

The current scaffold boots without external service credentials. Analytics is a no-op when PostHog variables are unset.

### Install

```bash
pnpm install
cp .env.example .env.local
```

### Run the App

```bash
pnpm dev
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Run Tests

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional browser coverage:

```bash
pnpm test:e2e
```

## Development Workflow Suggestions

- Keep product behavior aligned with `PRD.md` before expanding scope.
- Treat `TASKS.md` as the source for execution order and delivery tracking.
- Build the app in vertical slices:
  - one complete playable level flow
  - then persistence
  - then analytics
  - then polish
- Keep model integrations behind clear interfaces so generation or scoring providers can be swapped later.
- Add fixtures and deterministic test hooks early to make the gameplay loop testable without depending entirely on live model outputs.
- Define content and thresholds in structured data rather than hard-coding them into UI components.

## Contribution Guidance

This section is intentionally a placeholder until the codebase structure exists.

Future contribution guidance should cover:

- branching strategy
- code review expectations
- coding standards
- testing expectations
- content authoring conventions for levels and target images
- analytics event naming rules

## Project Documents

The three root documents serve different purposes and should stay aligned:

- `PRD.md` defines the product: audience, goals, states, rules, requirements, and open questions.
- `README.md` explains what the repository is, why the product matters, the proposed technical direction, and how to work in the project.
- `TASKS.md` converts the product and technical direction into an execution plan with implementation-ready phases and checklists.

Practical rule:

- update `PRD.md` when product behavior changes
- update `README.md` when repo usage, architecture, or developer workflow changes
- update `TASKS.md` when scope, sequence, or delivery status changes

## Current Status

Current state of the repository:

- product concept defined
- core planning docs being established
- implementation scaffold not yet started

The next logical step is to turn the MVP scope into a concrete application scaffold and begin the first vertical slice of gameplay.
