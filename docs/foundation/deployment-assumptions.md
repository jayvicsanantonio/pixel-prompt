# Phase 0 Task 14: Deployment, Staging, and Preview Assumptions

Status: completed on 2026-03-29

Verified against current official Vercel docs on 2026-03-29.

## Platform Assumption

- deploy the Next.js app on Vercel

Why this is the baseline:

- the app is already a standard Next.js project
- Vercel provides automatic Preview and Production deployment semantics that match the MVP branch workflow
- Vercel supports Development, Preview, Production, and Custom environments for environment-variable scoping

Sources:

- [Vercel environments and preview deployments](https://vercel.com/docs/deployments/custom-environments)
- [Vercel environment variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)

## Environment Model

- Development:
  local development on engineers' machines using `.env.local` or `vercel env pull`
- Preview:
  automatic Vercel preview deployment for every non-production branch and pull request
- Staging:
  one long-lived custom Vercel environment tied to a `staging` branch
- Production:
  Vercel production deployment from `main`

## Resource Isolation Assumptions

- Production uses dedicated production resources only:
  PostgreSQL, S3 buckets, PostHog token/project, and OpenAI credentials
- Staging uses dedicated non-production resources:
  staging database, staging buckets, staging analytics token or project, capped provider credentials
- Preview uses shared preview resources:
  one preview database, one preview asset namespace, and preview analytics disabled or routed to a non-production PostHog project
- Development uses local or pulled development configuration and must never point at production resources by default

## Environment Variable Rules

- all deploy-time configuration is managed in Vercel environment variables
- secret values must be created as sensitive environment variables where supported
- changes to environment variables require a fresh deployment before they take effect
- system environment variables should be exposed so deployment URL and environment metadata are available when needed

## Repo-Backed Workflow Configuration

As of 2026-04-10, the repository now encodes the deployment path assumptions in code:

- `.github/workflows/ci.yml`
  - runs on every pull request and on pushes to `staging` and `main`
  - acts as the repo-level preview gate before Vercel Preview or branch deployments are trusted
- `scripts/check-deploy-env.mjs`
  - validates the repo's deployment environment contract for `preview`, `staging`, and `production`
- `package.json`
  - exposes `pnpm env:check:preview`, `pnpm env:check:staging`, and `pnpm env:check:production`

## Current Environment Contract

| Environment | Branch / path | Required vars in the current repo | Notes |
| --- | --- | --- | --- |
| Development | local machine | none strictly required | analytics is disabled when PostHog vars are unset; provider paths stay mocked unless explicitly enabled |
| Preview | pull requests and non-production branches | none strictly required by default | preview may run with mocked providers and without durable database/storage config |
| Staging | `staging` branch | `DATABASE_URL`, `PIXEL_PROMPT_GENERATED_OUTPUT_DIR` | use non-production resources only; enable live OpenAI provider flags only when non-production quotas are ready |
| Production | `main` branch | `DATABASE_URL`, `PIXEL_PROMPT_GENERATED_OUTPUT_DIR` | production is the only environment allowed to use production analytics and provider credentials |

Conditional rules:

- if `PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION=1` or `PIXEL_PROMPT_ENABLE_OPENAI_SCORING=1`, `OPENAI_API_KEY` is required
- if either `S3_TARGET_ASSET_BUCKET` or `S3_GENERATED_OUTPUT_BUCKET` is configured, `AWS_REGION` is required
- `NEXT_PUBLIC_POSTHOG_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` must be set together or left unset together

## Preview Workflow

The repo-backed preview flow is now:

1. open or update a pull request
2. GitHub Actions runs the CI workflow
3. CI validates the preview env contract, lint, types, tests, and production build
4. Vercel Preview handles the deploy surface for feature review once the branch is connected in the Vercel project

This repo does not attempt to create or manage Vercel deployments directly. The branch-to-environment mapping still lives in the Vercel project configuration, but the expected paths and env checks now live in version control.

## Operational Boundaries

- preview deployments are for feature review and QA, not for durable user data
- staging is the pre-production integration environment for smoke testing real provider paths with non-production quotas
- production is the only environment that can use production analytics and provider credentials
- preview and staging buckets must never share names with production buckets
- production and non-production databases must remain separate

## Deferred Details

- exact Terraform or IaC strategy
- exact managed PostgreSQL vendor
- exact CDN or custom-domain setup
- automated database branching for preview environments
- deployment protection rules and authentication gates for previews
