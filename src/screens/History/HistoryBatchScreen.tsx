import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = { onBack: () => void; onOpenTagView: () => void };

const mockBatches = [
  {
    id: 'B20251011-001',
    status: '已完成',
    count: 6,
    warehouse: '倉庫 A',
    user: '胡智偉',
    time: '2025/10/20 上午 02:43',
    tags: ['EBGA0000001', 'EBGA0000002', 'EBGA0000003', 'EBGA0000004', 'EBGA0000005'],
  },
  {
    id: 'B20251010-003',
    status: '已完成',
    count: 5,
    warehouse: '倉庫 A',
    user: '林佩真',
    time: '2025/10/19 下午 02:43',
    tags: ['EBGB0000001', 'EBGA0000004', 'EBGA0000009'],
  },
];

export default function HistoryBatchScreen({ onBack, onOpenTagView }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="掃描紀錄 - 批次" onBack={onBack} rightIcon="pricetag-outline" onRightPress={onOpenTagView} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            placeholder="搜尋批次、倉庫、單號、操作人或 Tag"
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, marginLeft: spacing.md }}
          />
        </View>
      </View>

      <FlatList
        data={mockBatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.batch}>{item.id}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <View style={styles.countBubble}>
                <Text style={{ color: colors.text }}>{item.count}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Ionicons name="home-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>倉庫：{item.warehouse}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="person-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>操作人：{item.user}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="time-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>{item.time}</Text>
            </View>

            <View style={styles.tagRow}>
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.tags.length > 3 && (
                <View style={styles.more}>
                  <Text style={styles.moreText}>+{item.tags.length - 3} 更多</Text>
                </View>
              )}
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  batch: { fontSize: 16, fontWeight: '700', color: colors.text },
  status: { color: colors.mutedText, marginTop: 2, fontSize: typography.caption },
  countBubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { color: colors.text, fontSize: typography.body },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  tag: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: colors.text, fontSize: 12 },
  more: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  moreText: { color: colors.text, fontSize: 12 },
});
