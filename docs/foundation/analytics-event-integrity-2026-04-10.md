# Phase 4 Task: Analytics Event Integrity Review

Status: completed on 2026-04-10

## Scope

- verify that the emitted analytics events still support the PRD and `TASKS.md` product metrics
- verify that the client and server events for a resumable run can be joined under one analytics identity
- lock the expected event sequences in tests so metric drift is caught as a regression

## Integrity Fix Applied

The review found an identity-join risk in the returning-player funnel:

- landing and resume CTAs were captured from the client
- resume-progress and gameplay outcomes were captured from the server
- the shared analytics helper preferred `anonymousPlayerId` over `runId`

That meant the same resumable run could be split across different distinct IDs depending on which layer emitted the event.

The fix now in the repo is:

- `landing_viewed` can carry `runId` when the landing screen is rendered for an existing run
- analytics distinct IDs now prefer `runId` over `anonymousPlayerId`
- landing-page client events now carry the current run/player identity whenever the server already knows it
- resume-progress server events now include `runId` on `landing_viewed`

This makes resume and gameplay events join cleanly by run across client and server captures.

## Verified Metric Coverage

The current event schema and flow tests now verify support for:

- landing-to-start conversion
- resume rate
- level start rate
- prompt validation failure rate
- prompt submission rate
- generation success and failure rate
- scoring success and failure rate
- attempt completion rate
- pass/fail by level
- retry behavior
- run completion rate
- latency metrics from generation, scoring, and full attempt duration
- idempotency protection so duplicate retries do not inflate counts

## Automated Evidence

- `tests/unit/analytics/config.test.ts`
- `tests/unit/analytics/events.test.ts`
- `tests/unit/app/landing-screen.test.tsx`
- `tests/unit/server/game-http-analytics.test.ts`
- `tests/unit/server/game-analytics.test.ts`

## Residual Gap

First-touch new-run funnels still begin with a browser-session distinct ID until the backend mints a run on the first server write. That does not break the documented event-count metrics, but it does mean a fully person-joined PostHog funnel from first landing view through later server-side gameplay would still need an eager session/run mint if that analysis becomes important.
