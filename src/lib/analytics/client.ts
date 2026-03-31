"use client";

import posthog from "posthog-js";

import type { AnalyticsEvent } from "./events";
import { toAnalyticsCaptureInput } from "./events";

export function captureClientAnalyticsEvent(event: AnalyticsEvent) {
  const payload = toAnalyticsCaptureInput(event);

  posthog.capture(payload.event, {
    distinct_id: payload.distinctId,
    ...payload.properties,
  });
}
