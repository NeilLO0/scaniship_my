import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'uhf_power_pct';
const DEFAULT_PCT = 75;

export async function loadUhfPowerPercent(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (!v) return DEFAULT_PCT;
    const num = parseInt(v, 10);
    if (Number.isNaN(num)) return DEFAULT_PCT;
    return Math.max(0, Math.min(100, num));
  } catch {
    return DEFAULT_PCT;
  }
}

export async function saveUhfPowerPercent(pct: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  try {
    await AsyncStorage.setItem(KEY, String(clamped));
  } catch {
    // ignore persistence errors
  }
}
