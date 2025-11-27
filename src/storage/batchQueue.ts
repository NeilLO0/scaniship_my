import AsyncStorage from '@react-native-async-storage/async-storage';
export type QueuedBatch = {
  id: string;
  createdAt: number;
  batchNumber: string;
  warehouseLabel: string;
  mode: 'IN' | 'OUT';
  orderNumber?: string;
  date: string;
  epkIds: string[];
  node: number;
  logisticId: number;
  vendorId: number;
  vendorBranchId: number;
};

const STORAGE_KEY = 'rfid_batch_queue_v1';

async function readQueue(): Promise<QueuedBatch[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedBatch[];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function writeQueue(batches: QueuedBatch[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export async function enqueueBatch(batch: QueuedBatch) {
  const queue = await readQueue();
  queue.push(batch);
  await writeQueue(queue);
}

export async function removeBatch(batchId: string) {
  const queue = await readQueue();
  const next = queue.filter((item) => item.id !== batchId);
  await writeQueue(next);
}

export async function getQueuedBatches(): Promise<QueuedBatch[]> {
  return readQueue();
}

export async function getQueueCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function clearQueue() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
