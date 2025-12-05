import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { apiConfig } from '../../config/api';

type Props = { onBack: () => void };

export default function SettingsApiScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="API 設定" onBack={onBack} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>環境</Text>
          <Text style={styles.meta}>目前鎖定：測試區 (staging)</Text>
          <Text style={styles.meta}>Base URL：{apiConfig.baseUrl}</Text>
          <Text style={styles.meta}>API Key：{apiConfig.apiKey}</Text>
          <Text style={[styles.meta, { marginTop: spacing.md, color: colors.mutedText }]}>如需改正式區，請告知再調整。</Text>
        </View>
        <PrimaryButton title="返回上一頁" light onPress={onBack} style={{ marginTop: spacing.lg }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.inputBorder },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  meta: { marginTop: spacing.sm, color: colors.text, fontSize: typography.body },
});
