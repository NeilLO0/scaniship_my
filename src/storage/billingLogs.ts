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
};

const STORAGE_KEY = 'rfid_billing_logs_v1';

async function readLogs(): Promise<BillingLog[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BillingLog[];
    return Array.isArray(parsed) ? parsed : [];
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
  logs.push(log);
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
