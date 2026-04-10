# Phase 3 Task: Threshold And Tip Tuning For The Seeded Level Set

Status: completed on 2026-04-08

## Decision

- keep the seeded thresholds at `50`, `60`, and `70` for Levels 1-3
- tune the retry-tip catalog so the first seeded levels surface more level-specific coaching under the current deterministic scorer

## Threshold Review

Current deterministic evidence still supports the seeded thresholds:

| Level | Threshold | Acceptable Prompt Scores | Margin Above Threshold | Off-Topic Score |
| --- | --- | --- | --- | --- |
| Level 1 | 50 | 89, 90, 91 | +39 to +41 | 35 |
| Level 2 | 60 | 88, 90, 91 | +28 to +31 | 32 |
| Level 3 | 70 | 89, 90, 91 | +19 to +21 | 35 |

Sources:

- `docs/foundation/scoring-consistency-evaluation.md`
- `tests/unit/server/mock-attempt-evaluator.test.ts`

Interpretation:

- every seeded acceptable prompt still clears its threshold comfortably
- every seeded off-topic prompt still fails clearly
- the deterministic scorer is still too keyword-driven to justify threshold retuning without live scorer calibration and real target/generated image review

Because of that, threshold changes would be speculative at this stage and are deferred.

## Tip Tuning

The current deterministic scorer only emits `subject`, `context`, and `composition` breakdowns. That meant some seeded level-specific coaching in `src/content/tips/index.ts` was valid but rarely surfaced under the default mock path because it depended on dimensions like `materials` or `time_period`.

To better align the seeded content with the scoring signals that actually exist today:

- Level 1 now has a still-life-specific composition tip that calls out the tabletop crop and object spacing
- Level 3 now has a historical-environment composition tip that calls out arch rhythm, courtyard depth, and repeating stone structure

These additions do not change the generic tip system. They only ensure the seeded levels surface more concrete advice under the current breakdown model.

## Follow-Up Trigger

Re-open threshold tuning when both of these are true:

1. real target/generated image assets are available for the seeded levels
2. the live scorer has enough reviewed samples to compare acceptable matches, weak-but-valid prompts, and nonsensical prompts across each level
