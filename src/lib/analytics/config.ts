export interface AnalyticsConfig {
  token: string;
  host: string;
}

export function getAnalyticsConfig(): AnalyticsConfig | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    return null;
  }

  return {
    token,
    host,
  };
}
