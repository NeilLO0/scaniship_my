import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueuedBatch } from './batchQueue';

export type HistoryEntry = {
  id: string;
  batchNumber: string;
  mode: 'IN' | 'OUT';
  warehouseLabel: string;
  orderNumber?: string;
  count: number;
  date: string;
  status: 'uploaded';
  syncedAt: number;
  ownerAccount: string;
  ownerUserId: number;
};

const STORAGE_KEY = 'rfid_history_v1';
const RETENTION_MS = 24 * 60 * 60 * 1000; // keep 24 hours
const MAX_HISTORY = 200;

async function readHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    let filtered = parsed.filter((item) => now - item.syncedAt <= RETENTION_MS);
    if (filtered.length > MAX_HISTORY) {
      filtered = filtered.slice(0, MAX_HISTORY);
    }
    if (filtered.length !== parsed.length) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function writeHistory(entries: HistoryEntry[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function addUploadedBatch(batch: QueuedBatch, syncedAt: number) {
  const entries = await readHistory();
  const entry: HistoryEntry = {
    id: batch.id,
    batchNumber: batch.batchNumber,
    mode: batch.mode,
    warehouseLabel: batch.warehouseLabel,
    orderNumber: batch.orderNumber,
    count: batch.epkIds.length,
    date: batch.date,
    status: 'uploaded',
    syncedAt,
    ownerAccount: batch.ownerAccount,
    ownerUserId: batch.ownerUserId,
  };
  entries.unshift(entry);
  if (entries.length > MAX_HISTORY) {
    entries.splice(MAX_HISTORY);
  }
  await writeHistory(entries);
}

export async function getHistoryEntries(ownerAccount: string): Promise<HistoryEntry[]> {
  const all = await readHistory();
  return all.filter((item) => item.ownerAccount === ownerAccount);
}

export async function clearHistory() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
