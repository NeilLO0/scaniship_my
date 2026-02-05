import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getQueuedBatches } from '../../storage/batchQueue';
import { getHistoryEntries } from '../../storage/history';
import { Session } from '../../storage/session';

type Props = { onBack: () => void; onOpenBatchView: () => void; session: Session };

type TagItem = { id: string; times: number; batches: string[] };

export default function HistoryTagScreen({ onBack, onOpenBatchView, session }: Props) {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<TagItem[]>([]);

  const refresh = async () => {
    const pending = await getQueuedBatches();
    const history = await getHistoryEntries(session.user.account);
    const map = new Map<string, TagItem>();

    const add = (batchNumber: string, ids: string[] | undefined | null) => {
      if (!Array.isArray(ids) || !ids.length) return;
      ids.forEach((id) => {
        const existed = map.get(id);
        if (existed) {
          existed.times += 1;
          if (!existed.batches.includes(batchNumber)) existed.batches.push(batchNumber);
        } else {
          map.set(id, { id, times: 1, batches: [batchNumber] });
        }
      });
    };

    history.forEach((h) => {
      const safeCount = Number.isFinite(h.count) && h.count > 0 ? Math.min(h.count, 5000) : 0;
      add(h.batchNumber, safeCount ? new Array(safeCount).fill('').map((_, i) => h.batchNumber + '-' + i) : []);
    });
    pending.forEach((p) => add(p.batchNumber, p.epkIds));

    // For history entries we only stored count, so they will not produce real tags. Pending entries include actual epkIds.
    // Sort by times desc.
    const list = Array.from(map.values()).sort((a, b) => b.times - a.times);
    setTags(list);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toUpperCase();
    if (!text) return tags;
    return tags.filter((t) => t.id.includes(text));
  }, [tags, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="掃描紀錄 - Tag" onBack={onBack} rightIcon="layers-outline" onRightPress={onOpenBatchView} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            placeholder="搜尋 Tag 編號"
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, marginLeft: spacing.md }}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        removeClippedSubviews
        windowSize={7}
        maxToRenderPerBatch={20}
        initialNumToRender={20}
        updateCellsBatchingPeriod={50}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="pricetag-outline" size={16} color={colors.mutedText} />
              <Text style={styles.tagId}>{item.id}</Text>
            </View>
            <Text style={styles.meta}>出現 {item.times} 次</Text>
            <View style={styles.badgeRow}>
              {item.batches.map((batch) => (
                <View key={batch} style={styles.badge}>
                  <Text style={styles.badgeText}>{batch}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Ionicons name="information-circle-outline" size={28} color={colors.mutedText} />
            <Text style={{ color: colors.mutedText, marginTop: spacing.sm }}>尚無 Tag 記錄</Text>
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
