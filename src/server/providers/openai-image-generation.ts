import { buildGeneratedOutputAssetKey, persistGeneratedOutput } from "./generated-output-store";
import { createProviderAbortState } from "./abort";
import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderFailure,
  ProviderFailureKind,
  ProviderModelRef,
} from "./contracts";

const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;

interface OpenAiImageGenerationResponse {
  created?: number;
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string | null;
  }>;
}

interface OpenAiErrorResponse {
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  };
}

interface OpenAiImageGenerationProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function toIsoDateTime(created?: number) {
  if (typeof created !== "number") {
    return new Date().toISOString();
  }

  return new Date(created * 1000).toISOString();
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

function resolveFailureKind(response: Response, errorPayload?: OpenAiErrorResponse | null) {
  const code = errorPayload?.error?.code?.toLowerCase() ?? "";
  const type = errorPayload?.error?.type?.toLowerCase() ?? "";
  const message = errorPayload?.error?.message?.toLowerCase() ?? "";
  const details = `${code} ${type} ${message}`;

  if (response.status === 429) {
    return {
      kind: "rate_limited" as const,
      retryable: true,
    };
  }

  if (response.status === 408 || response.status === 504) {
    return {
      kind: "timeout" as const,
      retryable: true,
    };
  }

  if ((response.status === 400 || response.status === 403) && /(content|policy|safety|moderat)/.test(details)) {
    return {
      kind: "content_policy_rejection" as const,
      retryable: false,
    };
  }

  return {
    kind: "technical_failure" as const,
    retryable: response.status >= 500,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getOpenAiImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL;
}

export function hasOpenAiImageGenerationConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export class OpenAiImageGenerationProvider implements ImageGenerationProvider {
  readonly providerId = "openai";
  readonly modelRef: ProviderModelRef;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenAiImageGenerationProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to use the OpenAI image generation provider.");
    }

    this.apiKey = apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS;
    this.modelRef = {
      provider: this.providerId,
      model: options.model ?? getOpenAiImageModel(),
    };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (request.signal?.aborted) {
      return buildProviderFailure(
        "interrupted",
        "openai_generation_interrupted",
        "The generation request was interrupted before OpenAI returned an image.",
        true,
      );
    }

    let response: Response;
    const abortState = createProviderAbortState({
      requestSignal: request.signal,
      timeoutMs: this.timeoutMs,
      timeoutMessage: "OpenAI image generation timed out before returning an image.",
      interruptedMessage: "The generation request was interrupted before OpenAI returned an image.",
    });

    try {
      response = await this.fetchImpl(OPENAI_IMAGE_GENERATIONS_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelRef.model,
          prompt: request.prompt,
        }),
        signal: abortState.signal,
      });
    } catch (error) {
      const abortClassification = abortState.classifyError(error);

      if (abortClassification === "timeout") {
        return buildProviderFailure(
          "timeout",
          "openai_generation_timeout",
          "OpenAI image generation timed out before returning an image.",
          true,
        );
      }

      if (abortClassification === "interrupted") {
        return buildProviderFailure(
          "interrupted",
          "openai_generation_interrupted",
          "The generation request was interrupted before OpenAI returned an image.",
          true,
        );
      }

      return buildProviderFailure(
        "technical_failure",
        "openai_generation_request_failed",
        error instanceof Error ? error.message : "OpenAI image generation failed before a response was returned.",
        true,
      );
    } finally {
      abortState.cleanup();
    }

    if (!response.ok) {
      const errorPayload = await parseJsonResponse<OpenAiErrorResponse>(response);
      const resolvedFailure = resolveFailureKind(response, errorPayload);

      return buildProviderFailure(
        resolvedFailure.kind,
        errorPayload?.error?.code || `openai_http_${response.status}`,
        errorPayload?.error?.message || `OpenAI image generation failed with status ${response.status}.`,
        resolvedFailure.retryable,
      );
    }

    const payload = await parseJsonResponse<OpenAiImageGenerationResponse>(response);
    const firstImage = payload?.data?.[0];

    if (!firstImage?.b64_json) {
      return buildProviderFailure(
        "technical_failure",
        "openai_missing_image_data",
        "OpenAI returned a successful response without image data.",
        true,
      );
    }

    const assetKey = buildGeneratedOutputAssetKey({
      providerId: this.providerId,
      levelId: request.context.levelId,
      attemptId: request.context.attemptId,
    });

    try {
      await persistGeneratedOutput({
        assetKey,
        imageBase64: firstImage.b64_json,
      });
    } catch (error) {
      return buildProviderFailure(
        "technical_failure",
        "generated_output_persist_failed",
        error instanceof Error
          ? `Generated image could not be persisted at ${assetKey}: ${error.message}`
          : `Generated image could not be persisted at ${assetKey}.`,
        true,
      );
    }

    return {
      ok: true,
      assetKey,
      createdAt: toIsoDateTime(payload?.created),
      provider: this.modelRef,
      revisedPrompt: firstImage.revised_prompt ?? null,
    };
  }
}
