# Phase 4 Task: Hard-Level Score Fairness Review

Status: completed on 2026-04-10

## Scope

- review the current Level 3 fairness behavior in the default mock scoring path
- verify that semantically valid hard-level paraphrases are not rejected only because they avoid one exact keyword
- verify that long but under-specified hard-level prompts still fail instead of coasting over the threshold on length alone

## Why This Review Was Needed

The earlier scoring review in `docs/foundation/scoring-consistency-evaluation.md` proved deterministic stability for the seeded exact-keyword fixtures, but it did not probe the harder failure mode on Level 3:

- the mock scorer is still the stable default when the live scorer is disabled
- Level 3 is the only seeded `hard` level
- the previous Level 3 fixtures all used the exact canonical keywords, so they did not test paraphrases or borderline architectural descriptions

That left a fairness gap in the current default path.

## Calibration Applied

The Level 3 mock scorer now uses deterministic signal groups instead of exact single-word matches for a few architectural cues:

- `courtyard` also recognizes `cloister`
- `arches` also recognizes `archways`, `archway`, and `arcade`
- `stone` also recognizes `sandstone` and `masonry`
- `ornate` also recognizes `carved`
- `historical` also recognizes `historic`
- `warm` also recognizes `warmed`
- `layered` also recognizes `repeating`

The scorer also now applies a hard-level coverage guard:

- on `hard` levels, prompts with fewer than 4 matched scene signals are capped below the pass threshold

This keeps long but vague prompts from passing on verbosity alone.

## Deterministic Review Results

Level 3 threshold: `70`

| Prompt class | Example prompt | Score | Result |
| --- | --- | --- | --- |
| Seeded strong match | `ornate stone courtyard with layered arches` | 90 | pass |
| Seeded strong match | `historical courtyard of warm stone arches` | 89 | pass |
| Seeded strong match | `layered stone architecture in ornate courtyard` | 91 | pass |
| Semantically valid paraphrase | `sun-warmed cloister with repeating archways` | 80 | pass |
| Semantically valid paraphrase | `historic cloister of carved stone archways` | 90 | pass |
| On-theme but under-specified | `stone courtyard with arches` | 63 | fail |
| On-theme but under-specified | `warm historical courtyard` | 61 | fail |
| Long but still under-specified | `historic carved masonry atrium with dramatic columns and open skylight` | 65 | fail |
| Off-topic | `flat vector logo of a cat` | 35 | fail |

## Decision

- keep Level 3 at a `70` threshold
- keep the calibrated mock scorer as the default no-credential scoring path
- treat the current review as deterministic fairness coverage for development and regression detection, not as a substitute for live scorer calibration against real target/generated images

## Evidence

- `src/server/game/mock-attempt-evaluator.ts`
- `src/server/providers/mock-image-scoring.ts`
- `tests/unit/server/mock-attempt-evaluator.test.ts`
