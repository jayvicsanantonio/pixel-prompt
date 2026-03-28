# Product Requirements Document

## Product Name

Pixel Prompt

## Document Purpose

This document defines the initial product requirements for Pixel Prompt, a web-based game that teaches players how to write better image-generation prompts through short, repeatable visual matching challenges.

It is intended to guide:

- product scoping
- UX design
- technical architecture
- implementation planning
- early analytics and launch decisions

## Product Overview

Pixel Prompt is a level-based prompt-writing game. Each level presents a target AI-generated image. The player studies that image and writes a short prompt intended to recreate something visually similar. The system then generates an image from the player's prompt, compares the generated result to the target image, assigns a similarity score, and determines whether the player passed the level.

The product is educational first, but it should feel like a polished game rather than a tutorial. The player should quickly understand the challenge, feel motivated to retry, and gradually improve at identifying and describing the visual ingredients that make an image distinct.

The core learning model is observation plus iteration:

- observe the target carefully
- describe it precisely
- compare result against expectation
- revise with better specificity

## Goals

### Primary Goals

- Help beginners learn to write better image-generation prompts through practice.
- Train players to notice visual details beyond the main subject.
- Turn prompt writing into a short, clear, replayable gameplay loop.
- Provide feedback that helps players improve from one attempt to the next.
- Create a structure that can support many levels and content packs over time.

### Secondary Goals

- Build an experience that is fast to understand and easy to replay.
- Make the scoring loop feel fair, consistent, and motivating.
- Create enough product structure to support future progression systems, analytics, and content operations.

## Non-Goals

The initial product is not intended to:

- teach every advanced prompting technique from day one
- support every possible image-generation model or provider
- guarantee pixel-perfect image recreation
- become a general-purpose image editor
- support multiplayer, social, or marketplace features in MVP
- rely on long-form educational content or lessons to explain prompt writing
- optimize for expert prompt engineers before serving beginners

## Target Users / Personas

### Persona 1: Curious Beginner

Profile:

- new to image generation
- has seen generated images before but does not know how to prompt effectively
- wants fast feedback rather than reading theory

Needs:

- simple instructions
- low-pressure gameplay
- obvious feedback about what to improve

Success condition:

- learns to include more useful visual detail in prompts

### Persona 2: Creative Hobbyist

Profile:

- uses image generation casually for fun or personal projects
- can describe subjects but struggles with style, composition, and materials

Needs:

- repeatable practice
- useful hints without jargon overload
- a sense of progress over time

Success condition:

- becomes more deliberate and efficient in prompt writing

### Persona 3: Skill Builder

Profile:

- wants a lightweight daily exercise to sharpen image description skills
- motivated by levels, scores, and measurable improvement

Needs:

- replayability
- progression
- saved progress

Success condition:

- returns regularly and improves completion rate and prompt quality

## User Problems

- Beginners do not know which details matter most in an image prompt.
- Users often write prompts that name only a subject and omit medium, style, setting, composition, and texture.
- Many learning resources are abstract or passive instead of hands-on.
- Prompt writing can feel vague because users do not receive immediate, structured feedback.
- Users often do not know how to improve after a weak result.

## Product Value Proposition

Pixel Prompt teaches prompt writing by making it a playable skill. Instead of telling users what a good prompt looks like, it asks them to study an image, describe it under tight constraints, and learn through scored outcomes and guided retries.

Core value:

- practical learning through active repetition
- immediate feedback based on output quality
- beginner-friendly structure with low cognitive overhead
- strong replayability through short levels and escalating difficulty

## Product Principles

The product should be:

- educational
- approachable for beginners
- fun and game-like
- visually clear
- fast to understand
- replayable
- extensible for future levels and features

These principles should guide tradeoffs in UX, copy, scoring, and scope.

## Core Gameplay Loop

1. Player lands on the app and understands the game premise quickly.
2. Player starts a game or resumes previous progress.
3. Player enters a level and views the target image.
4. Player writes a short prompt within the character limit.
5. Player submits the prompt.
6. System generates an image from the prompt.
7. System compares the generated image against the target image.
8. System displays:
   - generated image
   - target image
   - similarity score
   - pass/fail outcome
   - improvement tips when needed
