import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { onBack: () => void };

export default function SettingsApiScreen({ onBack }: Props) {
  const [url, setUrl] = useState('https://api.example.com/rfid');
  const [token, setToken] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="系統設定" onBack={onBack} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API 設定</Text>
          <Text style={styles.sub}>配置後端 API 連線資訊</Text>

          <Text style={styles.label}>API 網址</Text>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://api.example.com/rfid" placeholderTextColor={colors.placeholder} style={styles.input} />
          <Text style={styles.help}>後端 API 的完整網址</Text>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>API Token</Text>
          <TextInput value={token} onChangeText={setToken} placeholder="請輸入 API Token" placeholderTextColor={colors.placeholder} style={styles.input} />
          <Text style={styles.help}>用於驗證 API 請求的金鑰</Text>

          <PrimaryButton title="儲存所有設定" icon="ios-checkmark-circle-outline" style={{ marginTop: spacing.lg }} />
        </View>

        <View style={[styles.card, { marginTop: spacing.lg }]}> 
          <Text style={styles.cardTitle}>關於</Text>
          <Text style={styles.meta}>手持式 RFID 掃描應用程式</Text>
          <Text style={styles.meta}>版本: 1.0.0</Text>
          <Text style={styles.meta}>更新日期: 2025-10-11</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.inputBorder },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  sub: { marginTop: 4, color: colors.mutedText, fontSize: typography.caption },
  label: { marginTop: spacing.lg, color: colors.text, fontSize: typography.label, marginBottom: spacing.sm },
  input: { backgroundColor: colors.inputBg, borderRadius: radius.md, height: 48, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.inputBorder },
  help: { marginTop: 4, color: colors.mutedText, fontSize: typography.caption },
  meta: { marginTop: 6, color: colors.text },
});
