import type { AttemptFailureKind, AttemptId, AttemptScore, GameRunId, IsoDateTime, Level, LevelId } from "@/lib/game";

export type ProviderFailureKind = AttemptFailureKind;

export interface ProviderModelRef {
  provider: string;
  model: string;
  version?: string;
}

export interface ProviderAttemptContext {
  runId: GameRunId;
  levelId: LevelId;
  attemptId: AttemptId;
  attemptNumber: number;
}

export interface ProviderFailure {
  ok: false;
  kind: ProviderFailureKind;
  code: string;
  message: string;
  retryable: boolean;
  consumeAttempt: false;
}

export interface ImageGenerationRequest {
  prompt: string;
  context: ProviderAttemptContext;
  signal?: AbortSignal;
}

export interface ImageGenerationSuccess {
  ok: true;
  assetKey: string;
  createdAt: IsoDateTime;
  provider: ProviderModelRef;
  seed?: string | null;
  revisedPrompt?: string | null;
}

export type ImageGenerationResult = ImageGenerationSuccess | ProviderFailure;

export interface ImageScoringRequest {
  prompt: string;
  generatedImageAssetKey: string;
  targetImage: Level["targetImage"];
  threshold: Level["threshold"];
  context: ProviderAttemptContext;
  signal?: AbortSignal;
}

export interface ImageScoringSuccess {
  ok: true;
  createdAt: IsoDateTime;
  provider: ProviderModelRef;
  score: AttemptScore;
  reasoning?: string;
}

export type ImageScoringResult = ImageScoringSuccess | ProviderFailure;

export interface ImageGenerationProvider {
  readonly providerId: string;
  readonly modelRef: ProviderModelRef;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface ImageScoringProvider {
  readonly providerId: string;
  readonly modelRef: ProviderModelRef;
  scoreImageMatch(request: ImageScoringRequest): Promise<ImageScoringResult>;
}
