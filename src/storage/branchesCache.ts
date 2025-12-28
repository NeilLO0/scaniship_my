import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogisticBranch } from '../services/logistics';

const KEY = 'cached_logistic_branches';

export async function loadCachedBranches(): Promise<LogisticBranch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as LogisticBranch[];
  } catch {
    return [];
  }
}

export async function saveCachedBranches(list: LogisticBranch[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore persistence errors
  }
}
