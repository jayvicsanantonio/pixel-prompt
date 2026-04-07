# Phase 1 Task 4: Scoring Consistency on Visually Acceptable Matches

Status: completed on 2026-04-06

Scope for this task:

- evaluate whether seeded visually acceptable prompts score consistently enough for deterministic contract testing
- document what the current evaluation does and does not prove about the scoring system

## Current Evaluation Basis

- the live OpenAI image scorer is still opt-in and not calibrated against a curated real-image dataset in this repo
- because of that, the reproducible evaluation surface today is the deterministic mock scorer in `src/server/game/mock-attempt-evaluator.ts`
- the seeded prompt matrix now lives in `tests/unit/server/mock-attempt-evaluator.test.ts`

This is an evaluation of current deterministic fixture behavior, not a claim that live production scoring is calibrated.

## Seeded Acceptable-Match Results

The current prompt matrix uses three visually acceptable prompts per level that keep the same scene, subject, and framing intent while varying wording slightly.

| Level | Threshold | Fixture Scores | Spread |
| --- | --- | --- | --- |
| Level 1 | 50 | 89, 90, 91 | 2 |
| Level 2 | 60 | 88, 90, 91 | 3 |
| Level 3 | 70 | 89, 90, 91 | 2 |

All seeded acceptable prompts clear their level thresholds, and the within-level spread stays narrow.

## Findings

- the deterministic scorer is stable for contract and integration tests when prompts preserve the seeded keyword cues
- acceptable-match scores cluster in the high 80s and low 90s, which gives predictable pass/fail behavior for the seeded test set
- the current mock scorer is not a fairness-calibrated similarity system; it rewards explicit keyword overlap and prompt length much more than semantic paraphrase quality
- because of that, this evaluation is useful for regression detection, but it is not enough to validate whether the live OpenAI scorer will treat semantically different but visually acceptable matches consistently

## Technically Successful Low-Quality Or Off-Topic Outputs

The MVP rule is:

- if generation succeeds and scoring succeeds, the attempt is scored even when the output is weak, generic, or clearly off-topic
- these attempts consume a scored attempt because the provider path completed successfully
- they do not trigger automatic regeneration, provider retries, or manual overrides in MVP

Deterministic off-topic fixture results:

| Level | Threshold | Off-Topic Prompt | Score |
| --- | --- | --- | --- |
| Level 1 | 50 | `spaceship battle in deep space` | 35 |
| Level 2 | 60 | `quiet beach at sunrise` | 32 |
| Level 3 | 70 | `flat vector logo of a cat` | 35 |

These cases confirm the expected MVP behavior: a technically successful but irrelevant output should return a low score, fail the threshold check, surface normal retry guidance, and still count as a scored attempt.

## Decision

- keep the deterministic mock scorer as the stable default for tests and non-credentialed development flows
- treat live-score calibration as pending work that requires a curated target/generated image set and manual review of real multimodal scorer outputs

## Out Of Scope For This Task

- threshold tuning against live generated images
- player-facing score explainability beyond the aggregate percentage
