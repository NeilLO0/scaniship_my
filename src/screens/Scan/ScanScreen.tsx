import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBar from '../../components/HeaderBar';
import PrimaryButton from '../../components/PrimaryButton';
import ManualInputModal from '../../modals/ManualInputModal';
import Toast from '../../components/Toast';
import { LogisticBranch } from '../../services/logistics';
import { syncQueuedBatches, SyncResult } from '../../services/rf300';
import { Session } from '../../storage/session';
import { clearQueueForMode, enqueueBatch, getQueueCountFor, QueuedBatch } from '../../storage/batchQueue';
import { uhf } from '../../native/uhf';
import { colors, radius, spacing, typography } from '../../theme';
import { normalizeToPackageId } from '../../utils/epc';
import { loadUhfPowerPercent } from '../../storage/uhfPower';
import SettingsHardwareScreen from '../Settings/SettingsHardwareScreen';

type Props = {
  session: Session;
  mode: 'IN' | 'OUT';
  warehouseName: string;
  branch: LogisticBranch;
  orderNumber?: string;
  batchId?: string;
  onBack: () => void;
};

type Item = { id: string; status: 'valid' | 'invalid' };

type SyncErrorDetail = { batchNumber: string; error: string; epkIds?: string[] };

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
  const [showPower, setShowPower] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [syncErrorDetails, setSyncErrorDetails] = useState<SyncErrorDetail[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const seenErrorBatches = useRef<Set<string>>(new Set());

  const seen = useRef<Set<string>>(new Set());
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const lastButtonTs = useRef<number>(0);
  const toggling = useRef<boolean>(false);
  const hardwareAvailable = uhf.isAvailable;

  const titleMode = useMemo(() => (mode === 'IN' ? '入庫' : '出庫'), [mode]);
  const validCount = useMemo(() => items.filter((i) => i.status === 'valid').length, [items]);
  const invalidCount = useMemo(() => items.filter((i) => i.status === 'invalid').length, [items]);
  const invalidList = useMemo(() => items.filter((i) => i.status === 'invalid'), [items]);

  const percentToDbm = useCallback((pct: number) => Math.max(5, Math.min(33, Math.round((pct / 100) * 33))), []);

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

  const showToast = (message: string, duration = 1800) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, duration);
  };

  const refreshQueue = useCallback(async () => {
    const count = await getQueueCountFor(session.user.account, mode);
    setPendingCount(count);
  }, [mode, session.user.account]);

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
    setItems((prev) => sortItems([...prev, { id: code, status: 'valid' }]));
    showToast(`已加入：${code}`);
  };

  const appendInvalid = (code: string, message?: string) => {
    if (seen.current.has(code)) return;
    seen.current.add(code);
    setItems((prev) => sortItems([...prev, { id: code, status: 'invalid' }]));
    if (message) showToast(message);
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
    if (hardwareAvailable) uhf.clear();
  };

  const clearPendingQueue = async () => {
    await clearQueueForMode(session.user.account, mode);
    await refreshQueue();
    setSyncErrorDetails([]);
    seenErrorBatches.current.clear();
    setShowSyncErrorModal(false);
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
          appendInvalid(epc, message);
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
    const validEpkIds = items.filter((item) => item.status === 'valid').map((item) => item.id);
    return {
      id: `${Date.now()}`,
      createdAt: now.getTime(),
      batchNumber: batchId,
      warehouseLabel: warehouseName,
      mode,
      orderNumber: orderNumber?.trim() || undefined,
      date: formatDate(now),
      epkIds: validEpkIds,
      node: session.user.node,
      logisticId: session.user.branch ?? 0,
      vendorId: branch.id,
      vendorBranchId: branch.branch_id ?? 0,
      ownerAccount: session.user.account,
      ownerUserId: session.user.id,
    };
  };

  const isNetworkError = (msg?: string) => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('wifi網路連線異常') || lower.includes('network request failed');
  };

  const handleSyncResult = (result: SyncResult) => {
    if (result.failed > 0) {
      const failedDetails = result.results.filter((r) => r.status === 'failed' || r.status === 'partial');
      const newOnes = failedDetails.filter(
        (r) => !seenErrorBatches.current.has(r.batchNumber) && !isNetworkError(r.error),
      );
      if (newOnes.length) {
        newOnes.forEach((r) => seenErrorBatches.current.add(r.batchNumber));
        setSyncErrorDetails((prev) => [
          ...prev,
          ...newOnes.map((r) => ({
            batchNumber: r.batchNumber,
            error: r.error || '上傳失敗',
            epkIds: r.epkIds,
          })),
        ]);
        setShowSyncErrorModal(true);
      }
    } else {
      setSyncErrorDetails([]);
      seenErrorBatches.current.clear();
    }
    if (result.synced > 0) {
      showToast(`已同步${result.synced} 筆`, 2000);
    }
    if (result.failed === 0 && result.synced === 0) {
      showToast('目前沒有待同步批次', 1800);
    }
  };

  const attemptSync = async () => {
    try {
      setSyncing(true);
      const result = await syncQueuedBatches(session, { mode });
      await refreshQueue();
      handleSyncResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失敗';
      if (isNetworkError(message)) {
        showToast(message);
      } else if (!seenErrorBatches.current.has(batchId)) {
        seenErrorBatches.current.add(batchId);
        setSyncErrorDetails((prev) => [...prev, { batchNumber: batchId, error: message }]);
        setShowSyncErrorModal(true);
      }
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
      setSyncErrorModal({ visible: true, details: [{ batchNumber: batchId, error: message }] });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title={`${batchId}  ${titleMode}`} onBack={onBack} rightIcon="settings-outline" onRightPress={() => setShowPower(true)} />
      <View style={styles.topStats}>
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={styles.statsLabel}>已掃描筆數</Text>
          <Text style={styles.statsNum}>{items.length}</Text>
          <Text style={styles.statsMeta}>倉庫：{warehouseName}</Text>
          <Text style={styles.statsMeta}>訂單編號：{orderNumber || '—'}</Text>
          <Text style={styles.pending}>待同步批次：{pendingCount}</Text>
          <Text style={styles.pending}>
            有效：{validCount}　無效：{invalidCount}　總計：{items.length}
          </Text>
        </View>
        <View style={styles.badgeColumn}>
          <TouchableOpacity style={styles.badgeBtn} onPress={() => setShowInvalidModal(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.text} />
            <Text style={styles.badgeText}>{invalidCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.badgeBtn, { marginTop: spacing.sm }]} onPress={() => setShowSyncErrorModal(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
            <Text style={[styles.badgeText, { color: '#dc2626' }]}>{syncErrorDetails.length}</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={[styles.itemText, item.status === 'invalid' && { color: '#dc2626' }]}>
              {item.id}
              {item.status === 'invalid' ? '（無效）' : ''}
            </Text>
            <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-outline" size={18} color={colors.mutedText} />
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
      </View>

      <ManualInputModal visible={manual} onClose={() => setManual(false)} onAdd={(value) => handleManualInput(value)} />
      <Toast visible={!!toast} message={toast || ''} />

      <Modal visible={showPower} animationType="slide">
        <SettingsHardwareScreen onBack={() => setShowPower(false)} />
      </Modal>

      <Modal visible={showInvalidModal} animationType="slide" onRequestClose={() => setShowInvalidModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <HeaderBar title="無效掃描記錄" onBack={() => setShowInvalidModal(false)} />
          <FlatList
            data={invalidList}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item, index }) => (
              <View style={styles.rowItem}>
                <View style={styles.indexBubble}>
                  <Text style={{ color: colors.text }}>{index + 1}</Text>
                </View>
                <Text style={[styles.itemText, { color: '#dc2626' }]}>{item.id}（無效）</Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Ionicons name="information-circle-outline" size={36} color={colors.mutedText} />
                <Text style={{ color: colors.mutedText, marginTop: spacing.md }}>目前沒有無效記錄</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showSyncErrorModal} animationType="slide" onRequestClose={() => setShowSyncErrorModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <HeaderBar title="上傳失敗詳情" onBack={() => setShowSyncErrorModal(false)} />
          <FlatList
            data={syncErrorDetails}
            keyExtractor={(item, idx) => `${item.batchNumber}-${idx}`}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <View style={[styles.errorCard, { borderColor: '#dc2626' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.indexBubble}>
                    <Ionicons name="warning-outline" size={16} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemText, { color: '#dc2626', fontWeight: '700' }]}>批次 {item.batchNumber}</Text>
                    <Text style={{ color: colors.text, marginTop: 4 }}>原因：{item.error}</Text>
                  </View>
                  {item.epkIds && item.epkIds.length ? (
                    <TouchableOpacity
                      onPress={() => {
                        const next = new Set(expandedErrors);
                        if (next.has(item.batchNumber)) next.delete(item.batchNumber);
                        else next.add(item.batchNumber);
                        setExpandedErrors(next);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={expandedErrors.has(item.batchNumber) ? 'chevron-up-outline' : 'chevron-down-outline'}
                        size={18}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {item.epkIds && item.epkIds.length && expandedErrors.has(item.batchNumber) ? (
                  <View style={styles.epcWrap}>
                    {item.epkIds.map((epc, idx) => (
                      <View key={`${epc}-${idx}`} style={styles.epcChip}>
                        <Text style={styles.epcText}>{epc}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Ionicons name="information-circle-outline" size={36} color={colors.mutedText} />
                <Text style={{ color: colors.mutedText, marginTop: spacing.md }}>目前沒有失敗紀錄</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topStats: {
    backgroundColor: '#EAEEF3',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    position: 'relative',
  },
  statsLabel: { color: colors.mutedText },
  statsNum: { marginTop: spacing.sm, fontSize: 56, fontWeight: '700', color: colors.text },
  statsMeta: { marginTop: 4, color: colors.mutedText },
  pending: { marginTop: 4, color: colors.text, fontWeight: '600' },
  badgeColumn: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
    alignItems: 'flex-end',
  },
  badgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  badgeText: { marginLeft: 4, color: colors.text, fontWeight: '600' },
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
  errorCard: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#fff',
  },
  epcWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  epcChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  epcText: { color: colors.text, fontSize: 12, fontFamily: 'monospace' },
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
