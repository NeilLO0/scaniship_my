import React, { useMemo, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../../theme';
import HeaderBar from '../../components/HeaderBar';
import PrimaryButton from '../../components/PrimaryButton';
import ManualInputModal from '../../modals/ManualInputModal';
import Toast from '../../components/Toast';

type Props = {
  mode: 'IN' | 'OUT';
  warehouseName: string;
  batchId?: string;
  onBack: () => void;
};

type Item = { id: string };

export default function ScanScreen({ mode, warehouseName, batchId = 'B20251011-858', onBack }: Props) {
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [manual, setManual] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const titleMode = useMemo(() => (mode === 'IN' ? '\u5165\u5eab' : '\u51fa\u5eab'), [mode]);

  const addItem = (code: string) => {
    setItems((prev) => [...prev, { id: code }]);
    setToast(`\u6383\u63cf\u6210\u529f\uff1a${code}`);
    setTimeout(() => setToast(null), 1800);
  };

  const clearAll = () => setItems([]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title={`${batchId}  ${titleMode}`} onBack={onBack} />
      <View style={styles.topStats}>
        <Text style={styles.statsLabel}>\u5df2\u6383\u63cf\u7b46\u6578</Text>
        <Text style={styles.statsNum}>{items.length}</Text>
        <Text style={styles.statsMeta}>{`\u5009\u5eab\uff1a${warehouseName}`}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton
          title={scanning ? '\u505c\u6b62\u6383\u63cf' : '\u958b\u59cb\u6383\u63cf'}
          icon={scanning ? 'stop-circle-outline' : 'scan-outline'}
          onPress={() => {
            setScanning((value) => !value);
            if (scanning) {
              setToast('\u6383\u63cf\u5df2\u505c\u6b62');
              setTimeout(() => setToast(null), 1200);
            }
          }}
          style={{ marginTop: spacing.lg, backgroundColor: scanning ? '#E11D48' : colors.primary }}
        />

        <View style={styles.actionRow}>
          <PrimaryButton title="\u624b\u52d5\u8f38\u5165" icon="keypad-outline" light onPress={() => setManual(true)} style={{ flex: 1 }} />
          <View style={{ width: spacing.lg }} />
          <PrimaryButton title="\u6e05\u7a7a\u5217\u8868" icon="trash-outline" light onPress={clearAll} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>\u6383\u63cf\u660e\u7d30</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        renderItem={({ item, index }) => (
          <View style={styles.rowItem}>
            <View style={styles.indexBubble}>
              <Text style={{ color: colors.text }}>{index + 1}</Text>
            </View>
            <Text style={styles.itemText}>{item.id}</Text>
            <Ionicons name="close-outline" size={18} color={colors.mutedText} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="information-circle-outline" size={36} color={colors.mutedText} />
            <Text style={{ color: colors.mutedText, marginTop: spacing.md }}>\u66ab\u7121\u6383\u63cf\u8a18\u9304</Text>
          </View>
        )}
      />

      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton title="\u4e0a\u50b3\u8cc7\u6599" icon="cloud-upload-outline" />
        <View style={{ height: spacing.md }} />
        <PrimaryButton title="\u8fd4\u56de\u4e0a\u4e00\u9801" light onPress={onBack} />
      </View>

      <ManualInputModal visible={manual} onClose={() => setManual(false)} onAdd={addItem} />
      <Toast visible={!!toast} message={toast || ''} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topStats: { backgroundColor: '#EAEEF3', alignItems: 'center', paddingVertical: spacing.xl },
  statsLabel: { color: colors.mutedText },
  statsNum: { marginTop: spacing.sm, fontSize: 56, fontWeight: '700', color: colors.text },
  statsMeta: { marginTop: 4, color: colors.mutedText },
  actionRow: { flexDirection: 'row', marginTop: spacing.md },
  sectionHeader: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  sectionHeaderText: { color: colors.text, fontSize: 14 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  indexBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemText: { color: colors.text, flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
});
