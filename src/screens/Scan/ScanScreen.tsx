import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBar from '../../components/HeaderBar';
import PrimaryButton from '../../components/PrimaryButton';
import ManualInputModal from '../../modals/ManualInputModal';
import Toast from '../../components/Toast';
import { LogisticBranch } from '../../services/logistics';
import { syncQueuedBatches } from '../../services/rf300';
import { Session } from '../../storage/session';
import { clearQueue, enqueueBatch, getQueueCount, QueuedBatch } from '../../storage/batchQueue';
import { uhf } from '../../native/uhf';
import { colors, radius, spacing, typography } from '../../theme';
import { normalizeToPackageId } from '../../utils/epc';
import { loadUhfPowerPercent } from '../../storage/uhfPower';

type Props = {
  session: Session;
  mode: 'IN' | 'OUT';
  warehouseName: string;
  branch: LogisticBranch;
  orderNumber?: string;
  batchId?: string;
  onBack: () => void;
};

type Item = { id: string };

export default function ScanScreen({
  session,
  mode,
  warehouseName,
  branch,
  orderNumber,
  batchId = generateBatchNumber(),
  onBack,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [manual, setManual] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [powerPct, setPowerPct] = useState(75);
  const seen = useRef<Set<string>>(new Set());
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const lastButtonTs = useRef<number>(0);
  const toggling = useRef<boolean>(false);
  const hardwareAvailable = uhf.isAvailable;

  const titleMode = useMemo(() => (mode === 'IN' ? '入庫' : '出庫'), [mode]);

  useEffect(() => {
    loadUhfPowerPercent()
      .then((pct) => {
        setPowerPct(pct);
        if (hardwareAvailable) {
          uhf.setPower(percentToDbm(pct));
        }
      })
      .catch(() => {});
  }, [hardwareAvailable, percentToDbm]);

  const percentToDbm = useCallback((pct: number) => Math.max(5, Math.min(33, Math.round((pct / 100) * 33))), []);

  const showToast = (message: string, duration = 1800) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, duration);
  };

  const refreshQueue = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const sortItems = useCallback((list: Item[]) => [...list].sort((a, b) => a.id.localeCompare(b.id)), []);

  const appendItem = (code: string) => {
    if (seen.current.has(code)) {
      showToast(`重複掃描：${code}`);
      return;
    }
    seen.current.add(code);
    setItems((prev) => sortItems([...prev, { id: code }]));
    showToast(`已加入：${code}`);
  };

  const handleManualInput = (input: string): string | null => {
    const value = input.trim();
    if (!value) return '請輸入內容';
    appendItem(value);
    return null;
  };

  const handleDelete = (id: string) => {
    seen.current.delete(id);
    setItems((prev) => sortItems(prev.filter((item) => item.id !== id)));
  };

  const clearAll = () => {
    setItems([]);
    seen.current.clear();
    if (hardwareAvailable) {
      uhf.clear();
    }
  };

  const clearPendingQueue = async () => {
    await clearQueue();
    await refreshQueue();
    showToast('已清除待同步批次');
  };

  const toggleScan = useCallback(() => {
    if (toggling.current) return;
    toggling.current = true;
    setScanning((value) => {
      const next = !value;
      if (hardwareAvailable) {
        const dbm = percentToDbm(powerPct);
        if (next) {
          uhf.stop();
          uhf.clear();
          uhf.setPower(dbm);
          uhf.start(dbm);
        } else {
          uhf.stop();
          uhf.clear();
        }
      }
      return next;
    });
    setTimeout(() => {
      toggling.current = false;
    }, 300);
  }, [hardwareAvailable, percentToDbm, powerPct]);

  useEffect(() => {
    if (!hardwareAvailable) return;
    uhf.init();
    const tagSub = uhf.onTags((values: string[]) => {
      values.forEach((epc) => {
        try {
          const pkg = normalizeToPackageId(epc);
          appendItem(pkg);
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知錯誤';
          showToast(message);
        }
      });
    });
    const btnSub = uhf.onButton(() => {
      const now = Date.now();
      if (now - lastButtonTs.current < 700) return;
      lastButtonTs.current = now;
      toggleScan();
    });
    return () => {
      tagSub?.remove?.();
      btnSub?.remove?.();
      uhf.stop();
      uhf.clear();
      uhf.dispose();
    };
  }, [hardwareAvailable, toggleScan]);

  const createBatchRecord = (): QueuedBatch => {
    const now = new Date();
    return {
      id: `${Date.now()}`,
      createdAt: now.getTime(),
      batchNumber: batchId,
      warehouseLabel: warehouseName,
      mode,
      orderNumber: orderNumber?.trim() || undefined,
      date: formatDate(now),
      epkIds: items.map((item) => item.id),
      node: session.user.node,
      logisticId: session.user.branch ?? 0,
      vendorId: branch.id,
      vendorBranchId: branch.branch_id ?? 0,
      ownerAccount: session.user.account,
      ownerUserId: session.user.id,
    };
  };

  const attemptSync = async () => {
    try {
      setSyncing(true);
      const result = await syncQueuedBatches(session);
      await refreshQueue();
      if (result.synced > 0) {
        showToast(`已同步 ${result.synced} 筆`, 2000);
      }
      if (result.error) {
        showToast(`上傳錯誤：${result.error}`, 2500);
      }
      if (result.synced === 0 && !result.error) {
        showToast('目前沒有待同步批次', 1800);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失敗';
      showToast(message, 2500);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (__DEV__) {
      console.log('[Scan] upload tap', { items: items.length, pendingCount, mode, orderNumber });
    }
    if (items.length > 500) {
      showToast('單批上限 500 筆，請分批再上傳');
      return;
    }
    if (!items.length) {
      if (!pendingCount) {
        showToast('沒有待上傳批次');
        return;
      }
      await attemptSync();
      return;
    }

    if (mode === 'OUT' && !orderNumber) {
      showToast('出庫需輸入訂單編號');
      return;
    }

    try {
      const batchRecord = createBatchRecord();
      await enqueueBatch(batchRecord);
      await refreshQueue();
      setItems([]);
      seen.current.clear();
      showToast('已建立批次並加入上傳佇列');
      await attemptSync();
    } catch (error) {
      const message = error instanceof Error ? error.message : '建立批次失敗';
      showToast(message, 2500);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title={`${batchId}  ${titleMode}`} onBack={onBack} />
      <View style={styles.topStats}>
        <Text style={styles.statsLabel}>已掃描筆數</Text>
        <Text style={styles.statsNum}>{items.length}</Text>
        <Text style={styles.statsMeta}>倉庫：{warehouseName}</Text>
        <Text style={styles.statsMeta}>訂單編號：{orderNumber || '—'}</Text>
        <Text style={styles.pending}>待同步批次：{pendingCount}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton
          title={scanning ? '停止掃描' : '開始掃描'}
          icon={scanning ? 'stop-circle-outline' : 'scan-outline'}
          onPress={toggleScan}
          style={{ marginTop: spacing.lg, backgroundColor: scanning ? '#E11D48' : colors.primary }}
        />

        <View style={styles.actionRow}>
          <PrimaryButton title="手動輸入" icon="keypad-outline" light onPress={() => setManual(true)} style={{ flex: 1 }} />
          <View style={{ width: spacing.lg }} />
          <PrimaryButton title="清空列表" icon="trash-outline" light onPress={clearAll} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>掃描明細</Text>
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
            <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name='close-outline' size={18} color={colors.mutedText} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="information-circle-outline" size={36} color={colors.mutedText} />
            <Text style={{ color: colors.mutedText, marginTop: spacing.md }}>尚無掃描資料</Text>
          </View>
        )}
      />

      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton title={syncing ? '同步中..' : '上傳資料'} icon="cloud-upload-outline" onPress={handleUpload} />
        <View style={{ height: spacing.md }} />
        <PrimaryButton title="清除待同步批次" light onPress={clearPendingQueue} />
        <View style={{ height: spacing.md }} />
        <PrimaryButton title="返回上一頁" light onPress={onBack} />
      </View>

      <ManualInputModal visible={manual} onClose={() => setManual(false)} onAdd={(value) => handleManualInput(value)} />
      <Toast visible={!!toast} message={toast || ''} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topStats: { backgroundColor: '#EAEEF3', alignItems: 'center', paddingVertical: spacing.xl },
  statsLabel: { color: colors.mutedText },
  statsNum: { marginTop: spacing.sm, fontSize: 56, fontWeight: '700', color: colors.text },
  statsMeta: { marginTop: 4, color: colors.mutedText },
  pending: { marginTop: 4, color: colors.text, fontWeight: '600' },
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

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function generateBatchNumber() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `B${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
}
