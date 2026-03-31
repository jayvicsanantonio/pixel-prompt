# Phase 0 Task 2: Baseline AI Provider and Model Decisions

Status: completed on 2026-03-29

Verified against current official OpenAI docs on 2026-03-29.

Scope for this task:

- choose the baseline generation provider and model
- choose the baseline scoring provider and model

## Baseline Provider

- OpenAI for both image generation and image scoring

Why this fits:

- one provider keeps authentication, billing, SDK usage, and error handling simpler for the first playable loop
- the current OpenAI API surface supports both image generation and multimodal text output with image inputs
- this keeps Phase 0 focused on shipping one credible end-to-end path before adding adapter breadth

This is an implementation choice, not a claim that OpenAI is the only viable provider.

## Generation Baseline

- Model: `gpt-image-1.5`
- API surface: OpenAI Images API first, with the Responses API image-generation tool kept as a later option for conversational editing flows

Why this fits:

- OpenAI's image generation guide currently says `gpt-image-1.5` is the latest and most advanced model for image generation
- the same guide says `gpt-image-1.5` offers the best overall quality inside the GPT Image family
- Pixel Prompt's core loop depends on the generated image being credible enough that the similarity score feels fair

Source:

- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

## Scoring Baseline

- Model: `gpt-5.4 mini`
- API surface: OpenAI Responses API with both target and generated images supplied as inputs and a structured JSON score payload returned

Why this fits:

- OpenAI's model selection guide says to optimize for accuracy first and only then reduce cost and latency
- gameplay fairness depends more on score quality and consistency than on absolute lowest latency
- `gpt-5.4 mini` currently supports image input and structured outputs, which makes it a strong fit for returning a typed scoring payload
- `gpt-5.4 mini` is materially cheaper than full `gpt-5.4` while still being positioned as a high-volume mini model

Inference from the docs:

- OpenAI does not publish a Pixel Prompt-style "best model for image similarity scoring" recommendation
- the choice of `gpt-5.4 mini` is an inference based on the official guidance to start with accuracy, plus the model's image-input and structured-output support

Sources:

- [OpenAI GPT-5.4 mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [OpenAI model selection guide](https://developers.openai.com/api/docs/guides/model-selection)

## Operational Notes

- generated-image prompts and outputs are subject to OpenAI content policy filtering
- GPT Image models may require API organization verification before use
- the scoring model should return an aggregate normalized percentage plus internal scoring fields; only the aggregate percentage should be player-facing in MVP

## Fallback If Cost Or Throughput Forces A Downshift

- generation fallback: `gpt-image-1`
- scoring fallback: `gpt-5 mini`

These are fallback candidates, not the baseline. They should only be used after an evaluation set exists and shows that fairness remains acceptable.
