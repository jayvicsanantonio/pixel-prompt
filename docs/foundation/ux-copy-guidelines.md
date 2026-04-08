# Phase 1 Agent 5 Task: UX Copy Guidelines

Status: completed on 2026-04-07

This document defines the MVP copy rules for landing, gameplay, retry, failure, and summary states. It is intended to guide the remaining Agent 5 copy tasks and to replace prototype-only wording in the current mocked UI.

## Voice Goals

- sound like a game coach, not a technical demo
- stay beginner-friendly and concrete
- keep the player focused on what to do next
- make failure feel recoverable instead of punitive
- explain only what the player can act on right now

## Core Rules

- Use short sentences and common words. Prefer "Write a better prompt" over "Increase prompt specificity."
- Name visible things. Say `image`, `prompt`, `score`, `attempt`, `retry`, and `level` instead of abstract terms.
- Keep one idea per sentence. Do not stack instruction, explanation, and product framing into the same line.
- Favor active verbs. `Study`, `write`, `compare`, `retry`, `restart`, and `replay` are stronger than passive phrasing.
- Make the next action obvious. Most state copy should answer one of three questions: `What happened?`, `What should I do now?`, or `What did I unlock?`
- Do not expose internal implementation details in player-facing copy.

## Words To Prefer

- `target image`
- `prompt`
- `match score`
- `pass score`
- `attempt`
- `retry`
- `restart level`
- `replay level`
- `summary`

## Words To Avoid In Shipping UI

- `mock`
- `slice`
- `provider`
- `async`
- `payload`
- `internal scoring`
- `asset pipeline`
- `player-facing`
- `seeded pack`
- `technical demo`

These words are acceptable in docs, tests, and temporary comments, but not in final UI copy.

## Length Guidelines

- Eyebrows: 1 to 3 words
- Headlines: 3 to 8 words
- Supporting body copy: 1 to 2 sentences, usually under 24 words each
- Helper text: 1 sentence
- CTA labels: 1 to 4 words
- Retry tips: title under 5 words, body under 22 words
- Failure and summary encouragement: 1 short sentence plus an action-oriented CTA

## State-Specific Guidance

### Landing

- Explain the game in one fast read.
- Lead with the challenge, not the product pitch.
- Do not front-load educational theory.
- Keep start and resume CTAs obvious and short.

Preferred pattern:

- headline: what the game asks the player to do
- support line: how the round works
- CTA: how to begin

### Active Level

- Focus on observation and prompt writing.
- Remind the player what details matter without listing too many categories at once.
- Validation copy should be direct and specific.
- Helper text should support the current action, not describe implementation.

### Generating

- Acknowledge the wait clearly.
- Reassure the player that the prompt was submitted.
- Avoid technical explanations about model calls or request state.

### Result

- Lead with score and pass/fail.
- Keep score language simple and percentage-based.
- Frame the comparison as useful feedback, not as judgment.
- Do not mention hidden scoring breakdowns.

### Retry

- Focus on the next improvement, not the miss.
- Point toward one or two visual dimensions to tighten.
- Emphasize that the player can revise instead of starting over.

### Failure

- Keep the tone calm and non-punitive.
- Preserve the player's sense of progress by referencing the strongest attempt.
- Always pair failure copy with a clear restart action.
- Avoid words like `wrong`, `bad`, `failed badly`, or `punishment`.

### Summary

- Celebrate completion without overstating mastery.
- Reflect progress with attempts, best scores, or improvement.
- Invite replay or future return in one sentence.
- Keep the ending open-ended and useful.

## Tip-Writing Rules

- Lead with a concrete action: `Name the medium`, `Anchor the setting`, `Tighten the composition`.
- Focus on visible image traits, not prompt-engineering jargon.
- Suggest what to add, not what the player did wrong.
- Keep each tip scoped to one visual dimension.
- Write tips so they still make sense after a weak but valid attempt.

## Failure And Encouragement Rules

- Use encouraging phrasing that still feels honest.
- Acknowledge near misses with specifics like `best score` or `one attempt left`.
- Invite action immediately after encouragement.

Preferred patterns:

- `Closest try: 64%. Tighten the setting and try again.`
- `You kept the best score. Restart the level when you're ready.`
- `You cleared every level. Replay one to push the score higher.`

Avoid patterns:

- `This slice will handle the retry path next.`
- `Internal scoring details remain hidden.`
- `The mock state establishes the handoff.`

## Current Prototype Copy To Replace

The current mocked UI in `src/components/landing/landing-screen.tsx` and `src/components/game/active-level-screen.tsx` still includes prototype-only language. The next copy pass should replace lines that talk about:

- mocked states
- future provider wiring
- internal scoring visibility
- implementation slices
- asset pipelines

## Review Checklist

- Can a beginner understand the line on first read?
- Does the line describe a visible action or outcome?
- Could the line be cut by 20 percent without losing meaning?
- Does the line avoid implementation language?
- Does failure copy preserve motivation without sounding sugary or vague?
