import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import { colors } from './src/theme';
import ScanScreen from './src/screens/Scan/ScanScreen';
import HistoryBatchScreen from './src/screens/History/HistoryBatchScreen';
import HistoryTagScreen from './src/screens/History/HistoryTagScreen';
import SettingsPinScreen from './src/screens/Settings/SettingsPinScreen';
import SettingsHardwareScreen from './src/screens/Settings/SettingsHardwareScreen';
import SettingsApiScreen from './src/screens/Settings/SettingsApiScreen';

type Route =
  | { name: 'Login' }
  | { name: 'Main'; params?: undefined }
  | { name: 'Scan'; params: { mode: 'IN' | 'OUT'; warehouseId: string; orderNo?: string } }
  | { name: 'HistoryBatch' }
  | { name: 'HistoryTag' }
  | { name: 'SettingsPin' }
  | { name: 'SettingsHardware' }
  | { name: 'SettingsApi' };

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ name: 'Login' });

  const go = (r: Route) => setRoute(r);

  const content = () => {
    if (!userId) return <LoginScreen onLogin={(id) => { setUserId(id || '123'); go({ name: 'Main' }); }} />;
    switch (route.name) {
      case 'Main':
        return (
          <MainScreen
            userId={userId}
            onLogout={() => { setUserId(null); go({ name: 'Login' }); }}
            onStartScan={(p) => go({ name: 'Scan', params: p })}
            onOpenHistory={() => go({ name: 'HistoryBatch' })}
            onOpenSettings={() => go({ name: 'SettingsPin' })}
          />
        );
      case 'Scan':
        return (
          <ScanScreen
            mode={route.params.mode}
            warehouseName={route.params.warehouseId}
            onBack={() => go({ name: 'Main' })}
          />
        );
      case 'HistoryBatch':
        return <HistoryBatchScreen onBack={() => go({ name: 'Main' })} onOpenTagView={() => go({ name: 'HistoryTag' })} />;
      case 'HistoryTag':
        return <HistoryTagScreen onBack={() => go({ name: 'Main' })} onOpenBatchView={() => go({ name: 'HistoryBatch' })} />;
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

  const barStyle = userId ? 'light-content' : 'dark-content';
  const barBg = userId ? colors.primary : '#fff';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={barStyle} backgroundColor={barBg} />
      {content()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
