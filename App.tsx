import React, { useEffect, useState } from 'react';
import { ActivityIndicator, DevSettings, Linking, Modal, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { sentryBridge } from './src/native/sentry';
import { checkForUpdate, UpdateCheckResult } from './src/services/update';
import { appInfo } from './src/native/appInfo';


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

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [route, setRoute] = useState<Route>({ name: 'Login' });
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState<{ versionName: string; versionCode: string } | null>(null);

  const go = (r: Route) => setRoute(r);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const version = await appInfo.getAppVersion();
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
      if (mounted) setAppVersion(version);
      if (mounted) setInitializing(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (__DEV__ || initializing) return;
    let cancelled = false;
    (async () => {
      const result = await checkForUpdate();
      if (!cancelled) {
        setUpdateState(result);
        if (result.status === 'update-available') {
          setShowUpdate(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializing]);

  useEffect(() => {
    if (!session) {
      sentryBridge.clearContext();
      return;
    }
    sentryBridge.setUser(String(session.user.id), session.user.account);
    sentryBridge.setTag('account', session.user.account);
  }, [session]);

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
    sentryBridge.clearContext();
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
        return <SettingsApiScreen onBack={() => go({ name: 'Main' })} appVersion={appVersion} />;
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
      <Modal visible={showUpdate} transparent animationType="fade" onRequestClose={() => setShowUpdate(false)}>
        <View style={styles.updateBackdrop}>
          <View style={styles.updateCard}>
            <Text style={styles.updateTitle}>有新版本可更新</Text>
            {updateState && updateState.status === 'update-available' ? (
              <>
                <Text style={styles.updateMeta}>版本：{updateState.versionName}</Text>
                {updateState.releaseNotes ? (
                  <Text style={styles.updateNotes} numberOfLines={6}>
                    {updateState.releaseNotes}
                  </Text>
                ) : null}
              </>
            ) : null}
            <View style={styles.updateActions}>
              <TouchableOpacity style={[styles.updateBtn, styles.updateBtnSecondary]} onPress={() => setShowUpdate(false)}>
                <Text style={styles.updateBtnTextSecondary}>稍後</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.updateBtn, styles.updateBtnPrimary]}
                onPress={async () => {
                  if (updateState && updateState.status === 'update-available') {
                    await Linking.openURL(updateState.downloadUrl);
                  }
                }}
              >
                <Text style={styles.updateBtnTextPrimary}>下載更新</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  updateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  updateCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  updateTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  updateMeta: { marginTop: 8, color: '#374151' },
  updateNotes: { marginTop: 8, color: '#6B7280' },
  updateActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  updateBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  updateBtnPrimary: { backgroundColor: colors.primary, marginLeft: 12 },
  updateBtnSecondary: { backgroundColor: '#E5E7EB' },
  updateBtnTextPrimary: { color: '#fff', fontWeight: '700' },
  updateBtnTextSecondary: { color: '#111827', fontWeight: '700' },
});

export default App;
