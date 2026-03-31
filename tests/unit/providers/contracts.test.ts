import { describe, expect, it } from "vitest";

import type {
  ImageGenerationResult,
  ImageScoringResult,
  ProviderFailure,
  ProviderFailureKind,
} from "@/server/providers";

const failureKinds: ProviderFailureKind[] = [
  "content_policy_rejection",
  "rate_limited",
  "timeout",
  "interrupted",
  "technical_failure",
  "asset_unavailable",
];

describe("provider contracts", () => {
  it("keeps all provider failures non-consuming", () => {
    const failure: ProviderFailure = {
      ok: false,
      kind: "timeout",
      code: "timeout",
      message: "The provider did not return in time.",
      retryable: true,
      consumeAttempt: false,
    };

    expect(failure.consumeAttempt).toBe(false);
  });

  it("enumerates the failure taxonomy expected by gameplay recovery", () => {
    expect(failureKinds).toEqual([
      "content_policy_rejection",
      "rate_limited",
      "timeout",
      "interrupted",
      "technical_failure",
      "asset_unavailable",
    ]);
  });

  it("allows both success and failure results for generation and scoring adapters", () => {
    const generationResult: ImageGenerationResult = {
      ok: false,
      kind: "technical_failure",
      code: "provider_error",
      message: "The image provider returned an unexpected response.",
      retryable: true,
      consumeAttempt: false,
    };

    const scoringResult: ImageScoringResult = {
      ok: false,
      kind: "asset_unavailable",
      code: "missing_image",
      message: "The generated asset could not be loaded for scoring.",
      retryable: true,
      consumeAttempt: false,
    };

    expect(generationResult.ok).toBe(false);
    expect(scoringResult.ok).toBe(false);
  });
});
