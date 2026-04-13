import "@/server/server-only";

import { SCORE_BREAKDOWN_DIMENSIONS, type AttemptScore } from "@/lib/game";

import { createProviderAbortState } from "./abort";
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

const DEFAULT_LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_LMSTUDIO_SCORING_MODEL = "google/gemma-4-26b-a4b";
const DEFAULT_LMSTUDIO_SCORING_TIMEOUT_MS = 60_000;

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

interface LmStudioScoringProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface LmStudioChatCompletionsPayload {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
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

interface ParsedJsonResponse<T> {
  failure?: ProviderFailure;
  payload: T | null;
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

function resolveFailureKind(status: number, payload?: LmStudioChatCompletionsPayload | null) {
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

async function parseJsonResponseWithAbortHandling<T>(input: {
  abortState: ReturnType<typeof createProviderAbortState>;
  interruptedCode: string;
  interruptedMessage: string;
  response: Response;
  timeoutCode: string;
  timeoutMessage: string;
}): Promise<ParsedJsonResponse<T>> {
  try {
    return {
      payload: (await input.response.json()) as T,
    };
  } catch (error) {
    const abortClassification = input.abortState.classifyError(error);

    if (abortClassification === "timeout") {
      return {
        failure: buildProviderFailure("timeout", input.timeoutCode, input.timeoutMessage, true),
        payload: null,
      };
    }

    if (abortClassification === "interrupted") {
      return {
        failure: buildProviderFailure("interrupted", input.interruptedCode, input.interruptedMessage, true),
        payload: null,
      };
    }

    return {
      payload: null,
    };
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeScorePayload(payload: ScoringResponsePayload, request: ImageScoringRequest, modelRef: ProviderModelRef): AttemptScore {
  const normalized = clampScore(payload.normalizedScore);
  const breakdown = Object.fromEntries(
    SCORE_BREAKDOWN_DIMENSIONS.map((dimension) => [dimension, clampScore(payload.breakdown[dimension] ?? normalized)]),
  ) as AttemptScore["breakdown"];

  return {
    raw: normalized / 100,
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
    "Return strict JSON that matches the provided schema.",
    `Target image description: ${request.targetImage.alt}`,
    `Player prompt: ${request.prompt}`,
  ].join("\n");
}

function extractResponseText(payload: LmStudioChatCompletionsPayload | null) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part.text === "string" && part.text.trim().length > 0) {
        return part.text;
      }
    }
  }

  return null;
}

export function getLmStudioBaseUrl() {
  return process.env.LMSTUDIO_BASE_URL?.trim() || DEFAULT_LMSTUDIO_BASE_URL;
}

export function getLmStudioScoringModel() {
  return process.env.LMSTUDIO_SCORING_MODEL?.trim() || DEFAULT_LMSTUDIO_SCORING_MODEL;
}

export class LmStudioImageScoringProvider implements ImageScoringProvider {
  readonly providerId = "lmstudio";
  readonly modelRef: ProviderModelRef;

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LmStudioScoringProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.LMSTUDIO_API_KEY?.trim() ?? null;
    this.baseUrl = (options.baseUrl ?? getLmStudioBaseUrl()).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_LMSTUDIO_SCORING_TIMEOUT_MS;
    this.modelRef = {
      provider: this.providerId,
      model: options.model ?? getLmStudioScoringModel(),
    };
  }

  async scoreImageMatch(request: ImageScoringRequest): Promise<ImageScoringResult> {
    if (request.signal?.aborted) {
      return buildProviderFailure(
        "interrupted",
        "lmstudio_scoring_interrupted",
        "The scoring request was interrupted before LM Studio returned a score.",
        true,
      );
    }

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

    const abortState = createProviderAbortState({
      requestSignal: request.signal,
      timeoutMs: this.timeoutMs,
      timeoutMessage: "LM Studio image scoring timed out before returning a score.",
      interruptedMessage: "The scoring request was interrupted before LM Studio returned a score.",
    });

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };

      if (this.apiKey) {
        headers.authorization = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelRef.model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: buildScoringPrompt(request),
                },
                {
                  type: "image_url",
                  image_url: {
                    url: toDataUrl(request.targetImage.assetKey, targetImage),
                  },
                },
                {
                  type: "image_url",
                  image_url: {
                    url: toDataUrl(request.generatedImageAssetKey, generatedImage),
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pixel_prompt_score",
              strict: true,
              schema: scoreSchema,
            },
          },
        }),
        signal: abortState.signal,
      });
      const { failure, payload } = await parseJsonResponseWithAbortHandling<LmStudioChatCompletionsPayload>({
        abortState,
        interruptedCode: "lmstudio_scoring_interrupted",
        interruptedMessage: "The scoring request was interrupted before LM Studio returned a score.",
        response,
        timeoutCode: "lmstudio_scoring_timeout",
        timeoutMessage: "LM Studio image scoring timed out before returning a score.",
      });

      if (failure) {
        return failure;
      }

      if (!response.ok) {
        const resolvedFailure = resolveFailureKind(response.status, payload);

        return buildProviderFailure(
          resolvedFailure.kind,
          payload?.error?.code || `lmstudio_http_${response.status}`,
          payload?.error?.message || `LM Studio image scoring failed with status ${response.status}.`,
          resolvedFailure.retryable,
        );
      }

      const outputText = extractResponseText(payload);

      if (!outputText) {
        return buildProviderFailure(
          "technical_failure",
          "lmstudio_scoring_missing_output",
          "LM Studio returned a scoring response without structured output text.",
          true,
        );
      }

      let parsedPayload: ScoringResponsePayload;

      try {
        parsedPayload = JSON.parse(outputText) as ScoringResponsePayload;
      } catch {
        return buildProviderFailure(
          "technical_failure",
          "lmstudio_scoring_invalid_json",
          "LM Studio returned a scoring response that was not valid JSON.",
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
    } catch (error) {
      const abortClassification = abortState.classifyError(error);

      if (abortClassification === "timeout") {
        return buildProviderFailure(
          "timeout",
          "lmstudio_scoring_timeout",
          "LM Studio image scoring timed out before returning a score.",
          true,
        );
      }

      if (abortClassification === "interrupted") {
        return buildProviderFailure(
          "interrupted",
          "lmstudio_scoring_interrupted",
          "The scoring request was interrupted before LM Studio returned a score.",
          true,
        );
      }

      return buildProviderFailure(
        "technical_failure",
        "lmstudio_scoring_request_failed",
        error instanceof Error ? error.message : "LM Studio image scoring failed before a response was returned.",
        true,
      );
    } finally {
      abortState.cleanup();
    }
  }
}
