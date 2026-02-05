import AsyncStorage from '@react-native-async-storage/async-storage';

export type BillingLog = {
  requestId: string;
  deviceId: string;
  targetEndpoint: string;
  httpMethod: string;
  httpStatus: number;
  requestPayloadHash: string;
  responsePayloadHash: string;
  startDateTime: string;
  endDateTime: string;
  createdAt?: number;
};

const STORAGE_KEY = 'rfid_billing_logs_v1';
const RETENTION_MS = 24 * 60 * 60 * 1000; // keep 24 hours
const MAX_LOGS = 50;

async function readLogs(): Promise<BillingLog[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BillingLog[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    let filtered = parsed.filter((item) => !item.createdAt || now - item.createdAt <= RETENTION_MS);
    if (filtered.length > MAX_LOGS) {
      filtered = filtered.slice(-MAX_LOGS);
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

async function writeLogs(logs: BillingLog[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export async function enqueueBillingLog(log: BillingLog) {
  const logs = await readLogs();
  if (logs.find((item) => item.requestId === log.requestId)) return;
  const withTimestamp = log.createdAt ? log : { ...log, createdAt: Date.now() };
  if (logs.length >= MAX_LOGS) {
    logs.splice(0, logs.length - (MAX_LOGS - 1));
  }
  logs.push(withTimestamp);
  await writeLogs(logs);
}

export async function getPendingBillingLogs(): Promise<BillingLog[]> {
  return readLogs();
}

export async function removeBillingLog(requestId: string) {
  const logs = await readLogs();
  const next = logs.filter((item) => item.requestId !== requestId);
  await writeLogs(next);
}

export async function clearBillingLogs() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
