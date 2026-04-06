import { SCORE_BREAKDOWN_DIMENSIONS, type AttemptScore } from "@/lib/game";

import { readGeneratedOutput } from "./generated-output-store";
import { readTargetAsset } from "./target-asset-store";
import type {
  ImageScoringProvider,
  ImageScoringRequest,
  ImageScoringResult,
  ProviderFailure,
  ProviderFailureKind,
  ProviderModelRef,
} from "./contracts";

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_SCORING_MODEL = "gpt-5.4-mini";
const DEFAULT_OPENAI_SCORING_TIMEOUT_MS = 60_000;

const scoreSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    normalizedScore: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },
    reasoning: {
      type: "string",
      minLength: 1,
    },
    breakdown: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        SCORE_BREAKDOWN_DIMENSIONS.map((dimension) => [
          dimension,
          {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
        ]),
      ),
      required: [...SCORE_BREAKDOWN_DIMENSIONS],
    },
  },
  required: ["normalizedScore", "reasoning", "breakdown"],
} as const;

interface OpenAiScoringProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface OpenAiResponsesPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  };
}

interface ScoringResponsePayload {
  normalizedScore: number;
  reasoning: string;
  breakdown: Record<(typeof SCORE_BREAKDOWN_DIMENSIONS)[number], number>;
}

function getAbortSignal(timeoutMs: number) {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function buildProviderFailure(
  kind: ProviderFailureKind,
  code: string,
  message: string,
  retryable: boolean,
): ProviderFailure {
  return {
    ok: false,
    kind,
    code,
    message,
    retryable,
    consumeAttempt: false,
  };
}

function resolveFailureKind(status: number, payload?: OpenAiResponsesPayload | null) {
  const code = payload?.error?.code?.toLowerCase() ?? "";
  const type = payload?.error?.type?.toLowerCase() ?? "";
  const message = payload?.error?.message?.toLowerCase() ?? "";
  const details = `${code} ${type} ${message}`;

  if (status === 429) {
    return {
      kind: "rate_limited" as const,
      retryable: true,
    };
  }

  if (status === 408 || status === 504) {
    return {
      kind: "timeout" as const,
      retryable: true,
    };
  }

  if ((status === 400 || status === 403) && /(content|policy|safety|moderat)/.test(details)) {
    return {
      kind: "content_policy_rejection" as const,
      retryable: false,
    };
  }

  return {
    kind: "technical_failure" as const,
    retryable: status >= 500,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getMimeType(assetKey: string) {
  const normalizedKey = assetKey.toLowerCase();

  if (normalizedKey.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedKey.endsWith(".jpg") || normalizedKey.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalizedKey.endsWith(".webp")) {
    return "image/webp";
  }

  return "application/octet-stream";
}

function toDataUrl(assetKey: string, file: Buffer) {
  return `data:${getMimeType(assetKey)};base64,${file.toString("base64")}`;
}

function extractOutputText(payload: OpenAiResponsesPayload | null) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  for (const item of payload?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim().length > 0) {
        return content.text;
      }
    }
  }

  return null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeScorePayload(payload: ScoringResponsePayload, request: ImageScoringRequest, modelRef: ProviderModelRef): AttemptScore {
  const normalized = clampScore(payload.normalizedScore);
  const breakdown = Object.fromEntries(
    SCORE_BREAKDOWN_DIMENSIONS.map((dimension) => [dimension, clampScore(payload.breakdown[dimension] ?? normalized)]),
  ) as AttemptScore["breakdown"];

  return {
    raw: Number((normalized / 100).toFixed(6)),
    normalized,
    threshold: request.threshold,
    passed: normalized >= request.threshold,
    breakdown,
    scorer: {
      provider: modelRef.provider,
      model: modelRef.model,
    },
  };
}

function buildScoringPrompt(request: ImageScoringRequest) {
  return [
    "Score how visually similar the generated image is to the target image for the Pixel Prompt game.",
    "The first image is the target. The second image is the generated attempt.",
    "Base the score on visual similarity only, not on whether the prompt itself sounds good.",
    "Use the full 0-100 range. A 100 is nearly indistinguishable. A 70 is a strong match with visible drift. A 50 is a partial match. A 0 is unrelated.",
    `Target image description: ${request.targetImage.alt}`,
    `Player prompt: ${request.prompt}`,
  ].join("\n");
}

export function getOpenAiScoringModel() {
  return process.env.OPENAI_SCORING_MODEL?.trim() || DEFAULT_OPENAI_SCORING_MODEL;
}

export function hasOpenAiScoringConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export class OpenAiImageScoringProvider implements ImageScoringProvider {
  readonly providerId = "openai";
  readonly modelRef: ProviderModelRef;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenAiScoringProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to use the OpenAI image scoring provider.");
    }

    this.apiKey = apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_SCORING_TIMEOUT_MS;
    this.modelRef = {
      provider: this.providerId,
      model: options.model ?? getOpenAiScoringModel(),
    };
  }

  async scoreImageMatch(request: ImageScoringRequest): Promise<ImageScoringResult> {
    let generatedImage: Buffer;
    let targetImage: Buffer;

    try {
      [generatedImage, targetImage] = await Promise.all([
        readGeneratedOutput(request.generatedImageAssetKey),
        readTargetAsset(request.targetImage.assetKey),
      ]);
    } catch (error) {
      return buildProviderFailure(
        "asset_unavailable",
        "scoring_asset_unavailable",
        error instanceof Error ? error.message : "A scoring asset could not be loaded.",
        true,
      );
    }

    let response: Response;

    try {
      response = await this.fetchImpl(OPENAI_RESPONSES_API_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelRef.model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildScoringPrompt(request),
                },
                {
                  type: "input_image",
                  image_url: toDataUrl(request.targetImage.assetKey, targetImage),
                  detail: "high",
                },
                {
                  type: "input_image",
                  image_url: toDataUrl(request.generatedImageAssetKey, generatedImage),
                  detail: "high",
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "pixel_prompt_score",
              strict: true,
              schema: scoreSchema,
            },
          },
        }),
        signal: getAbortSignal(this.timeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        return buildProviderFailure(
          "timeout",
          "openai_scoring_timeout",
          "OpenAI image scoring timed out before returning a score.",
          true,
        );
      }

      return buildProviderFailure(
        "technical_failure",
        "openai_scoring_request_failed",
        error instanceof Error ? error.message : "OpenAI image scoring failed before a response was returned.",
        true,
      );
    }

    const payload = await parseJsonResponse<OpenAiResponsesPayload>(response);

    if (!response.ok) {
      const resolvedFailure = resolveFailureKind(response.status, payload);

      return buildProviderFailure(
        resolvedFailure.kind,
        payload?.error?.code || `openai_http_${response.status}`,
        payload?.error?.message || `OpenAI image scoring failed with status ${response.status}.`,
        resolvedFailure.retryable,
      );
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      return buildProviderFailure(
        "technical_failure",
        "openai_scoring_missing_output",
        "OpenAI returned a scoring response without structured output text.",
        true,
      );
    }

    let parsedPayload: ScoringResponsePayload;

    try {
      parsedPayload = JSON.parse(outputText) as ScoringResponsePayload;
    } catch {
      return buildProviderFailure(
        "technical_failure",
        "openai_scoring_invalid_json",
        "OpenAI returned a scoring response that was not valid JSON.",
        true,
      );
    }

    return {
      ok: true,
      createdAt: new Date().toISOString(),
      provider: this.modelRef,
      score: normalizeScorePayload(parsedPayload, request, this.modelRef),
      reasoning: parsedPayload.reasoning,
    };
  }
}
