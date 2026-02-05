import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'rfid_app_session_v1';

export type Session = {
  token: string;
  expiresAt: number;
  user: {
    id: number;
    account: string;
    name: string;
    node: number;
    branch: number;
  };
};

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || !parsed.expiresAt) return null;
    return parsed;
  } catch (error) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
