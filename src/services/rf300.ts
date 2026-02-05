import { apiConfig, endpoints } from '../config/api';
import { Session } from '../storage/session';
import {
  BatchChunkState,
  QueuedBatch,
  clearQueueForOtherAccount,
  getQueuedBatches,
  removeBatch,
  updateBatch,
} from '../storage/batchQueue';
import { addUploadedBatch } from '../storage/history';
import { buildBillingRequestId, recordBillingLog } from './billingLog';
import { reportApiError } from './sentryReport';
import { sentryBridge } from '../native/sentry';

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

const buildPayload = (batch: QueuedBatch, epkIds: string[]) => ({
  node: batch.node,
  status: batch.mode === 'IN' ? 1 : 2,
  logi_id: batch.logisticId,
  techOrRepo_id: batch.vendorId,
  techOrRepo_branch_id: batch.vendorBranchId,
  order_number: batch.orderNumber ?? '',
  epk_array: epkIds,
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

const isNetworkFailureMessage = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('wifi網路連線異常') ||
    lower.includes('上傳逾時') ||
    lower.includes('timeout')
  );
};

const CHUNK_SIZE = 50;
const NETWORK_FAIL_LIMIT = 3;
const TOTAL_SYNC_TIMEOUT_MS = 3 * 60 * 1000;
const BATCH_SYNC_TIMEOUT_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const SYNC_BATCH_WINDOW = 10;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const buildChunkStates = (batch: QueuedBatch, chunkSize: number): BatchChunkState[] => {
  const total = Math.ceil(batch.epkIds.length / chunkSize);
  const existing = batch.chunkStates;
  if (existing && existing.length === total) {
    return existing;
  }
  const states: BatchChunkState[] = [];
  for (let i = 0; i < total; i += 1) {
    const start = i * chunkSize;
    const end = Math.min(batch.epkIds.length, start + chunkSize);
    states.push({ index: i, start, end, status: 'pending' });
  }
  return states;
};