9. If the player passed, the next level unlocks.
10. If the player failed and attempts remain, the player retries.
11. If the player fails all attempts, the level ends and the player can retry later or restart the level.
12. After the final level, the player sees a summary of progress and performance.

## Core Gameplay Assumptions

The baseline product rules are:

- Prompt input is short, roughly capped at 120 characters.
- Each level has a score threshold the player must meet or exceed to pass.
- Early levels are easier and later levels are harder.
- The player gets up to 3 attempts per level.
- After each failed attempt, the system provides actionable prompt-writing tips.
- Tips should guide players to be more specific about:
  - medium
  - subject
  - context
  - style
  - materials
  - textures
  - shapes
  - composition
  - time period or artistic era when relevant

## Difficulty Progression

Initial difficulty progression:

- Level 1: 50% match required
- Level 2: 60% match required
- Level 3: 70% match required

Later levels should continue to increase difficulty through one or more of:

- higher score thresholds
- more visually complex target images
- more ambiguous subjects
- tighter margin for descriptive accuracy
- reduced tolerance for generic prompts

## Feature Requirements

### 1. Landing / Intro Experience

Requirements:

- Communicate the product in one screen or less.
- Explain the challenge clearly: study the image, write a prompt, match the image.
- Provide obvious entry points for:
  - start game
  - resume progress when available
- Set the tone as playful and skill-based, not academic or intimidating.

### 2. Game Start and Session Creation

Requirements:

- Start a new game session cleanly.
- Load first available level or last incomplete level.
- Establish session state for progress and attempts.

### 3. Active Level Experience

Requirements:

- Display target image prominently.
- Show level number and required score threshold.
- Show attempts remaining.
- Show prompt input with clear character count and submission affordance.
- Avoid clutter that distracts from image observation.

### 4. Prompt Input

Requirements:

- Support short free-text input.
- Enforce character limit in UI and backend validation.
- Prevent empty submission.
- Preserve typed prompt when validation errors occur.
- Optionally support keyboard-first input flow.

### 5. Image Generation

Requirements:

- On submit, send prompt to generation service.
- Show clear generating state with disabled duplicate submission.
- Handle generation errors gracefully.
- Persist prompt and generation metadata to attempt history.

### 6. Similarity Scoring

Requirements:

- Compare generated image and target image using a consistent scoring method.
- Return a normalized player-facing score.
- Use score to determine pass/fail based on level threshold.
- Store raw and normalized scoring data for future tuning.

### 7. Result and Feedback

Requirements:

- Show target image and generated image side by side or in another clear comparison layout.
- Display score prominently.
- Tell player whether they passed.
- If failed, provide actionable improvement tips for the next attempt.
- Tips should point toward missing visual detail categories rather than generic encouragement.

### 8. Retry Flow

Requirements:

- Allow up to 3 attempts per level.
- Decrement attempts only after a valid scored submission.
- Preserve level context between attempts.
- Update tips based on the previous attempt outcome.

### 9. Level Completion and Progression

Requirements:

- Unlock the next level after passing.
- Show clear success state and next action.
- Persist best score, completion status, and attempt data.

### 10. Failure After All Attempts

Requirements:

- Show a clear end-of-level failure state.
- Explain that the player can retry the level later.
- Surface the strongest attempt score and concise advice.
- Avoid making the failure state feel punitive.

### 11. Resume Progress

Requirements:

- Save current unlocked level and relevant session progress.
- Resume the player at the appropriate point on return.
- Handle partially completed levels without corrupting progress state.

### 12. Final Completion / Summary

Requirements:

- Provide a summary after the player completes the available level set.
- Show aggregate performance signals such as:
  - levels completed
  - attempts used
  - best scores
  - improvement trend
- Encourage replay or future content return.

### 13. Expandable Content Model

Requirements:

- Levels should be data-driven rather than hard-coded.
- The system should support adding new target images, thresholds, and tip rules without rewriting the core game loop.
- Content should scale to themed packs or difficulty tracks later.

## User Flows

### Flow 1: New Player Starts Game

1. User lands on the app.
2. User reads concise explanation of the game.
3. User clicks start game.
4. System creates or initializes progress state.
5. System opens Level 1.

### Flow 2: Player Completes a Level on First Attempt

