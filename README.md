# Pixel Prompt

Pixel Prompt is a web-based prompt-writing game. Players study a target image, write a short image-generation prompt, submit it, and try to beat a level-specific match threshold.

The repository is no longer just a planning scaffold. It contains a playable MVP with landing, start/resume, active play, retry, restart, replay, and final-summary flows.

## Current MVP

The shipped MVP focuses on a short three-level training loop:

- Landing page with a concise game pitch, new-run CTA, resume CTA, and a featured target preview
- Anonymous server-backed progress with resume via an HTTP-only session cookie
- Active level screen with:
  - level number
  - required threshold
  - attempts remaining
  - visible target image while writing
  - mobile target-image expansion
- Submission flow with prompt validation, generating state, score result, retry tips, and pass/fail transitions
- Replay-safe progression rail so completed levels can be revisited without reducing unlocked progress
- Final summary with levels completed, attempts used, best scores, and improvement trend

Current seeded thresholds:

- Level 1: `50%`
- Level 2: `60%`
- Level 3: `70%`

Core gameplay constraints:

- Prompt limit: `120` characters
- Max scored attempts per level: `3`
- Invalid submissions and technical failures do not consume attempts

## Why This App Exists

Most beginners struggle to write strong image prompts because they do not yet know how to notice and name the visual details that matter. They often describe only the obvious subject and miss the medium, composition, materials, textures, lighting, style, or context that actually shape the result.

Pixel Prompt exists to train that observational skill through repeated play:

- Players learn by comparing what they intended with what the model produced.
- Short prompt limits force concise, intentional descriptions.
- Scoring creates a clear feedback loop.
- Retry tips turn failure into guided practice.
- Level progression gives structure and a sense of mastery.

## Stack

- Framework: Next.js App Router
- UI: React 19 + TypeScript + CSS Modules
- Package manager: `pnpm`
- Persistence: PostgreSQL via Drizzle ORM, with fallback behavior when `DATABASE_URL` is unset
- Analytics: PostHog
- Tests: Vitest, React Testing Library, Playwright

Provider model:

- Default local/runtime path: deterministic mock generation and mock scoring
- Opt-in live generation: `gpt-image-1.5`
- Opt-in live scoring: `gpt-5.4-mini`
- Opt-in local image generation: ComfyUI + `FLUX.1-schnell`
- Opt-in local scoring: LM Studio using an image-capable local model

## Repository Map

High-signal folders (relative to repo root):

- [src/app](./src/app) App Router pages and API routes
- [src/components](./src/components) landing and gameplay UI
- [src/content](./src/content) seeded levels, tips, and shared UI copy
- [src/lib/game](./src/lib/game) shared game-domain types and screen helpers
- [src/server/game](./src/server/game) gameplay rules, session orchestration, and HTTP handlers
- [src/server/providers](./src/server/providers) generation and scoring adapters
- [tests](./tests) unit and UI coverage

Useful entry points:

- [src/app/page.tsx](./src/app/page.tsx)
- [src/app/play/page.tsx](./src/app/play/page.tsx)
- [src/components/landing/landing-screen.tsx](./src/components/landing/landing-screen.tsx)
- [src/components/game/active-level-screen.tsx](./src/components/game/active-level-screen.tsx)

## Local Setup

### Prerequisites

- Node.js `22.x`
- `pnpm` `10.33.0`
- PostgreSQL only if you want durable database-backed persistence
- OpenAI credentials only if you want live generation or scoring
- ComfyUI only if you want local image generation
- LM Studio only if you want local image scoring

The app runs without external credentials. When analytics variables are unset, PostHog is a no-op. When the OpenAI feature flags are unset, generation and scoring stay on the deterministic mock path.

### Install

```bash
pnpm install
cp .env.example .env.local
pnpm env:check:preview
```

### Run

```bash
pnpm dev
```

Then open the local URL printed by Next.js, usually [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Test and Verify

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

## Environment Notes

The most important runtime switches are:

- `DATABASE_URL`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `OPENAI_API_KEY`
- `PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION`
- `PIXEL_PROMPT_ENABLE_OPENAI_SCORING`
- `PIXEL_PROMPT_ENABLE_COMFYUI_IMAGE_GENERATION`
- `COMFYUI_BASE_URL`
- `COMFYUI_IMAGE_MODEL`
- `COMFYUI_WORKFLOW_PATH`
- `PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING`
- `LMSTUDIO_BASE_URL`
- `LMSTUDIO_SCORING_MODEL`
- `PIXEL_PROMPT_GENERATED_OUTPUT_DIR`
- `PIXEL_PROMPT_TARGET_ASSET_DIR`
- `BLOB_READ_WRITE_TOKEN`

Preview env validation:

```bash
pnpm env:check:preview
```

This README intentionally stops short of deployment workflow details. It only documents the runtime contract needed for local development and product understanding.

### Local AI Setup

For a fully local `dev` path:

- keep OpenAI flags disabled
- enable ComfyUI generation with `PIXEL_PROMPT_ENABLE_COMFYUI_IMAGE_GENERATION=1`
- enable LM Studio scoring with `PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING=1`

Recommended `.env.local` additions:

```bash
PIXEL_PROMPT_ENABLE_COMFYUI_IMAGE_GENERATION=1
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
COMFYUI_WORKFLOW_PATH=.config/comfyui/flux-schnell-api.json

PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING=1
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_SCORING_MODEL=google/gemma-4-26b-a4b

PIXEL_PROMPT_TARGET_ASSET_DIR=public
PIXEL_PROMPT_GENERATED_OUTPUT_DIR=.pixel-prompt/generated-output
```

ComfyUI workflow requirements:

- export a working FLUX.1-schnell workflow from ComfyUI using `Save (API Format)`
- include a `{{PROMPT}}` placeholder anywhere the app should inject the player prompt
- optionally include a `{{SEED}}` placeholder in any numeric seed field
- the provider will submit the workflow, poll job history, and persist the first returned image

LM Studio scoring requirements:

- run LM Studio’s local server
- load a vision-capable local model that supports image input and structured JSON output
- the scorer sends the target image and the generated image together and expects strict JSON back

## Current Limitations

These are product and implementation limitations, not deployment instructions:

- The shipped level set is intentionally small: three seeded levels
- The mock provider path is the stable default; live provider quality still depends on calibration and asset strategy
- Generated output persistence uses Vercel Blob Storage in production and local filesystem in development
- Anonymous progress is browser-scoped; account systems are out of scope for the MVP

## Documentation

- [PRD.md](./PRD.md) is the product truth
- [TASKS.md](./TASKS.md) is the execution history and current work log
