import "@/server/server-only";

import { readFile } from "node:fs/promises";

import { createProviderAbortState } from "./abort";
import {
  buildGeneratedOutputAssetKey,
  type GeneratedImageFormat,
  persistGeneratedOutputBuffer,
} from "./generated-output-store";
import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderFailure,
  ProviderFailureKind,
  ProviderModelRef,
} from "./contracts";

const DEFAULT_COMFYUI_BASE_URL = "http://127.0.0.1:8188";
const DEFAULT_COMFYUI_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
const DEFAULT_COMFYUI_TIMEOUT_MS = 180_000;
const DEFAULT_COMFYUI_POLL_MS = 1_000;
const PROMPT_PLACEHOLDER = "{{PROMPT}}";
const SEED_PLACEHOLDER = "{{SEED}}";

interface ComfyUiImageGenerationProviderOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  model?: string;
  pollMs?: number;
  timeoutMs?: number;
  workflowPath?: string;
}

interface ComfyUiPromptResponse {
  error?: {
    message?: string;
  };
  node_errors?: unknown;
  prompt_id?: string;
}

interface ComfyUiHistoryResponse {
  [promptId: string]: {
    outputs?: Record<
      string,
      {
        images?: Array<{
          filename?: string;
          subfolder?: string;
          type?: string;
        }>;
      }
    >;
    status?: {
      completed?: boolean;
      messages?: unknown[];
      status_str?: string;
    };
  };
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

function toIsoDateTime() {
  return new Date().toISOString();
}

function hashStringToSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) || 1;
}

function replaceWorkflowPlaceholders(value: unknown, replacements: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    const exactReplacement = replacements[value];

    if (exactReplacement !== undefined) {
      return exactReplacement;
    }

    let nextValue = value;

    for (const [placeholder, replacement] of Object.entries(replacements)) {
      if (typeof replacement === "string" && nextValue.includes(placeholder)) {
        nextValue = nextValue.replaceAll(placeholder, replacement);
      }
    }

    return nextValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceWorkflowPlaceholders(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, replaceWorkflowPlaceholders(nestedValue, replacements)]),
    );
  }

  return value;
}

function inferFormat(input: { contentType?: string | null; filename?: string | null }): GeneratedImageFormat {
  const normalizedFilename = input.filename?.toLowerCase() ?? "";
  const normalizedContentType = input.contentType?.toLowerCase() ?? "";

  if (normalizedFilename.endsWith(".jpg") || normalizedFilename.endsWith(".jpeg") || normalizedContentType.includes("image/jpeg")) {
    return "jpeg";
  }

  if (normalizedFilename.endsWith(".webp") || normalizedContentType.includes("image/webp")) {
    return "webp";
  }

  return "png";
}

async function waitForMs(durationMs: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve();
    }, durationMs);

    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? Object.assign(new Error("aborted"), { name: "AbortError" }));
    };

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      signal.removeEventListener("abort", onAbort);
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function getFirstHistoryImage(entry: ComfyUiHistoryResponse[string] | undefined) {
  if (!entry?.outputs) {
    return null;
  }

  for (const output of Object.values(entry.outputs)) {
    for (const image of output.images ?? []) {
      if (image.filename) {
        return image;
      }
    }
  }

  return null;
}

function getHistoryEntry(payload: ComfyUiHistoryResponse, promptId: string) {
  return payload[promptId];
}

export function getComfyUiBaseUrl() {
  return process.env.COMFYUI_BASE_URL?.trim() || DEFAULT_COMFYUI_BASE_URL;
}

export function getComfyUiImageModel() {
  return process.env.COMFYUI_IMAGE_MODEL?.trim() || DEFAULT_COMFYUI_IMAGE_MODEL;
}

export function getComfyUiWorkflowPath() {
  return process.env.COMFYUI_WORKFLOW_PATH?.trim() || "";
}

export class ComfyUiImageGenerationProvider implements ImageGenerationProvider {
  readonly providerId = "comfyui";
  readonly modelRef: ProviderModelRef;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollMs: number;
  private readonly timeoutMs: number;
  private readonly workflowPath: string;

  constructor(options: ComfyUiImageGenerationProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getComfyUiBaseUrl()).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pollMs = options.pollMs ?? DEFAULT_COMFYUI_POLL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_COMFYUI_TIMEOUT_MS;
    this.workflowPath = options.workflowPath ?? getComfyUiWorkflowPath();

    if (!this.workflowPath) {
      throw new Error("COMFYUI_WORKFLOW_PATH is required to use the ComfyUI image generation provider.");
    }

    this.modelRef = {
      provider: this.providerId,
      model: options.model ?? getComfyUiImageModel(),
    };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (request.signal?.aborted) {
      return buildProviderFailure(
        "interrupted",
        "comfyui_generation_interrupted",
        "The generation request was interrupted before ComfyUI returned an image.",
        true,
      );
    }

    const abortState = createProviderAbortState({
      requestSignal: request.signal,
      timeoutMs: this.timeoutMs,
      timeoutMessage: "ComfyUI image generation timed out before returning an image.",
      interruptedMessage: "The generation request was interrupted before ComfyUI returned an image.",
    });

