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
