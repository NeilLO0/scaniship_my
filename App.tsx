import React, { useEffect, useState } from 'react';
import { ActivityIndicator, DevSettings, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import { colors } from './src/theme';
import ScanScreen from './src/screens/Scan/ScanScreen';
import HistoryBatchScreen from './src/screens/History/HistoryBatchScreen';
import HistoryTagScreen from './src/screens/History/HistoryTagScreen';
import SettingsPinScreen from './src/screens/Settings/SettingsPinScreen';
import SettingsHardwareScreen from './src/screens/Settings/SettingsHardwareScreen';
import SettingsApiScreen from './src/screens/Settings/SettingsApiScreen';
import { login } from './src/services/auth';
import { Session, clearSession, loadSession, saveSession } from './src/storage/session';
import { LogisticBranch } from './src/services/logistics';
import { clearQueue as clearBatchQueue, clearQueueForOtherAccount } from './src/storage/batchQueue';

if (__DEV__) {
  DevSettings.addMenuItem('Clear batch queue', () => {
    clearBatchQueue()
      .then(() => console.log('[DevMenu] batch queue cleared'))
      .catch((error) => console.warn('[DevMenu] clear batch queue failed', error));
  });
}

type Route =
  | { name: 'Login' }
  | { name: 'Main'; params?: undefined }
  | {
      name: 'Scan';
      params: { mode: 'IN' | 'OUT'; warehouseLabel: string; branch: LogisticBranch; orderNo?: string };
    }
  | { name: 'HistoryBatch' }
  | { name: 'HistoryTag' }
  | { name: 'SettingsPin' }
  | { name: 'SettingsHardware' }
  | { name: 'SettingsApi' };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [route, setRoute] = useState<Route>({ name: 'Login' });
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const go = (r: Route) => setRoute(r);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadSession();
      if (stored && stored.expiresAt > Date.now()) {
        if (mounted) {
          await clearQueueForOtherAccount(stored.user.account);
          setSession(stored);
          setRoute({ name: 'Main' });
        }
      } else if (stored) {
        await clearSession();
      }
      if (mounted) setInitializing(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (account: string, password: string) => {
    if (authLoading) return;
    setAuthError(null);
    setAuthLoading(true);
    try {
      const nextSession = await login(account, password);
      await saveSession(nextSession);
      await clearQueueForOtherAccount(nextSession.user.account);
      setSession(nextSession);
      go({ name: 'Main' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '登入失敗，請稍後再試';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    setSession(null);
    setRoute({ name: 'Login' });
  };

  const content = () => {
    if (!session) return <LoginScreen onLogin={handleLogin} loading={authLoading} errorMessage={authError} />;
    switch (route.name) {
      case 'Main':
        return (
          <MainScreen
            session={session}
            onLogout={handleLogout}
            onStartScan={(p) => go({ name: 'Scan', params: p })}
            onOpenHistory={() => go({ name: 'HistoryBatch' })}
            onOpenSettings={() => go({ name: 'SettingsPin' })}
          />
        );
      case 'Scan':
        return (
          <ScanScreen
            session={session}
            mode={route.params.mode}
            warehouseName={route.params.warehouseLabel}
            branch={route.params.branch}
            orderNumber={route.params.orderNo}
            onBack={() => go({ name: 'Main' })}
          />
        );
      case 'HistoryBatch':
        return <HistoryBatchScreen session={session} onBack={() => go({ name: 'Main' })} onOpenTagView={() => go({ name: 'HistoryTag' })} />;
      case 'HistoryTag':
        return <HistoryTagScreen session={session} onBack={() => go({ name: 'Main' })} onOpenBatchView={() => go({ name: 'HistoryBatch' })} />;
      case 'SettingsPin':
        return <SettingsPinScreen onBack={() => go({ name: 'Main' })} onVerified={(target) => go({ name: target === 'hardware' ? 'SettingsHardware' : 'SettingsApi' })} />;
      case 'SettingsHardware':
        return <SettingsHardwareScreen onBack={() => go({ name: 'Main' })} />;
      case 'SettingsApi':
        return <SettingsApiScreen onBack={() => go({ name: 'Main' })} />;
      default:
        return null;
    }
  };

  const barStyle = session ? 'light-content' : 'dark-content';
  const barBg = session ? colors.primary : '#fff';

  if (initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={barStyle} backgroundColor={barBg} />
      {content()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
