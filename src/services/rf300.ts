import { apiConfig, endpoints } from '../config/api';
import { Session } from '../storage/session';
import { QueuedBatch, clearQueueForOtherAccount, getQueuedBatches, removeBatch } from '../storage/batchQueue';
import { addUploadedBatch } from '../storage/history';
import { buildBillingRequestId, recordBillingLog } from './billingLog';

type Rf300Response = {
  success: boolean;
  message?: unknown;
  data?: {
    total?: number;
    success?: number;
    repeat?: number;
    undefined?: number;
  };
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

const mapRf300Error = (raw: unknown, status: number) => {
  const normalized = toMessage(raw, '');
  const lower = normalized.toLowerCase();

  if (lower.includes('network request failed')) return 'wifi網路連線異常';
  if (lower.includes('500')) return '超過單批 500 筆，請拆分再傳';
  if (lower.includes('order_number does not exist')) return '訂單編號不存在，請確認後再試';
  if (lower.includes('order_number is required')) return '出庫時訂單編號為必填，請輸入訂單編號';
  if (lower.includes('logi_id must be 0')) return '節點或分點資料有誤，請重新選擇';
  if (lower.includes('repository does not exist')) return '倉庫/廠區不存在，請重新選擇';
  if (lower.includes('status error')) return '入庫/出庫狀態有誤，請重新選擇';
  if (lower.includes('logistic branch does not exist')) return '物流分點不存在，請重新選擇';
  if (lower.includes('epk_id does not exist')) return '部分包裝編號不存在，請確認後再試';
  if (lower.includes('must be')) return '欄位格式錯誤，請檢查輸入內容';
  if (normalized) return normalized;
  return `上傳失敗 (${status})`;
};

export async function uploadBatch(batch: QueuedBatch, session: Session) {
  const body = JSON.stringify(buildPayload(batch));
  const startDateTime = new Date().toISOString();
  if (__DEV__) {
    console.log('[RF300] upload start', {
      batchNumber: batch.batchNumber,
      mode: batch.mode,
      epkCount: batch.epkIds.length,
    });
  }

  const response = await fetch(`${apiConfig.baseUrl}${endpoints.insert}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body,
  });
  const endDateTime = new Date().toISOString();

  let json: Rf300Response;
  try {
    json = (await response.json()) as Rf300Response;
    if (__DEV__) {
      console.log('[RF300] upload response', {
        status: response.status,
        success: json?.success,
        message: json?.message,
        data: json?.data,
      });
    }
  } catch {
    throw new Error('上傳回應解析失敗');
  }

  if (!response.ok || !json.success) {
    throw new Error(mapRf300Error(json?.message, response.status));
  }

  return {
    data: json.data,
    billingMeta: {
      requestId: buildBillingRequestId(batch.batchNumber),
      targetEndpoint: endpoints.insert,
      httpMethod: 'POST',
      httpStatus: response.status,
      requestPayload: body,
      responsePayload: JSON.stringify(json ?? {}),
      startDateTime,
      endDateTime,
    },
  };
}

export type SyncResult = {
  synced: number;
  failed: number;
  error: string | null;
  results: {
    id: string;
    batchNumber: string;
    status: 'success' | 'failed' | 'partial';
    error?: string;
    undefinedCount?: number;
    epkIds?: string[];
  }[];
};

export async function syncQueuedBatches(
  session: Session,
  options?: { mode?: 'IN' | 'OUT' },
): Promise<SyncResult> {
  await clearQueueForOtherAccount(session.user.account);
  const queue = await getQueuedBatches();
  const filtered = options?.mode ? queue.filter((item) => item.mode === options.mode) : queue;
  let synced = 0;
  let failed = 0;
  let error: string | null = null;
  const results: SyncResult['results'] = [];

  if (__DEV__) {
    console.log('[RF300] sync start', { count: filtered.length, mode: options?.mode });
  }

  for (const batch of filtered) {
    try {
      const { data, billingMeta } = await uploadBatch(batch, session);
      const undefinedCount = data?.undefined ?? 0;
      if (undefinedCount > 0) {
        failed += 1;
        results.push({
          id: batch.id,
          batchNumber: batch.batchNumber,
          status: 'partial',
          undefinedCount,
          error: `有 ${undefinedCount} 筆包裝未登錄`,
          epkIds: batch.epkIds,
        });
        error = error || `有 ${undefinedCount} 筆包裝未登錄`;
        // keep batch for retry
      } else {
        await addUploadedBatch(batch, Date.now());
        await recordBillingLog(billingMeta);
        await removeBatch(batch.id);
        synced += 1;
        results.push({ id: batch.id, batchNumber: batch.batchNumber, status: 'success' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上傳失敗';
      failed += 1;
      error = error || msg;
      results.push({ id: batch.id, batchNumber: batch.batchNumber, status: 'failed', error: msg, epkIds: batch.epkIds });
      // keep batch in queue; continue to next
    }
  }

  if (__DEV__) {
    console.log('[RF300] sync done', { synced, failed, error, results });
  }

  return { synced, failed, error, results };
}
