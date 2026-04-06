import { PostHog } from "posthog-node";

import { getAnalyticsConfig } from "@/lib/analytics/config";
import type { AnalyticsEvent } from "@/lib/analytics/events";
import { toAnalyticsCaptureInput } from "@/lib/analytics/events";

export function createServerAnalyticsClient() {
  const config = getAnalyticsConfig();

  if (!config) {
    return null;
  }

  return new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
}

export async function captureServerAnalyticsEvents(events: AnalyticsEvent[]) {
  const client = createServerAnalyticsClient();

  if (!client || events.length === 0) {
    return;
  }

  for (const event of events) {
    const payload = toAnalyticsCaptureInput(event);

    client.capture(payload);
  }

  await client.shutdown();
}

export async function captureServerAnalyticsEvent(event: AnalyticsEvent) {
  await captureServerAnalyticsEvents([event]);
}