    try {
      const workflowSource = await readFile(this.workflowPath, "utf8");

      if (!workflowSource.includes(PROMPT_PLACEHOLDER)) {
        return buildProviderFailure(
          "technical_failure",
          "comfyui_workflow_missing_prompt_placeholder",
          `ComfyUI workflow "${this.workflowPath}" must contain the ${PROMPT_PLACEHOLDER} placeholder.`,
          false,
        );
      }

      const workflowTemplate = JSON.parse(workflowSource) as Record<string, unknown>;
      const seed = hashStringToSeed(
        `${request.context.runId}:${request.context.levelId}:${request.context.attemptId}:${request.context.attemptNumber}`,
      );
      const workflow = replaceWorkflowPlaceholders(workflowTemplate, {
        [PROMPT_PLACEHOLDER]: request.prompt,
        [SEED_PLACEHOLDER]: seed,
      });
      const promptResponse = await this.fetchImpl(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: workflow,
        }),
        signal: abortState.signal,
      });

      let promptPayload: ComfyUiPromptResponse | null = null;

      try {
        promptPayload = (await promptResponse.json()) as ComfyUiPromptResponse;
      } catch (error) {
        const abortClassification = abortState.classifyError(error);

        if (abortClassification === "timeout") {
          return buildProviderFailure(
            "timeout",
            "comfyui_generation_timeout",
            "ComfyUI image generation timed out before returning an image.",
            true,
          );
        }

        if (abortClassification === "interrupted") {
          return buildProviderFailure(
            "interrupted",
            "comfyui_generation_interrupted",
            "The generation request was interrupted before ComfyUI returned an image.",
            true,
          );
        }
      }

      if (!promptResponse.ok) {
        return buildProviderFailure(
          "technical_failure",
          `comfyui_http_${promptResponse.status}`,
          promptPayload?.error?.message || `ComfyUI rejected the workflow with status ${promptResponse.status}.`,
          promptResponse.status >= 500,
        );
      }

      if (!promptPayload?.prompt_id) {
        return buildProviderFailure(
          "technical_failure",
          "comfyui_missing_prompt_id",
          "ComfyUI accepted the request without returning a prompt_id.",
          true,
        );
      }

      const promptId = promptPayload.prompt_id;

      while (true) {
        const historyResponse = await this.fetchImpl(`${this.baseUrl}/history/${promptId}`, {
          signal: abortState.signal,
        });

        let historyPayload: ComfyUiHistoryResponse | null = null;

        try {
          historyPayload = (await historyResponse.json()) as ComfyUiHistoryResponse;
        } catch (error) {
          const abortClassification = abortState.classifyError(error);

          if (abortClassification === "timeout") {
            return buildProviderFailure(
              "timeout",
              "comfyui_generation_timeout",
              "ComfyUI image generation timed out before returning an image.",
              true,
            );
          }

          if (abortClassification === "interrupted") {
            return buildProviderFailure(
              "interrupted",
              "comfyui_generation_interrupted",
              "The generation request was interrupted before ComfyUI returned an image.",
              true,
            );
          }
        }

        if (!historyResponse.ok) {
          return buildProviderFailure(
            "technical_failure",
            `comfyui_history_http_${historyResponse.status}`,
            `ComfyUI history lookup failed with status ${historyResponse.status}.`,
            historyResponse.status >= 500,
          );
        }

        const historyEntry = historyPayload ? getHistoryEntry(historyPayload, promptId) : undefined;
        const outputImage = getFirstHistoryImage(historyEntry);

        if (outputImage?.filename) {
          const searchParams = new URLSearchParams({
            filename: outputImage.filename,
            type: outputImage.type || "output",
          });

          if (outputImage.subfolder) {
            searchParams.set("subfolder", outputImage.subfolder);
          }

          const imageResponse = await this.fetchImpl(`${this.baseUrl}/view?${searchParams.toString()}`, {
            signal: abortState.signal,
          });

          if (!imageResponse.ok) {
            return buildProviderFailure(
              "technical_failure",
              `comfyui_view_http_${imageResponse.status}`,
              `ComfyUI returned status ${imageResponse.status} while downloading the generated image.`,
              imageResponse.status >= 500,
            );
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const format = inferFormat({
            contentType: imageResponse.headers.get("content-type"),
            filename: outputImage.filename,
          });
          const assetKey = buildGeneratedOutputAssetKey({
            providerId: this.providerId,
            levelId: request.context.levelId,
            attemptId: request.context.attemptId,
            format,
          });

          try {
            await persistGeneratedOutputBuffer({
              assetKey,
              image: imageBuffer,
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
            createdAt: toIsoDateTime(),
            provider: this.modelRef,
            revisedPrompt: request.prompt,
            seed: String(seed),
          };
        }

        const status = historyEntry?.status?.status_str?.toLowerCase() ?? "";

        if (status.includes("error") || status.includes("failed")) {
          return buildProviderFailure(
            "technical_failure",
            "comfyui_generation_failed",
            `ComfyUI reported a failed workflow for prompt ${promptId}.`,
            true,
          );
        }

        await waitForMs(this.pollMs, abortState.signal);
      }
    } catch (error) {
      const abortClassification = abortState.classifyError(error);

      if (abortClassification === "timeout") {
        return buildProviderFailure(
          "timeout",
          "comfyui_generation_timeout",
          "ComfyUI image generation timed out before returning an image.",
          true,
        );
      }

      if (abortClassification === "interrupted") {
        return buildProviderFailure(
          "interrupted",
          "comfyui_generation_interrupted",
          "The generation request was interrupted before ComfyUI returned an image.",
          true,
        );
      }

      if (error instanceof SyntaxError) {
        return buildProviderFailure(
          "technical_failure",
          "comfyui_invalid_workflow_json",
          `ComfyUI workflow "${this.workflowPath}" is not valid JSON.`,
          false,
        );
      }

      return buildProviderFailure(
        "technical_failure",
        "comfyui_generation_request_failed",
        error instanceof Error ? error.message : "ComfyUI image generation failed before a response was returned.",
        true,
      );
    } finally {
      abortState.cleanup();
    }
  }
}
