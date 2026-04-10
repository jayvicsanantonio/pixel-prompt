# Phase 4: Abuse Controls and Rate Limiting

Status: submit-attempt throttling completed on 2026-04-09; restart/replay mutation review completed on 2026-04-09

## Submit-Attempt Protection

The expensive abuse surface in MVP is `POST /api/game/submit-attempt`, because every accepted request can trigger image generation and scoring work.

The server now protects that route with fixed-window throttles:

- scope by valid session token when a known `pp_session` cookie exists
- otherwise scope by anonymous request fingerprint derived from the trusted client IP, preferring single-hop proxy headers with a sanitized forwarded-chain fallback
- enforce both a short burst window and a longer sustained window
- return HTTP `429` with `Retry-After` and a player-readable recovery message
- use PostgreSQL-backed counters when `DATABASE_URL` is configured, with an in-memory fallback for local/test paths without database persistence

Default limits:

- burst: `8` submit attempts per `60` seconds
- sustained: `30` submit attempts per `600` seconds

Config guardrail:

- burst and sustained windows must remain distinct so each policy keeps its own bucket

These defaults are intentionally generous enough for rapid internal playtesting while still blocking scripted churn on the costly provider path.

## Restart / Replay Mutation Review

`POST /api/game/restart-level` and `POST /api/game/replay-level` were reviewed separately before adding more throttles.

Current conclusion for MVP limited testing:

- do not add dedicated throttles yet

Reasoning:

- both routes require an existing saved session
- both routes are already state-gated in server logic:
  - restart only works for `failed` levels
  - replay only works for `passed` levels
- neither route triggers generation or scoring provider cost
- both routes mutate only the caller's own session state
- existing tests already cover the allowed and blocked transition rules for both mutations

Revisit this decision if either of these changes:

- QA observes spammy restart/replay loops that affect perceived stability
- telemetry shows mutation-volume anomalies once external testing starts
- these routes begin to trigger additional expensive work beyond session-state updates
