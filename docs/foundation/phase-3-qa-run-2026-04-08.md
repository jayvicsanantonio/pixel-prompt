# Phase 3 QA Run

Date: 2026-04-08

## Scope

This QA pass closes the remaining Phase 3 execution task in `TASKS.md`:

- run structured QA across the full seeded level set
- include nonsensical-but-valid prompt handling
- include the current scoring-consistency review status

## Automated Evidence Reviewed

- `tests/unit/app/active-level-screen.test.tsx`
- `tests/unit/server/live-state.test.ts`
- `tests/unit/server/mock-active-level-state.test.ts`
- `tests/unit/content/tips.test.ts`
- `tests/unit/server/game-tip-selection.test.ts`
- `tests/unit/server/game-http.test.ts`
- `tests/unit/server/mock-attempt-evaluator.test.ts`

## Results

### Progression And Recovery

- the `/play` route now shows the current run state continuously through the progression rail
- cleared levels can be replayed without reducing the unlocked frontier
- failed current levels expose `Restart Level` both in the failure view and in the progression rail

### Nonsensical But Valid Prompts

The server QA sweep now includes one policy-safe nonsense prompt per seeded level:

- Level 1: `banana theorem whispers beside cardboard lanterns`
- Level 2: `marble thunder sings under paper bicycles`
- Level 3: `upside-down soup library orbiting velvet ladders`

Observed behavior:

- all three prompts are treated as technically successful scored attempts
- all three stay below the level threshold and resolve as normal failed retries
- each level still returns usable retry guidance, including the new level-specific composition tips for Levels 1 and 3 and the urban-night context tip for Level 2

### Scoring Consistency Review

The current scoring-consistency review still points to no threshold change:

- seeded acceptable prompts remain comfortably above threshold in the deterministic scorer
- seeded off-topic prompts remain clearly below threshold
- live scorer fairness is still pending real target/generated asset calibration

Reference: `docs/foundation/scoring-consistency-evaluation.md`

## Remaining Manual Follow-Up

- browser-level refresh during in-flight generation with live provider latency
- broken generated-image display recovery
- live scorer review once real target/generated image pairs are available
