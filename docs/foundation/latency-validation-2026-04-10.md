# Phase 4 Latency Validation

Status: completed on 2026-04-10

## Scope

This audit closes the Phase 4 task to validate end-to-end attempt latency and perceived responsiveness during model requests.

It covered:

- player-visible pending-state behavior in the live `/play` submit flow
- local end-to-end `POST /api/game/submit-attempt` timing through the running app
- the mock provider baseline and the mock `#slow` generation path

## Perceived Responsiveness

The UI now has an explicit regression test for in-flight submit behavior:

- `tests/unit/app/active-level-screen.test.tsx`

Validated behavior:

- the screen switches into the `Generating` state immediately after submit
- the submitted prompt is visible while the request is in flight
- the primary action changes to the disabled `Working...` state until the response resolves

This test uses a deliberately unresolved mocked fetch before resolving it with a deterministic gameplay fixture, so the pending state is validated independently of network speed.

## End-To-End Local Timing

Environment:

- local dev server running on `http://127.0.0.1:3001`
- mock generation and scoring providers
- fresh anonymous submit attempts to `level-1`

Measured results:

- normal prompt:
  - average: `11.56 ms`
  - fastest: `4.40 ms`
  - slowest: `36.36 ms`
- mock `#slow` prompt:
  - average: `25.94 ms`
  - fastest: `24.71 ms`
  - slowest: `27.14 ms`

Observed behavior:

- the steady-state local mock path is very fast after warm-up
- the `#slow` marker adds a visible but still short delay, which is enough to validate that the pending UI remains stable during an active request
- a first-pass timing probe hit submit-rate-limiter noise when repeated requests shared the same anonymous fingerprint; the final measurements used distinct forwarded IPs per sample to isolate submit latency from throttling behavior

## Interpretation

- local mock timings are suitable for validating the responsiveness of the UI contract, not real provider latency expectations
- real OpenAI-backed generation and scoring will be materially slower than these local numbers, so the `Generating` state should be treated as required product behavior rather than a rare fallback
- no additional product changes were required after this validation pass because the pending UI already appears immediately and remains stable until the request resolves
