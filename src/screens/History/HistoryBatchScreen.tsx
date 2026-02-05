import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getQueuedBatches, QueuedBatch } from '../../storage/batchQueue';
import { getHistoryEntries, HistoryEntry } from '../../storage/history';
import { Session } from '../../storage/session';

type Props = { onBack: () => void; onOpenTagView: () => void; session: Session };

type BatchItem =
  | (HistoryEntry & { source: 'history' })
  | (QueuedBatch & { source: 'pending'; syncedAt?: number });

export default function HistoryBatchScreen({ onBack, onOpenTagView, session }: Props) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [query, setQuery] = useState('');

  const refresh = async () => {
    const pending = await getQueuedBatches();
    const history = await getHistoryEntries(session.user.account);
    const mapped: BatchItem[] = [
      ...pending.map((p) => ({ ...p, source: 'pending' as const })),
      ...history.map((h) => ({ ...h, source: 'history' as const })),
    ];
    setItems(mapped);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => {
      const haystack = `${item.batchNumber} ${'warehouseLabel' in item ? item.warehouseLabel : ''} ${
        'orderNumber' in item ? item.orderNumber ?? '' : ''
      }`.toLowerCase();
      return haystack.includes(text);
    });
  }, [items, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="掃描紀錄 - 批次" onBack={onBack} rightIcon="pricetag-outline" onRightPress={onOpenTagView} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            placeholder="搜尋批次、倉庫、訂單"
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, marginLeft: spacing.md }}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.source}-${item.id}-${index}`}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        removeClippedSubviews
        windowSize={7}
        maxToRenderPerBatch={20}
        initialNumToRender={20}
        updateCellsBatchingPeriod={50}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.batch}>{item.batchNumber}</Text>
                <Text style={[styles.status, item.source === 'pending' && { color: '#F59E0B' }]}> 
                  {item.source === 'pending' ? '待上傳' : '已上傳'}
                </Text>
              </View>
              <View style={styles.countBubble}>
                <Text style={{ color: colors.text }}>{'count' in item ? item.count : item.epkIds?.length || 0}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Ionicons name="home-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>倉庫：{'warehouseLabel' in item ? item.warehouseLabel : ''}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="pricetag-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>訂單：{'orderNumber' in item ? item.orderNumber || '—' : '—'}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="time-outline" size={16} color={colors.mutedText} />
              <Text style={styles.meta}>
                {'syncedAt' in item && item.syncedAt ? new Date(item.syncedAt).toLocaleString() : '尚未上傳'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Ionicons name="information-circle-outline" size={28} color={colors.mutedText} />
            <Text style={{ color: colors.mutedText, marginTop: spacing.sm }}>尚無掃描紀錄</Text>
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
});
