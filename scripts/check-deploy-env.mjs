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
    "PIXEL_PROMPT_GENERATED_OUTPUT_DIR",
    "required in staging/production until generated outputs move to the planned durable object store",
  );
}

const liveImageGenerationEnabled = readEnv("PIXEL_PROMPT_ENABLE_OPENAI_IMAGE_GENERATION") === "1";
const liveScoringEnabled = readEnv("PIXEL_PROMPT_ENABLE_OPENAI_SCORING") === "1";

if (liveImageGenerationEnabled || liveScoringEnabled) {
  requireEnv("OPENAI_API_KEY", "required whenever either live OpenAI provider path is enabled");
}

const anyBucketConfigured = ["S3_TARGET_ASSET_BUCKET", "S3_GENERATED_OUTPUT_BUCKET"].some(hasEnv);

if (anyBucketConfigured) {
  requireEnv("AWS_REGION", "required whenever S3 bucket names are configured");
}

if (requestedEnvironment === "preview" && !hasEnv("DATABASE_URL")) {
  warnings.push("DATABASE_URL is unset; preview will rely on the current in-memory/session-backed fallback.");
}

if (!liveImageGenerationEnabled || !liveScoringEnabled) {
  warnings.push("One or both live OpenAI provider flags are disabled; mock generation/scoring paths will remain active.");
}

const summaryLines = [
  `Deployment environment: ${requestedEnvironment}`,
  `Browser analytics: ${hasEnv("NEXT_PUBLIC_POSTHOG_TOKEN") ? "configured" : "disabled"}`,
  `Database: ${hasEnv("DATABASE_URL") ? "configured" : "not configured"}`,
  `Generated output storage: ${hasEnv("PIXEL_PROMPT_GENERATED_OUTPUT_DIR") ? "configured" : "not configured"}`,
  `Live image generation: ${liveImageGenerationEnabled ? "enabled" : "disabled"}`,
  `Live scoring: ${liveScoringEnabled ? "enabled" : "disabled"}`,
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
