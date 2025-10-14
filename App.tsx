import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import { colors } from './src/theme';

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={userId ? 'light-content' : 'dark-content'}
        backgroundColor={userId ? colors.primary : '#fff'}
      />
      {userId ? (
        <MainScreen userId={userId} onLogout={() => setUserId(null)} />
      ) : (
        <LoginScreen onLogin={(id) => setUserId(id || '123')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});

