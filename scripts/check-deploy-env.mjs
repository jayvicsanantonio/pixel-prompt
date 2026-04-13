#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const requestedEnvironment = process.argv[2] ?? process.env.VERCEL_ENV ?? "preview";
const supportedEnvironments = new Set(["preview", "staging", "production"]);

if (!supportedEnvironments.has(requestedEnvironment)) {
  console.error(
    `Unsupported deployment environment "${requestedEnvironment}". Expected one of: ${[...supportedEnvironments].join(", ")}.`,
  );
  process.exit(1);
}

function readEnv(name) {
  const value = process.env[name];

  return typeof value === "string" ? value.trim() : "";
}

function hasEnv(name) {
  return readEnv(name).length > 0;
}

const errors = [];
const warnings = [];

function requireEnv(name, reason) {
  if (!hasEnv(name)) {
    errors.push(`${name}: ${reason}`);
  }
}

function requirePairedEnv(first, second, reason) {
  const firstPresent = hasEnv(first);
  const secondPresent = hasEnv(second);

  if (firstPresent !== secondPresent) {
    errors.push(`${first} and ${second}: ${reason}`);
  }
}

requirePairedEnv(
  "NEXT_PUBLIC_POSTHOG_TOKEN",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "set both values together or leave both unset so browser analytics is either fully configured or fully disabled",
);

if (requestedEnvironment === "staging" || requestedEnvironment === "production") {
  requireEnv("DATABASE_URL", "required for durable server-persisted progress outside preview");
  requireEnv(
    "BLOB_READ_WRITE_TOKEN",
    "required in staging/production for persisting generated images to Vercel Blob Storage",
  );
  requireEnv(
    "PIXEL_PROMPT_TARGET_ASSET_DIR",
    "required in staging/production until target assets move to the planned durable object store",
  );
}

const liveImageGenerationEnabled = readEnv("PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION") === "1";
const liveScoringEnabled = readEnv("PIXEL_PROMPT_ENABLE_OPENAI_SCORING") === "1";
const comfyUiGenerationEnabled = readEnv("PIXEL_PROMPT_ENABLE_COMFYUI_IMAGE_GENERATION") === "1";
const lmStudioScoringEnabled = readEnv("PIXEL_PROMPT_ENABLE_LMSTUDIO_SCORING") === "1";

if (requestedEnvironment === "preview" && (liveScoringEnabled || lmStudioScoringEnabled)) {
  requireEnv(
    "PIXEL_PROMPT_TARGET_ASSET_DIR",
    "required whenever a non-mock scoring path is enabled so the scorer can read target assets during preview requests",
  );
}

if (liveImageGenerationEnabled || liveScoringEnabled) {
  requireEnv("OPENAI_API_KEY", "required whenever either live OpenAI provider path is enabled");
}

if (comfyUiGenerationEnabled) {
  requireEnv("COMFYUI_WORKFLOW_PATH", "required whenever the ComfyUI generation path is enabled");
}

const anyBucketConfigured = ["S3_TARGET_ASSET_BUCKET", "S3_GENERATED_OUTPUT_BUCKET"].some(hasEnv);

if (anyBucketConfigured) {
  requireEnv("AWS_REGION", "required whenever S3 bucket names are configured");
}

if (requestedEnvironment === "preview" && !hasEnv("DATABASE_URL")) {
  warnings.push("DATABASE_URL is unset; preview will rely on the current in-memory/session-backed fallback.");
}

if (requestedEnvironment === "preview" && !hasEnv("BLOB_READ_WRITE_TOKEN") && !hasEnv("PIXEL_PROMPT_GENERATED_OUTPUT_DIR")) {
  warnings.push("BLOB_READ_WRITE_TOKEN and PIXEL_PROMPT_GENERATED_OUTPUT_DIR are unset; preview will use ephemeral temp storage for generated images (not persisted across deploys).");
}

if (!liveImageGenerationEnabled && !comfyUiGenerationEnabled) {
  warnings.push("No live image generation provider is enabled; mock image generation will remain active.");
}

if (!liveScoringEnabled && !lmStudioScoringEnabled) {
  warnings.push("No live scoring provider is enabled; mock scoring will remain active.");
}

const summaryLines = [
  `Deployment environment: ${requestedEnvironment}`,
  `Browser analytics: ${hasEnv("NEXT_PUBLIC_POSTHOG_TOKEN") ? "configured" : "disabled"}`,
  `Database: ${hasEnv("DATABASE_URL") ? "configured" : "not configured"}`,
  `Target asset storage: ${hasEnv("PIXEL_PROMPT_TARGET_ASSET_DIR") ? "configured" : "not configured"}`,
  `Generated output storage: ${hasEnv("BLOB_READ_WRITE_TOKEN") ? "vercel-blob" : hasEnv("PIXEL_PROMPT_GENERATED_OUTPUT_DIR") ? "local-filesystem" : "not configured"}`,
  `Live image generation: ${liveImageGenerationEnabled ? "enabled" : "disabled"}`,
  `Live scoring: ${liveScoringEnabled ? "enabled" : "disabled"}`,
  `ComfyUI image generation: ${comfyUiGenerationEnabled ? "enabled" : "disabled"}`,
  `LM Studio scoring: ${lmStudioScoringEnabled ? "enabled" : "disabled"}`,
];

for (const line of summaryLines) {
  console.log(line);
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  console.error("\nDeployment environment check failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("\nDeployment environment check passed.");
