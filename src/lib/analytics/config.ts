export interface AnalyticsClientConfig {
  token: string;
  host: string;
}

export interface AnalyticsServerConfig {
  token: string;
  host: string;
}

export function getAnalyticsClientConfig(): AnalyticsClientConfig | null {
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

export function getAnalyticsServerConfig(): AnalyticsServerConfig | null {
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
