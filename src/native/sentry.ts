import { NativeModules } from 'react-native';

type SentryBridge = {
  setUser: (userId?: string | null, account?: string | null) => void;
  setTag: (key: string, value?: string | null) => void;
  clearContext: () => void;
  captureMessage: (message: string, level?: string | null) => void;
};

const bridge: SentryBridge | undefined = (NativeModules as any).SentryBridge;

const fallback: SentryBridge = {
  setUser: () => {},
  setTag: () => {},
  clearContext: () => {},
  captureMessage: () => {},
};

export const sentryBridge = bridge ?? fallback;