1. Player studies target image.
2. Player writes prompt.
3. Player submits prompt.
4. System generates image and computes score.
5. Score meets threshold.
6. System shows success state.
7. Player continues to next level.

### Flow 3: Player Fails, Gets Tips, Then Passes

1. Player enters prompt.
2. System generates result and computes score below threshold.
3. System shows score, comparison, and targeted tips.
4. Player rewrites prompt.
5. System generates and scores second attempt.
6. Score meets threshold.
7. System unlocks next level.

### Flow 4: Player Fails All Attempts

1. Player uses attempt one and fails.
2. System gives tips.
3. Player uses attempt two and fails.
4. System gives refined tips.
5. Player uses final attempt and fails.
6. System shows level failure state with retry path.

### Flow 5: Returning Player Resumes Progress

1. User revisits the app.
2. System detects stored progress.
3. Landing state offers resume option.
4. User resumes.
5. System loads the latest appropriate game state or level.

### Flow 6: Player Completes Current Level Set

1. Player clears final available level.
2. System records completion.
3. System shows final summary state.
4. Player chooses replay, revisit levels, or exit.

## Product States

The product should explicitly account for the following major states.

### Landing / Intro State

Purpose:

- explain concept
- orient new users
- surface start or resume options

### Start Game State

Purpose:

- initialize session
- load level entry conditions

### Active Level State

Purpose:

- present target image and current level context
- allow focused observation

### Prompt Input State

Purpose:

- collect prompt
- show character limit
- validate input readiness

### Generating State

Purpose:

- indicate request in progress
- prevent duplicate submits
- maintain trust that the system is working

### Result / Scoring State

Purpose:

- show generated output
- show score and pass/fail result
- surface feedback

### Retry State

Purpose:

- preserve level context
- show attempts remaining
- help user revise prompt

### Success / Level Complete State

Purpose:

- reward progress
- show next step
- unlock next level

### Failure After All Attempts State

Purpose:

- close out failed run clearly
- avoid dead-end confusion
- offer replay or restart path

### Resume Progress State

Purpose:

- restore player to the right point quickly
- reduce friction on return sessions

### Final Completion / Summary State

Purpose:

- celebrate completion
- summarize learning and performance
- create replay motivation

## Scoring and Progression Rules

### Score Model

- Every valid attempt returns a normalized similarity score from 0 to 100.
- The player-facing score may also be displayed as a percentage for readability.
- Pass/fail is determined by whether score is greater than or equal to the level threshold.

### Threshold Rules

- Each level stores its own pass threshold.
- Thresholds should generally rise with level progression.
- Threshold tuning should remain content-specific if certain target images are inherently harder or easier.

### Attempt Rules

- Maximum of 3 scored attempts per level.
- Invalid submissions do not consume an attempt.
- Technical failures do not consume an attempt unless the attempt was actually scored and stored.

### Progression Rules

- Passing unlocks the next level.
- Failing all attempts does not erase previously unlocked levels.
- Resume state should preserve the highest unlocked level and relevant per-level results.
- Best score per level should be retained for analytics and future UX.

### Replay Rules

- Players may replay completed levels.
- Replay should not reduce unlocked progression.
- Future versions may support score improvement tracking on replay.

## Functional Requirements

### Gameplay and Session

- The system must allow a user to start a new game session.
- The system must allow a user to resume progress if saved state exists.
- The system must render a level with target image, level metadata, threshold, and attempts remaining.
- The system must validate prompt input before submission.
- The system must enforce the prompt character limit.

### Generation and Scoring

- The system must send a valid prompt to an image-generation service.
- The system must receive and store generated output metadata.
- The system must compare generated output to target image and return a normalized score.
- The system must determine pass/fail using level threshold logic.
- The system must recover gracefully if generation or scoring fails.

### Feedback

- The system must provide tips after failed attempts.
- The system should tailor tips based on missing or weak visual specificity.
- The system must show the player enough information to understand the result of each attempt.

### Persistence

- The system must persist user progress.
- The system must persist attempt history and scores.
- The system must restore progress accurately on resume.

### Content and Operations

- The system must support multiple levels.
- The system must allow new levels to be added through structured content configuration.
- The system should support content metadata such as category, difficulty, and theme for future use.

### Analytics

