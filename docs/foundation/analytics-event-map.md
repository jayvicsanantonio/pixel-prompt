# Phase 0 Task 12: Analytics Event Schema and PRD Metric Mapping

Status: completed on 2026-03-29

The typed event dictionary lives in `src/lib/analytics/events.ts`. This document maps those events to the PRD and `TASKS.md` metrics.

## Event Dictionary

- `landing_viewed`: first-page exposure for funnel entry
- `game_started`: player starts a new run or resumes an existing one
- `resume_offered`: app detects resumable progress
- `resume_started`: player accepts resume
- `level_started`: active play begins for a level
- `prompt_validation_failed`: blocked invalid submission without consuming an attempt
- `prompt_submitted`: valid submission enters backend processing
- `generation_completed`: provider generation attempt finishes with success or structured failure
- `scoring_completed`: scoring attempt finishes with success or structured failure
- `attempt_resolved`: scored attempt is finalized for gameplay
- `level_completed`: level ends in pass or failure
- `level_restarted`: failed level gets a fresh attempt cycle
- `run_completed`: player clears the MVP run

## Metric Mapping

- Landing-to-start conversion:
  `game_started / landing_viewed`
- Level start rate:
  `level_started / game_started`
- Prompt submission rate:
  `prompt_submitted / level_started`
- Attempt completion rate:
  `attempt_resolved / prompt_submitted`
- Pass rate by level:
  `level_completed` filtered to `outcome=passed`, grouped by `levelId`
- Retry rate by level:
  `attempt_resolved` filtered to `attemptNumber > 1`, grouped by `levelId`
- Abandonment rate:
  inferred from users who emit an upstream event without a downstream continuation event inside the analysis window
- Resume rate:
  `resume_started / resume_offered`
- Full-run completion rate:
  `run_completed / game_started`
- Average attempts to pass:
  mean `attemptsUsed` on `level_completed` where `outcome=passed`
- Median best score by level:
  median `bestScore` on `level_completed`, grouped by `levelId`
- Score improvement from first attempt to best attempt:
  derived from `attempt_resolved.score` ordered by `attemptNumber`, grouped by `runId + levelId`
- Percentage of players who improve after tips:
  players with `attempt_resolved.tipsShown=true` followed by a later higher `attempt_resolved.score`
- Prompt length distribution:
  histogram of `prompt_submitted.promptLength`
- Generation success rate:
  successful `generation_completed / generation_completed`
- Scoring success rate:
  successful `scoring_completed / scoring_completed`
- End-to-end attempt latency:
  `attempt_resolved.totalDurationMs`
- Technical failure rate per attempt:
  failed `generation_completed` and `scoring_completed`, grouped by `failureKind`

## Design Notes

- Abandonment is intentionally inferred rather than emitted as a client event, because explicit "abandon" signals are unreliable in browser sessions.
- Generation and scoring are broken into separate operational events so provider failures and latency regressions can be isolated.
- `attempt_resolved` is the gameplay source of truth for score, pass/fail outcome, attempts remaining, and tips-shown analysis.
- Landing and entry-funnel events are emitted from the real UI surfaces:
  - `LandingScreen` captures `landing_viewed`, `resume_offered`, `game_started`, and `resume_started`
  - `ActiveLevelScreen` captures `level_started` and `level_restarted`
- Attempt, provider, and completion events remain server-captured so scored results and failure taxonomy stay authoritative.
