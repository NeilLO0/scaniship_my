import { apiConfig, endpoints } from '../config/api';
import { Session } from '../storage/session';
import { QueuedBatch, getQueuedBatches, removeBatch } from '../storage/batchQueue';

type Rf300Response = {
  success: boolean;
  message?: unknown;
};

const toMessage = (value: unknown, fallback: string) => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

const buildPayload = (batch: QueuedBatch) => ({
  node: batch.node,
  status: batch.mode === 'IN' ? 1 : 2,
  logi_id: batch.logisticId,
  techOrRepo_id: batch.vendorId,
  techOrRepo_branch_id: batch.vendorBranchId,
  order_number: batch.orderNumber ?? '',
  epk_array: batch.epkIds,
});

export async function uploadBatch(batch: QueuedBatch, session: Session) {
  const response = await fetch(`${apiConfig.baseUrl}${endpoints.insert}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(buildPayload(batch)),
  });

  let json: Rf300Response;
  try {
    json = (await response.json()) as Rf300Response;
  } catch {
    throw new Error('上傳回應解析失敗');
  }

  if (!response.ok || !json.success) {
    const message = toMessage(json?.message, `上傳失敗 (${response.status})`);
    throw new Error(message);
  }
}

export async function syncQueuedBatches(session: Session) {
  const queue = await getQueuedBatches();
  let synced = 0;
  let error: string | null = null;

  for (const batch of queue) {
    try {
      await uploadBatch(batch, session);
      await removeBatch(batch.id);
      synced += 1;
    } catch (err) {
      error = err instanceof Error ? err.message : '上傳失敗';
      break;
    }
  }

  return { synced, error };
}
