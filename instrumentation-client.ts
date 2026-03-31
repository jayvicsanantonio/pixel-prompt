import posthog from "posthog-js";

import { getAnalyticsConfig } from "@/lib/analytics";

const config = getAnalyticsConfig();

if (config) {
  posthog.init(config.token, {
    api_host: config.host,
    defaults: "2026-01-30",
  });
}
