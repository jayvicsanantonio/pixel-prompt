import posthog from "posthog-js";

import { getAnalyticsClientConfig } from "@/lib/analytics";

const config = getAnalyticsClientConfig();

if (config) {
  posthog.init(config.token, {
    api_host: config.host,
    defaults: "2026-01-30",
  });
}
