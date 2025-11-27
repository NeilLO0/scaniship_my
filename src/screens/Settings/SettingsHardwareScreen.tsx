import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { onBack: () => void };

export default function SettingsHardwareScreen({ onBack }: Props) {
  const [power, setPower] = useState(75);
  const quick = [33, 50, 66, 100];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="系統設定" onBack={onBack} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RFID 硬體設定</Text>
          <Text style={styles.sub}>調整 RFID 讀取器的天線功率</Text>

          <View style={styles.powerPanel}>
            <Text style={styles.powerNum}>{power}<Text style={{ fontSize: 18 }}>%</Text></Text>
            <Text style={styles.dbm}>約 {Math.round((power/100)*35)} dBm</Text>
          </View>

          <Text style={styles.label}>調整功率</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${power}%` }]} />
          </View>

          <View style={styles.quickRow}>
            {quick.map((q) => (
              <PrimaryButton key={q} title={`${q}%`} light onPress={() => setPower(q)} style={{ flex: 1 }} />
            ))}
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>提示：</Text>
            <Text style={styles.noticeText}>低功率 (0-33%)：適用於近距離掃描、節電模式</Text>
            <Text style={styles.noticeText}>中功率 (34-66%)：適用於一般作業、平衡讀取距離與功耗</Text>
            <Text style={styles.noticeText}>高功率 (67-100%)：適用於遠距離掃描</Text>
          </View>

          <PrimaryButton title="儲存所有設定" icon="checkmark-circle-outline" />
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
