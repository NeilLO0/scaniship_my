import React, { useCallback, useEffect, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { uhf } from '../../native/uhf';
import { loadUhfPowerPercent, saveUhfPowerPercent } from '../../storage/uhfPower';

type Props = { onBack: () => void };

// 功率設定頁：讀取/儲存百分比，並轉換為 5~33 dBm 套用到模組
export default function SettingsHardwareScreen({ onBack }: Props) {
  const [power, setPower] = useState(75);
  const [appliedDbm, setAppliedDbm] = useState<number | null>(null);
  const quick = [33, 66, 80, 100];

  const percentToDbm = (pct: number) => Math.max(5, Math.min(33, Math.round((pct / 100) * 33)));

  const applyPower = useCallback(
    (pct: number) => {
      const dbm = percentToDbm(pct);
      if (uhf.isAvailable) {
        uhf.setPower(dbm);
      }
      saveUhfPowerPercent(pct);
      setAppliedDbm(dbm);
      const msg = `功率已套用：${pct}%（約 ${dbm} dBm）`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      }
      if (__DEV__) {
        // 在 logcat 可見
        console.log('[UHF] setPower', { pct, dbm, available: uhf.isAvailable });
      }
    },
    [],
  );

  useEffect(() => {
    if (uhf.isAvailable) {
      uhf.init();
    }
    loadUhfPowerPercent()
      .then((pct) => {
        setPower(pct);
        applyPower(pct);
      })
      .catch(() => {});
  }, [applyPower]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="RFID 硬體設定" onBack={onBack} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RFID 硬體設定</Text>
          <Text style={styles.sub}>調整 RFID 讀取器的天線功率</Text>
          {!uhf.isAvailable && <Text style={[styles.sub, { color: '#dc2626' }]}>未偵測到掃描槍，僅儲存設定值</Text>}

          <View style={styles.powerPanel}>
            <Text style={styles.powerNum}>
              {power}
              <Text style={{ fontSize: 18 }}>%</Text>
            </Text>
            <Text style={styles.dbm}>約 {percentToDbm(power)} dBm</Text>
          </View>

          <Text style={styles.label}>調整功率</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${power}%` }]} />
          </View>

          <View style={styles.quickRow}>
            {quick.map((q) => (
              <PrimaryButton
                key={q}
                title={`${q}%`}
                light
                onPress={() => {
                  setPower(q);
                  applyPower(q);
                }}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          {appliedDbm !== null && (
            <Text style={[styles.sub, { marginTop: spacing.sm }]}>
              已套用：{power}%（約 {appliedDbm} dBm）
            </Text>
          )}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>提示：</Text>
            <Text style={styles.noticeText}>低功率(0-33%)：適用於近距離掃描、節電模式</Text>
            <Text style={styles.noticeText}>中功率(34-66%)：適用於一般作業、平衡讀取距離與功耗</Text>
            <Text style={styles.noticeText}>高功率(67-100%)：適用於遠距離掃描</Text>
          </View>

          <PrimaryButton title="儲存所有設定" icon="checkmark-circle-outline" onPress={() => applyPower(power)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.inputBorder },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  sub: { marginTop: 4, color: colors.mutedText, fontSize: typography.caption },
  powerPanel: { marginTop: spacing.lg, backgroundColor: '#F1F5F9', borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.xl },
  powerNum: { fontSize: 48, fontWeight: '700', color: colors.text },
  dbm: { marginTop: spacing.md, color: colors.mutedText },
  label: { marginTop: spacing.lg, color: colors.text, fontSize: typography.label, marginBottom: spacing.sm },
  sliderTrack: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 6 },
  sliderFill: { height: 10, backgroundColor: colors.primary, borderRadius: 6 },
  quickRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  notice: { marginTop: spacing.lg, backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: spacing.lg },
  noticeTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  noticeText: { color: colors.text, fontSize: typography.caption, marginTop: 2 },
});
