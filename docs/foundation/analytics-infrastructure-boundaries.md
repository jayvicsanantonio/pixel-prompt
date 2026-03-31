# Phase 0 Task 13: Analytics SDK and Infrastructure Boundaries

Status: completed on 2026-03-29

Verified against current official PostHog docs on 2026-03-29.

## Boundary Decisions

- client initialization lives in root `instrumentation-client.ts`
- client capture goes through `src/lib/analytics/client.ts`
- server capture goes through `src/server/analytics/posthog-server.ts`
- all event names and payloads must come from `src/lib/analytics/events.ts`
- analytics config is centralized in `src/lib/analytics/config.ts`

## Why This Shape

- PostHog's current Next.js guide explicitly recommends `instrumentation-client.ts` for client-side setup
- the same guide recommends the Node SDK for server-side analytics in Next.js
- PostHog's Next.js and Node guidance both call out short-lived server environments and recommend `flushAt: 1`, `flushInterval: 0`, and `await posthog.shutdown()` so events are flushed immediately

Sources:

- [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js)
- [PostHog Node.js docs](https://posthog.com/docs/libraries/node)

## Environment Contract

- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

Both client and server use the same project token and host in MVP. If either value is missing, analytics capture becomes a no-op rather than throwing during app startup.

## Deferred Items

- reverse proxy setup, which PostHog recommends to reduce tracking-blocker interference
- user identification beyond the anonymous MVP identity model
- feature flag bootstrapping and evaluation flows
- session replay enablement
