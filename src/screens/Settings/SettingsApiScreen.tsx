import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { apiConfig } from '../../config/api';
import { checkForUpdate, getSuggestedTag, UpdateCheckResult } from '../../services/update';

type Props = { onBack: () => void; appVersion?: { versionName: string; versionCode: string } | null };

export default function SettingsApiScreen({ onBack, appVersion }: Props) {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const suggestedTag =
    appVersion?.versionName && appVersion?.versionCode
      ? getSuggestedTag(appVersion.versionName, appVersion.versionCode)
      : null;

  const handleCheckUpdate = async () => {
    if (checking) return;
    setChecking(true);
    const result = await checkForUpdate();
    setUpdateInfo(result);
    setChecking(false);
  };

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
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>版本與更新</Text>
          <Text style={styles.meta}>
            目前版本：{appVersion ? `${appVersion.versionName} (${appVersion.versionCode})` : '—'}
          </Text>
          <Text style={styles.meta}>建議 Release Tag：{suggestedTag ?? '—'}</Text>
          {updateInfo?.status === 'update-available' ? (
            <Text style={[styles.meta, { color: '#dc2626' }]}>
              有新版本：{updateInfo.versionName} ({updateInfo.versionCode})
            </Text>
          ) : updateInfo?.status === 'up-to-date' ? (
            <Text style={[styles.meta, { color: '#16a34a' }]}>目前已是最新版本</Text>
          ) : updateInfo?.status === 'error' ? (
            <Text style={[styles.meta, { color: '#dc2626' }]}>檢查失敗：{updateInfo.message}</Text>
          ) : null}
          <PrimaryButton
            title={checking ? '檢查中...' : '檢查更新'}
            light
            onPress={handleCheckUpdate}
            style={{ marginTop: spacing.md }}
          />
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
