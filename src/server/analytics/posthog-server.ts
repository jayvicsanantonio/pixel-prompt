import { PostHog } from "posthog-node";

import { getAnalyticsServerConfig } from "@/lib/analytics/config";
import type { AnalyticsEvent } from "@/lib/analytics/events";
import { toAnalyticsCaptureInput } from "@/lib/analytics/events";

export function createServerAnalyticsClient() {
  const config = getAnalyticsServerConfig();

  if (!config) {
    return null;
  }

  return new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
}

export async function captureServerAnalyticsEvent(event: AnalyticsEvent) {
  const client = createServerAnalyticsClient();

  if (!client) {
    return;
  }

  const payload = toAnalyticsCaptureInput(event);

  client.capture(payload);
  await client.shutdown();
}