- The system must emit analytics events for major user and system actions.
- The system must track level starts, prompt submissions, scores, pass/fail outcomes, retries, and session completion.

## Non-Functional Requirements

### Usability

- The product should be understandable within the first visit without a tutorial wall.
- UI copy should be short and concrete.
- The gameplay screen should keep the target image and scoring context visually clear.

### Performance

- The UI should feel responsive even when model requests take time.
- Loading and transition states should reduce uncertainty during async operations.
- The app should minimize unnecessary waiting between attempts.

### Reliability

- Generation and scoring failures should fail visibly and recover cleanly.
- Progress data should not be corrupted by page refreshes or network interruptions.

### Accessibility

- The web app should support keyboard navigation.
- Color usage should preserve readable contrast.
- Important state changes should be conveyed through more than color alone.
- Instructions and feedback copy should be understandable by beginners.

### Security and Abuse Prevention

- The system should validate prompt input on the server.
- The system should protect generation and scoring endpoints from obvious abuse.
- The app should avoid exposing internal provider credentials to the client.

### Extensibility

- Content, thresholds, and tip rules should be modular and data-driven.
- Provider integrations should be abstracted behind interfaces to allow replacement later.

## Edge Cases

- Player submits an empty prompt.
- Player exceeds character limit.
- Player refreshes during generation.
- Generation succeeds but scoring fails.
- Scoring succeeds but generated asset cannot be displayed.
- Network interruption happens during submission.
- Player exits mid-level and later resumes.
- Stored progress references a level no longer available after content updates.
- A target image proves too difficult relative to its threshold.
- Similarity scoring returns inconsistent outputs for visually acceptable matches.
- Player writes a prompt that is technically valid but intentionally nonsensical.
- Player retries rapidly or double-submits.
- Service rate limits or provider timeouts occur.

## Analytics / Success Metrics

### Core Product Metrics

- landing-to-start conversion rate
- level start rate
- prompt submission rate
- attempt completion rate
- level pass rate by level
- retry rate by level
- level abandonment rate
- resume rate
- full run completion rate

### Learning and Quality Metrics

- average attempts to pass per level
- median best score by level
- score improvement from first attempt to best attempt
- percentage of players who improve after receiving tips
- prompt length distribution

### Operational Metrics

- generation success rate
- scoring success rate
- end-to-end attempt latency
- rate of technical failures per attempt

### Early Success Indicators

The MVP should be considered promising if:

- users can understand and start the game quickly
- most users complete at least one full attempt
- a meaningful share of users retry after failure rather than dropping immediately
- later attempts show measurable improvement over earlier attempts

## Future Enhancements

- daily challenge mode
- curated themed level packs
- personalized coaching based on mistake patterns
- richer breakdown scoring by category such as style or composition
- optional hint system with score tradeoffs
- replay comparison history across attempts
- player accounts with long-term performance tracking
- streaks, badges, or other light progression systems
- content management tools for internal level authoring
- adaptive difficulty tuning based on player skill
- classroom or workshop mode

## Open Questions / Assumptions

### Assumptions

- The app is web-first.
- The app will start with a small curated set of levels.
- One generation path and one scoring path are sufficient for MVP.
- Short prompts are important to keep the challenge focused and readable.
- Tips can initially be heuristic rather than fully model-generated.

### Open Questions

- Should target images be fully static per level, or can later versions rotate targets within a level pool?
- Should players see the target image during the entire attempt, or should some modes hide it after a short preview?
- How should similarity scoring be calibrated so it feels fair to players even when outputs differ stylistically?
- Should there be anonymous local progress only in MVP, or lightweight account support from the start?
- What should happen when a provider returns low-quality or off-topic generations for an otherwise reasonable prompt?
- How much scoring transparency should be shown to players in MVP versus later versions?
- Should level completion require exact threshold pass only, or should there be medal tiers later?
- What content authoring workflow will be used to create and tune new levels efficiently?

## Recommended MVP Decision Summary

To keep the first implementation grounded:

- build a single-player web app
- ship a small curated sequence of levels
- enforce the short prompt limit
- support 3 attempts per level
- use threshold-based pass/fail progression
- provide actionable retry tips
- save progress and allow resume
- instrument the full gameplay loop for analytics

This gives the team a clear, testable foundation before adding more modes, social features, or advanced coaching systems.
