import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = { onBack: () => void; onOpenBatchView: () => void };

const mockTags = [
  { id: 'EBGA0000001', times: 4, batches: ['B20251011-001', 'B20251010-003', 'B20251008-007'] },
  { id: 'EBGA0000002', times: 3, batches: ['B20251011-001', 'B20251009-005'] },
];

export default function HistoryTagScreen({ onBack, onOpenBatchView }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="\u6383\u63cf\u7d00\u9304 - Tag" onBack={onBack} rightIcon="layers-outline" onRightPress={onOpenBatchView} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            placeholder="\u641c\u5c0b Tag \u7de8\u865f"
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, marginLeft: spacing.md }}
          />
        </View>
      </View>

      <FlatList
        data={mockTags}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="pricetag-outline" size={16} color={colors.mutedText} />
              <Text style={styles.tagId}>{item.id}</Text>
            </View>
            <Text style={styles.meta}>{`\u6383\u63cf ${item.times} \u6b21`}</Text>
            <View style={styles.badgeRow}>
              {item.batches.map((batch) => (
                <View key={batch} style={styles.badge}>
                  <Text style={styles.badgeText}>{batch}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: spacing.lg,
  },
  tagId: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { marginTop: 6, color: colors.text, fontSize: typography.body },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  badge: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.text, fontSize: 12 },
});
