# Phase 4 Task: Server-Only Secrets Audit

Status: completed on 2026-04-10

## Scope

- verify that provider credentials and storage/database secrets stay in server-only modules
- verify that client runtime files do not import server modules or read secret env vars
- verify that the built client bundle does not contain server secret env names

## Findings

The current public client surface is intentionally limited to PostHog browser config:

- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

The source audit showed that server secret env vars remain scoped to server modules:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `AWS_REGION`
- `S3_TARGET_ASSET_BUCKET`
- `S3_GENERATED_OUTPUT_BUCKET`
- `PIXEL_PROMPT_TARGET_ASSET_DIR`
- `PIXEL_PROMPT_GENERATED_OUTPUT_DIR`

## Hardening Applied

- added a local `src/server/server-only.ts` guard and imported it from the database client and provider entrypoints that touch secrets or server filesystem paths
- narrowed the shared analytics type import away from the server provider barrel so client-safe shared code no longer depends on the server barrel
- clarified `.env.example` so only the PostHog browser values are marked public and the rest are explicitly server-only
- added `tests/unit/security/client-boundaries.test.ts` to keep client runtime files free of `@/server/` imports and server secret env names

## Build Verification

Verification run on 2026-04-10:

- `pnpm build`
- `rg -n "OPENAI_API_KEY|DATABASE_URL|AWS_REGION|S3_TARGET_ASSET_BUCKET|S3_GENERATED_OUTPUT_BUCKET|PIXEL_PROMPT_TARGET_ASSET_DIR|PIXEL_PROMPT_GENERATED_OUTPUT_DIR" .next/static`

Result:

- production build completed successfully
- the client bundle search returned no matches for server secret env names

## Evidence

- `src/server/server-only.ts`
- `src/server/db/client.ts`
- `src/server/providers/index.ts`
- `src/server/providers/image-generation.ts`
- `src/server/providers/image-scoring.ts`
- `src/server/providers/openai-image-generation.ts`
- `src/server/providers/openai-image-scoring.ts`
- `src/server/providers/generated-output-store.ts`
- `src/server/providers/target-asset-store.ts`
- `.env.example`
- `tests/unit/security/client-boundaries.test.ts`
