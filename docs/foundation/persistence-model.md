# Phase 0 Task 5: MVP Persistence Model and Anonymous Identity Strategy

Status: completed on 2026-03-29

This decision builds on the stack, storage, and retention choices already captured in the other Phase 0 foundation docs.

Scope for this task:

- define where authoritative game progress lives
- define how an anonymous player is identified
- define how resume works in MVP

## Decision Summary

- authoritative progress lives in PostgreSQL, not in browser-only storage
- each browser gets one anonymous player identity in MVP
- the browser identity is represented by an opaque session token stored in an HTTP-only cookie
- the server resolves that token to an anonymous player record and the current run/progress state

## Identity Model

- cookie name: `pp_session`
- token shape: opaque random token; do not expose raw database IDs to the client
- storage: token in cookie, token hash in PostgreSQL
- cookie flags:
  - `HttpOnly`
  - `Secure` in production
  - `SameSite=Lax`
- expiry: rolling 90-day expiry, refreshed on meaningful gameplay activity

Why this fits:

- the PRD explicitly keeps accounts out of MVP
- anonymous server-side identity supports resume and best-score retention without introducing sign-in friction
- storing only the token hash server-side reduces the blast radius if database rows are exposed

## Persistence Model

- PostgreSQL is the source of truth for:
  - anonymous player identity
  - active run state
  - unlocked progression
  - attempt history
  - best scores
  - durable asset keys and provider metadata
- browser storage may be used later only for non-authoritative conveniences such as draft prompt recovery

Why this fits:

- progress must survive refreshes and browser restarts
- gameplay fairness rules and attempt consumption need a server-authoritative record
- analytics and debugging need stable attempt history beyond what browser storage can safely provide

## Resume Behavior

- on app load, the server checks `pp_session`
- if the token maps to a valid anonymous player and unfinished run, the app offers resume
- if the token maps to a completed run with unlocked replayable levels, the app can still load best scores and replay state
- if the token is missing, expired, or unknown, the app starts a new anonymous player and run

## Session Lifetime Rule

- the session lifetime is capped by the generated-image retention policy
- practical implication: anonymous progress should be treated as resumable for up to 90 days of activity
- if a session outlives its generated images, the progress record remains valid but expired images must render as unavailable rather than broken

## Non-Goals For MVP

- no cross-device resume
- no account linking
- no email recovery
- no shareable resume links

## Tradeoff Notes

- browser-scoped anonymous identity means players can lose progress if they clear cookies or switch devices
- this is acceptable in MVP because the product goal is low-friction learning, not durable account portability
- moving to account-backed identity later should layer on top of the anonymous player model rather than replacing the underlying run and attempt records
