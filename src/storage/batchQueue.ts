import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

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
  ownerAccount: string;
  ownerUserId: number;
};

const STORAGE_KEY = 'rfid_batch_queue_v1';
const ENCRYPTION_KEY = 'rfid_queue_secret_v1';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Lightweight XOR + base64 obfuscation to avoid native crypto dependency on RN/Hermes.
 * Not cryptographically strong, but prevents casual inspection of offline queue data.
 */
const xorTransform = (input: string, key: string) => {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const k = key.charCodeAt(i % key.length);
    out += String.fromCharCode(input.charCodeAt(i) ^ k);
  }
  return out;
};

const toBase64 = (input: string) => Buffer.from(input, 'utf8').toString('base64');
const fromBase64 = (input: string) => Buffer.from(input, 'base64').toString('utf8');

const encrypt = (plaintext: string) => toBase64(xorTransform(plaintext, ENCRYPTION_KEY));
const decrypt = (ciphertext: string) => xorTransform(fromBase64(ciphertext), ENCRYPTION_KEY);

async function readQueue(): Promise<QueuedBatch[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  // Try decrypt first; fall back to plain JSON for backward compatibility.
  const parse = (value: string) => {
    try {
      return JSON.parse(value) as QueuedBatch[];
    } catch {
      return null;
    }
  };

  let parsed: QueuedBatch[] | null = null;
  try {
    parsed = parse(decrypt(raw));
    if (!parsed) parsed = parse(raw);
    if (!parsed || !Array.isArray(parsed)) throw new Error('parse-failed');
  } catch (error) {
    if (__DEV__) {
      console.warn('[batchQueue] failed to parse queue, clearing storage', error);
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }

  // Filter out expired batches (>24h) and rewrite encrypted.
  const now = Date.now();
  const filtered = parsed.filter((item) => now - item.createdAt <= EXPIRY_MS);
  await writeQueue(filtered);
  return filtered;
}

async function writeQueue(batches: QueuedBatch[]) {
  const payload = JSON.stringify(batches);
  const encrypted = encrypt(payload);
  if (__DEV__) {
    console.log('[batchQueue] write', { count: batches.length });
  }
  await AsyncStorage.setItem(STORAGE_KEY, encrypted);
}

export async function enqueueBatch(batch: QueuedBatch) {
  const queue = await readQueue();
  queue.push(batch);
  if (__DEV__) {
    console.log('[batchQueue] enqueue', { id: batch.id, owner: batch.ownerAccount, count: queue.length });
  }
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

export async function clearQueueForOtherAccount(account: string) {
  const queue = await readQueue();
  const filtered = queue.filter((item) => item.ownerAccount === account);
  await writeQueue(filtered);
}
