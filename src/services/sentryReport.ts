import { sentryBridge } from '../native/sentry';

type Extra = Record<string, string | number | boolean | null | undefined>;

const buildExtra = (extra?: Extra) => {
  if (!extra) return '';
  const pairs = Object.entries(extra)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return pairs.length ? ` | ${pairs.join(' ')}` : '';
};

export const reportApiError = (context: string, error: unknown, extra?: Extra) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
  const payload = `API_ERROR ${context}: ${message}${buildExtra(extra)}`;
  sentryBridge.captureMessage(payload, 'error');
};
