import { sha256 } from 'js-sha256';
import { v5 as uuidv5 } from 'uuid';
import { Platform } from 'react-native';
import { BillingLog, enqueueBillingLog, getPendingBillingLogs, removeBillingLog } from '../storage/billingLogs';

const BILLING_BASE_URL = 'https://packageapi.scanique.tw';
const BILLING_ENABLED = true;
const BILLING_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJQYWNrYWdlQWdlLUZFIiwibmJmIjoxNzY2ODQ0NDcwLCJleHAiOjI1MzQwMjI3MjAwMCwiaWF0IjoxNzY2ODQ0NDcwLCJpc3MiOiJQYWNrQWdlU2VydmljZSJ9.KORf1m99Kz3tCNYJcTR2pJbL6kP-JhHrgC57YreM5VA';

const BILLING_NAMESPACE = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const DEVICE_ID =
  (Platform.constants as { Model?: string } | undefined)?.Model ||
  (Platform.constants as { model?: string } | undefined)?.model ||
  'unknown-device';

const BILLING_ENDPOINT = '/api/F001Log/AddLogRecord';

export type BillingMeta = {
  requestId: string;
  targetEndpoint: string;
  httpMethod: string;
  httpStatus: number;
  requestPayload: string;
  responsePayload: string;
  startDateTime: string;
  endDateTime: string;
};

export const buildBillingRequestId = (batchNumber: string) => uuidv5(batchNumber, BILLING_NAMESPACE);

const buildLog = (meta: BillingMeta): BillingLog => ({
  requestId: meta.requestId,
  deviceId: DEVICE_ID,
  targetEndpoint: meta.targetEndpoint,
  httpMethod: meta.httpMethod,
  httpStatus: meta.httpStatus,
  requestPayloadHash: sha256(meta.requestPayload),
  responsePayloadHash: sha256(meta.responsePayload),
  startDateTime: meta.startDateTime,
  endDateTime: meta.endDateTime,
  createdAt: Date.now(),
});

export async function sendBillingLog(meta: BillingMeta) {
  if (!BILLING_ENABLED) {
    if (__DEV__) {
      console.log('[Billing] disabled - skip send', { requestId: meta.requestId });
    }
    return;
  }
  const payload = buildLog(meta);
  const { createdAt, ...payloadBody } = payload;
  if (__DEV__) {
    console.log('[Billing] send start', { requestId: payload.requestId, httpStatus: payload.httpStatus });
  }
  const response = await fetch(`${BILLING_BASE_URL}${BILLING_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${BILLING_TOKEN}`,
    },
    body: JSON.stringify(payloadBody),
  });

  if (!response.ok) {
    const text = await response.text();
    if (__DEV__) {
      console.log('[Billing] send failed', { requestId: payload.requestId, status: response.status, body: text });
    }
    throw new Error(`billing status ${response.status}`);
  }

  const json = (await response.json()) as { ResultCode?: string };
  if (json?.ResultCode && json.ResultCode !== '0' && json.ResultCode !== 'OK') {
    if (__DEV__) {
      console.log('[Billing] send failed', { requestId: payload.requestId, result: json.ResultCode });
    }
    throw new Error(`billing result ${json.ResultCode}`);
  }
  if (__DEV__) {
    console.log('[Billing] send success', { requestId: payload.requestId });
  }
}

export async function recordBillingLog(meta: BillingMeta) {
  if (!BILLING_ENABLED) {
    if (__DEV__) {
      console.log('[Billing] disabled - skip record', { requestId: meta.requestId });
    }
    return;
  }
  try {
    await sendBillingLog(meta);
  } catch {
    await enqueueBillingLog(buildLog(meta));
    if (__DEV__) {
      console.log('[Billing] queued for retry', { requestId: meta.requestId });
    }
  }
}

export async function flushBillingLogs() {
  if (!BILLING_ENABLED) {
    if (__DEV__) {
      console.log('[Billing] disabled - skip retry');
    }
    return;
  }
  const pending = await getPendingBillingLogs();
  for (const log of pending) {
    try {
      if (__DEV__) {
        console.log('[Billing] retry start', { requestId: log.requestId });
      }
      const { createdAt, ...payloadBody } = log;
      const response = await fetch(`${BILLING_BASE_URL}${BILLING_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BILLING_TOKEN}`,
        },
        body: JSON.stringify(payloadBody),
      });
      if (!response.ok) {
        throw new Error(`billing status ${response.status}`);
      }
      await removeBillingLog(log.requestId);
      if (__DEV__) {
        console.log('[Billing] retry success', { requestId: log.requestId });
      }
    } catch {
      // keep for retry
      if (__DEV__) {
        console.log('[Billing] retry failed', { requestId: log.requestId });
      }
    }
  }
}
