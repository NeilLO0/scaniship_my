import { apiConfig, endpoints } from '../config/api';
import { Session } from '../storage/session';
import { QueuedBatch, clearQueueForOtherAccount, getQueuedBatches, removeBatch } from '../storage/batchQueue';
import { addUploadedBatch } from '../storage/history';

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

const mapRf300Error = (raw: unknown, status: number) => {
  const normalized = toMessage(raw, '');
  const lower = normalized.toLowerCase();
  if (lower.includes('500')) return '超過單批 500 筆上限，請分批上傳';
  if (lower.includes('order_number does not exist')) return '訂單編號不存在，請確認後再試';
  if (lower.includes('order_number is required')) return '出庫時訂單編號為必填，請輸入訂單編號';
  if (lower.includes('logi_id must be 0')) return '節點/物流資料錯誤，請重新登入後再試';
  if (lower.includes('repository does not exist')) return '廠商或廠區不存在，請重新選擇';
  if (lower.includes('status error')) return '入/出庫狀態錯誤，請重新選擇';
  if (lower.includes('logistic branch does not exist')) return '物流分點不存在，請重新選擇';
  if (lower.includes('epk_id does not exist')) return '部分包裝編號不存在，請確認後再試';
  if (lower.includes('must be')) return '欄位格式錯誤，請檢查輸入內容';
  if (normalized) return normalized;
  return `上傳失敗 (${status})`;
};

export async function uploadBatch(batch: QueuedBatch, session: Session) {
  const body = JSON.stringify(buildPayload(batch));
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

  let json: Rf300Response;
  try {
    json = (await response.json()) as Rf300Response;
    if (__DEV__) {
      console.log('[RF300] upload response', {
        status: response.status,
        success: json?.success,
        message: json?.message,
      });
    }
  } catch {
    throw new Error('上傳回應解析失敗');
  }

  if (!response.ok || !json.success) {
    throw new Error(mapRf300Error(json?.message, response.status));
  }
}

export async function syncQueuedBatches(session: Session) {
  await clearQueueForOtherAccount(session.user.account);
  const queue = await getQueuedBatches();
  let synced = 0;
  let error: string | null = null;

  if (__DEV__) {
    console.log('[RF300] sync start', { count: queue.length });
  }

  for (const batch of queue) {
    try {
      await uploadBatch(batch, session);
      await addUploadedBatch(batch, Date.now());
      await removeBatch(batch.id);
      synced += 1;
    } catch (err) {
      error = err instanceof Error ? err.message : '上傳失敗';
      break;
    }
  }

  if (__DEV__) {
    console.log('[RF300] sync done', { synced, error });
  }

  return { synced, error };
}