export async function uploadBatch(batch: QueuedBatch, session: Session, chunk: BatchChunkState) {
  const epkIds = batch.epkIds.slice(chunk.start, chunk.end);
  const body = JSON.stringify(buildPayload(batch, epkIds));
  const startDateTime = new Date().toISOString();
  if (__DEV__) {
    console.log('[RF300] upload start', {
      batchNumber: batch.batchNumber,
      mode: batch.mode,
      epkCount: epkIds.length,
      chunkIndex: chunk.index,
    });
  }

  const response = await fetchWithTimeout(
    `${apiConfig.baseUrl}${endpoints.insert}`,
    {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body,
    },
    REQUEST_TIMEOUT_MS,
  );
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
    reportApiError('rf300:parse', 'parse failed', { status: response.status });
    throw new Error('上傳回應解析失敗');
  }

  if (!response.ok || !json.success) {
    reportApiError('rf300:response', json?.message || 'failed', { status: response.status });
    throw new Error(mapRf300Error(json?.message, response.status));
  }

  return {
    data: json.data,
    billingMeta: {
      requestId: buildBillingRequestId(`${batch.batchNumber}-chunk-${chunk.index}`),
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

export type SyncProgress = {
  done: number;
  total: number;
  batchNumber?: string;
};

let syncInFlight: Promise<SyncResult> | null = null;

export async function syncQueuedBatches(
  session: Session,
  options?: { mode?: 'IN' | 'OUT'; onProgress?: (progress: SyncProgress) => void },
): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
  await clearQueueForOtherAccount(session.user.account);
  const queue = await getQueuedBatches();
  const filtered = options?.mode ? queue.filter((item) => item.mode === options.mode) : queue;
  let synced = 0;
  let failed = 0;
  let error: string | null = null;
  const results: SyncResult['results'] = [];
  const onProgress = options?.onProgress;
  const totalBatches = filtered.length;
  let doneBatches = 0;
  let consecutiveNetworkFailures = 0;
  const syncStart = Date.now();

  if (onProgress) {
    onProgress({ done: doneBatches, total: totalBatches });
  }

  if (__DEV__) {
    console.log('[RF300] sync start', { count: filtered.length, mode: options?.mode });
  }

  for (let offset = 0; offset < filtered.length; offset += SYNC_BATCH_WINDOW) {
    const window = filtered.slice(offset, offset + SYNC_BATCH_WINDOW);
    for (const batch of window) {
      if (Date.now() - syncStart > TOTAL_SYNC_TIMEOUT_MS) {
        error = error || '同步逾時，已停止';
        if (__DEV__) {
          console.warn('[RF300] sync timeout', { durationMs: Date.now() - syncStart });
        }
        offset = filtered.length;
        break;
      }

      const chunkSize = batch.chunkSize ?? CHUNK_SIZE;
      let chunkStates = buildChunkStates(batch, chunkSize);
      let updatedBatch: QueuedBatch = { ...batch, chunkSize, chunkStates };

      if (!batch.chunkStates || batch.chunkStates.length !== chunkStates.length) {
        await updateBatch(updatedBatch);
      }

      let totalUndefined = 0;
      const failedEpkIds: string[] = [];
      let anyFailed = false;
      let anyPartial = false;
      let networkFailure = false;
      const batchStart = Date.now();

      for (const chunk of chunkStates) {
        if (chunk.status === 'success') continue;
        if (Date.now() - batchStart > BATCH_SYNC_TIMEOUT_MS) {
          anyFailed = true;
          chunk.status = 'failed';
          chunk.error = '批次同步逾時';
          chunk.lastTriedAt = Date.now();
          failedEpkIds.push(...updatedBatch.epkIds.slice(chunk.start, chunk.end));
          updatedBatch = { ...updatedBatch, chunkStates };
          await updateBatch(updatedBatch);
          break;
        }
        try {
          const { data, billingMeta } = await uploadBatch(updatedBatch, session, chunk);
          const undefinedCount = data?.undefined ?? 0;
          totalUndefined += undefinedCount;
          if (undefinedCount > 0) {
            anyPartial = true;
            chunk.status = 'partial';
            chunk.undefinedCount = undefinedCount;
            chunk.error = `有 ${undefinedCount} 筆包裝未登錄`;
            failedEpkIds.push(...updatedBatch.epkIds.slice(chunk.start, chunk.end));
          } else {
            chunk.status = 'success';
            chunk.undefinedCount = 0;
            chunk.error = undefined;
            await recordBillingLog(billingMeta);
          }
          chunk.lastTriedAt = Date.now();
        } catch (err) {
          const msg =
            err instanceof Error && err.name === 'AbortError'
              ? '上傳逾時'
              : err instanceof Error
                ? err.message
                : '上傳失敗';
          anyFailed = true;
          chunk.status = 'failed';
          chunk.error = msg;
          chunk.lastTriedAt = Date.now();
          failedEpkIds.push(...updatedBatch.epkIds.slice(chunk.start, chunk.end));
          if (isNetworkFailureMessage(msg)) {
            networkFailure = true;
            error = error || msg;
            consecutiveNetworkFailures += 1;
          } else {
            consecutiveNetworkFailures = 0;
          }
        }
        updatedBatch = { ...updatedBatch, chunkStates };
        await updateBatch(updatedBatch);
        if (networkFailure) break;
      }

      if (networkFailure) {
        failed += 1;
        results.push({
          id: updatedBatch.id,
          batchNumber: updatedBatch.batchNumber,
          status: 'failed',
          error: error || '上傳失敗',
          epkIds: failedEpkIds.length ? failedEpkIds : undefined,
        });
        doneBatches += 1;
        if (onProgress) {
          onProgress({ done: doneBatches, total: totalBatches, batchNumber: updatedBatch.batchNumber });
        }
        if (consecutiveNetworkFailures >= NETWORK_FAIL_LIMIT) {
          error = error || '網路連線異常次數過多，已停止同步';
          offset = filtered.length;
          break;
        }
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveNetworkFailures - 1), BACKOFF_MAX_MS);
        if (__DEV__) {
          console.warn('[RF300] network backoff', { delayMs: delay, failures: consecutiveNetworkFailures });
        }
        await sleep(delay);
        continue;
      }

      const allSuccess = chunkStates.every((chunk) => chunk.status === 'success');
      if (allSuccess) {
        await addUploadedBatch(updatedBatch, Date.now());
        await removeBatch(updatedBatch.id);
        synced += 1;
        results.push({ id: updatedBatch.id, batchNumber: updatedBatch.batchNumber, status: 'success' });
        continue;
      }

      failed += 1;
      const status: SyncResult['results'][number]['status'] = anyFailed ? 'failed' : 'partial';
      const errorMsg =
        (anyFailed && chunkStates.find((chunk) => chunk.status === 'failed')?.error) ||
        (anyPartial && totalUndefined > 0 ? `有 ${totalUndefined} 筆包裝未登錄` : '上傳失敗');

      results.push({
        id: updatedBatch.id,
        batchNumber: updatedBatch.batchNumber,
        status,
        error: errorMsg,
        undefinedCount: totalUndefined || undefined,
        epkIds: failedEpkIds.length ? failedEpkIds : undefined,
      });
      error = error || errorMsg;
      doneBatches += 1;
      if (onProgress) {
        onProgress({ done: doneBatches, total: totalBatches, batchNumber: updatedBatch.batchNumber });
      }
      consecutiveNetworkFailures = 0;
    }
  }

  if (__DEV__) {
    console.log('[RF300] sync done', {
      synced,
      failed,
      error,
      results,
      durationMs: Date.now() - syncStart,
      queueSize: filtered.length,
    });
  }

  const durationMs = Date.now() - syncStart;
  if (filtered.length > 0) {
    try {
      sentryBridge.captureMessage(
        `RF300:sync_duration ms=${durationMs} total=${filtered.length} synced=${synced} failed=${failed} mode=${options?.mode ?? 'all'} error=${error ?? 'none'}`,
        failed > 0 || error ? 'warning' : 'info',
      );
    } catch {
      // ignore metrics failures
    }
  }

  return { synced, failed, error, results };
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
