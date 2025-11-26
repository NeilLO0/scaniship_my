import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  onLogin: (account: string, password: string) => Promise<void> | void;
  loading?: boolean;
  errorMessage?: string | null;
};

export default function LoginScreen({ onLogin, loading = false, errorMessage }: Props) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  const canLogin = account.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = () => {
    if (!canLogin || loading) return;
    onLogin(account.trim(), password.trim());
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Ionicons name="cube-outline" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>RFID 掃描系統</Text>
        <Text style={styles.subtitle}>搭配 PDA 裝置進行包裝管理</Text>

        <View style={styles.form}>
          <Text style={styles.label}>帳號</Text>
          <TextInput
            value={account}
            onChangeText={setAccount}
            placeholder="請輸入帳號"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>密碼</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="請輸入密碼"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleSubmit}
            disabled={!canLogin || loading}
            style={({ pressed }) => [
              styles.button,
              {
                opacity: pressed || !canLogin || loading ? 0.7 : 1,
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name="log-in-outline"
              size={18}
              color="#fff"
              style={{ marginRight: spacing.md }}
            />
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>登入</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    marginTop: spacing.xxl,
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: typography.subtitle,
    color: colors.mutedText,
  },
  form: {
    width: '100%',
    marginTop: spacing.xxl,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    fontSize: typography.body,
  },
  button: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  error: {
    color: '#EF4444',
    marginTop: spacing.md,
  },
});
