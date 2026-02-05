import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { sentryBridge } from '../../native/sentry';

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

type SyncErrorDetail = { batchNumber: string; error: string; epkIds?: string[]; createdAt: number };
type SyncProgress = { done: number; total: number; batchNumber?: string };

const ERROR_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_SYNC_ERRORS = 50;
const INVALID_PAGE_SIZE = 50;
const ERROR_EPC_PAGE_SIZE = 50;
const MAX_ITEMS = 1000;
const MEMORY_TRIM_TARGET = 300;
const ITEM_FLUSH_MS = 200;
const PROGRESS_THROTTLE_MS = 200;
const HIGH_WATER_MARK = 400;

const reportScanError = (context: string, error: unknown, extra?: Record<string, string | number | boolean>) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown');
  const extraText = extra
    ? ` | ${Object.entries(extra)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : '';
  sentryBridge.captureMessage(`ScanScreen:${context} ${message}${extraText}`, 'error');
};

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
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [powerPct, setPowerPct] = useState(75);
  const [showPower, setShowPower] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [syncErrorDetails, setSyncErrorDetails] = useState<SyncErrorDetail[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [invalidPage, setInvalidPage] = useState(0);
  const [errorEpcPageByBatch, setErrorEpcPageByBatch] = useState<Record<string, number>>({});
  const seenErrorBatches = useRef<Set<string>>(new Set());

  const seen = useRef<Set<string>>(new Set());
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const flushTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingAdds = useRef<Item[]>([]);
  const itemsCountRef = useRef(0);
  const progressTsRef = useRef(0);
  const lastButtonTs = useRef<number>(0);
  const toggling = useRef<boolean>(false);
  const lastHighWaterReport = useRef<number>(0);
  const hardwareAvailable = uhf.isAvailable;

  const titleMode = useMemo(() => (mode === 'IN' ? '入庫' : '出庫'), [mode]);
  const validCount = useMemo(() => items.filter((i) => i.status === 'valid').length, [items]);
  const invalidCount = useMemo(() => items.filter((i) => i.status === 'invalid').length, [items]);
  const invalidList = useMemo(() => items.filter((i) => i.status === 'invalid'), [items]);
  const invalidTotalPages = useMemo(
    () => Math.max(1, Math.ceil(invalidList.length / INVALID_PAGE_SIZE)),
    [invalidList.length],
  );
  const invalidPageItems = useMemo(() => {
    const start = invalidPage * INVALID_PAGE_SIZE;
    return invalidList.slice(start, start + INVALID_PAGE_SIZE);
  }, [invalidList, invalidPage]);

  useEffect(() => {
    if (invalidPage >= invalidTotalPages) {
      setInvalidPage(Math.max(0, invalidTotalPages - 1));
    }
  }, [invalidPage, invalidTotalPages]);

  useEffect(() => {
    itemsCountRef.current = items.length;
  }, [items.length]);

  const getErrorEpcPage = useCallback(
    (batchNumber: string) => errorEpcPageByBatch[batchNumber] ?? 0,
    [errorEpcPageByBatch],
  );

  const setErrorEpcPage = useCallback((batchNumber: string, page: number) => {
    setErrorEpcPageByBatch((prev) => ({ ...prev, [batchNumber]: page }));
  }, []);

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

  const pruneErrorDetails = useCallback(() => {
    const cutoff = Date.now() - ERROR_RETENTION_MS;
    setSyncErrorDetails((prev) => {
      const filtered = prev.filter((item) => item.createdAt >= cutoff);
      if (filtered.length !== prev.length) {
        seenErrorBatches.current = new Set(filtered.map((item) => item.batchNumber));
        setErrorEpcPageByBatch({});
      }
      return filtered;
    });
  }, []);

  useEffect(() => {
    pruneErrorDetails();
    const interval = setInterval(pruneErrorDetails, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pruneErrorDetails]);

  const refreshQueue = useCallback(async () => {
    try {
      const count = await getQueueCountFor(session.user.account, mode);
      setPendingCount(count);
    } catch (error) {
      reportScanError('refreshQueue', error, { mode, account: session.user.account });
    }
  }, [mode, session.user.account]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const sortItems = useCallback((list: Item[]) => [...list].sort((a, b) => a.id.localeCompare(b.id)), []);

  const flushItems = useCallback(() => {
    if (!pendingAdds.current.length) return;
    const nextItems = pendingAdds.current;
    pendingAdds.current = [];
    setItems((prev) => {
      const merged = [...prev, ...nextItems];
      if (merged.length > MAX_ITEMS) {
        merged.splice(MAX_ITEMS);
      }
      return sortItems(merged);
    });
  }, [sortItems]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      flushItems();
    }, ITEM_FLUSH_MS);
  }, [flushItems]);

  const appendItem = (code: string) => {
    if (seen.current.has(code)) {
      return;
    }
    const currentCount = itemsCountRef.current + pendingAdds.current.length;
    if (currentCount >= MAX_ITEMS) {
      showToast(`清單已達上限 ${MAX_ITEMS} 筆，請先上傳或清空`);
      if (Date.now() - lastHighWaterReport.current > 60 * 1000) {
        lastHighWaterReport.current = Date.now();
        sentryBridge.captureMessage(
          `ScanScreen:high_water items=${itemsCountRef.current} pendingAdds=${pendingAdds.current.length}`,
          'warning',
        );
      }
      return;
    }
    if (currentCount + 1 >= HIGH_WATER_MARK && Date.now() - lastHighWaterReport.current > 60 * 1000) {
      lastHighWaterReport.current = Date.now();
      sentryBridge.captureMessage(
        `ScanScreen:high_water items=${itemsCountRef.current} pendingAdds=${pendingAdds.current.length}`,
        'warning',
      );
    }
    seen.current.add(code);
    pendingAdds.current.push({ id: code, status: 'valid' });
    scheduleFlush();
  };

  const appendInvalid = (code: string, message?: string) => {
    if (seen.current.has(code)) return;
    const currentCount = itemsCountRef.current + pendingAdds.current.length;
    if (currentCount >= MAX_ITEMS) {
      showToast(`清單已達上限 ${MAX_ITEMS} 筆，請先上傳或清空`);
      if (Date.now() - lastHighWaterReport.current > 60 * 1000) {
        lastHighWaterReport.current = Date.now();
        sentryBridge.captureMessage(
          `ScanScreen:high_water items=${itemsCountRef.current} pendingAdds=${pendingAdds.current.length}`,
          'warning',
        );
      }
      return;
    }
    if (currentCount + 1 >= HIGH_WATER_MARK && Date.now() - lastHighWaterReport.current > 60 * 1000) {
      lastHighWaterReport.current = Date.now();
      sentryBridge.captureMessage(
        `ScanScreen:high_water items=${itemsCountRef.current} pendingAdds=${pendingAdds.current.length}`,
        'warning',
      );
    }
    seen.current.add(code);
    pendingAdds.current.push({ id: code, status: 'invalid' });
    scheduleFlush();
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
    pendingAdds.current = pendingAdds.current.filter((item) => item.id !== id);
    setItems((prev) => sortItems(prev.filter((item) => item.id !== id)));
  };

  const clearAll = () => {
    setItems([]);
    seen.current.clear();
    pendingAdds.current = [];
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (hardwareAvailable) uhf.clear();
  };

  const clearPendingQueue = async () => {
    try {
      await clearQueueForMode(session.user.account, mode);
      await refreshQueue();
      setSyncErrorDetails([]);
      seenErrorBatches.current.clear();
      setErrorEpcPageByBatch({});
      setShowSyncErrorModal(false);
      showToast('已清除待同步批次');
    } catch (error) {
      reportScanError('clearPendingQueue', error, { mode, account: session.user.account });
      showToast('清除待同步批次失敗');
    }
  };

  const handleMemoryPressure = useCallback(
    (reason: string) => {
      if (scanning) {
        toggleScan();
      }
      if (pendingAdds.current.length) {
        pendingAdds.current = [];
      }
      if (itemsCountRef.current > MEMORY_TRIM_TARGET) {
        setItems((prev) => {
          const validOnly = prev.filter((item) => item.status === 'valid');
          const trimmed = validOnly.slice(0, MEMORY_TRIM_TARGET);
          seen.current = new Set(trimmed.map((item) => item.id));
          return trimmed;
        });
        showToast('記憶體不足，已自動精簡掃描清單');
      }
      sentryBridge.captureMessage(
        `ScanScreen:memory_pressure reason=${reason} items=${itemsCountRef.current} pendingAdds=${pendingAdds.current.length}`,
        'warning',
      );
    },
    [scanning, toggleScan],
  );

  useEffect(() => {
    const sub = (AppState as any).addEventListener?.('memoryWarning', () => handleMemoryPressure('memoryWarning'));
    return () => {
      sub?.remove?.();
    };
  }, [handleMemoryPressure]);

  const toggleScan = useCallback(() => {
    if (toggling.current) return;
    toggling.current = true;
    setScanning((value) => {
      const next = !value;
      try {
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
      } catch (error) {
        reportScanError('toggleScan', error, { mode, hardwareAvailable: String(hardwareAvailable) });
      }
      return next;
    });
    setTimeout(() => {
      toggling.current = false;
    }, 300);
  }, [hardwareAvailable, percentToDbm, powerPct]);

  useEffect(() => {
    if (!hardwareAvailable) return;
    try {
      uhf.init();
    } catch (error) {
      reportScanError('uhf:init', error);
    }
    const tagSub = uhf.onTags((values: string[]) => {
      try {
        if (!Array.isArray(values)) return;
        values.forEach((epc) => {
          if (typeof epc !== 'string' || !epc.trim()) {
            appendInvalid(String(epc ?? ''));
            return;
          }
          try {
            const pkg = normalizeToPackageId(epc);
            appendItem(pkg);
          } catch (error) {
            const message = error instanceof Error ? error.message : '未知錯誤';
            appendInvalid(epc, message);
          }
        });
      } catch (error) {
        reportScanError('uhf:onTags', error);
      }
    });
    const btnSub = uhf.onButton(() => {
      try {
        const now = Date.now();
        if (now - lastButtonTs.current < 700) return;
        lastButtonTs.current = now;
        toggleScan();
      } catch (error) {
        reportScanError('uhf:onButton', error);
      }
    });
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      tagSub?.remove?.();
      btnSub?.remove?.();
      uhf.stop();
      uhf.clear();
      uhf.dispose();
    };
  }, [hardwareAvailable, toggleScan]);

  useEffect(() => {
    sentryBridge.setTag('warehouse', warehouseName);
    sentryBridge.setTag('mode', mode);
    return () => {
      sentryBridge.setTag('warehouse', null);
      sentryBridge.setTag('mode', null);
    };
  }, [mode, warehouseName]);

  const createBatchRecord = (): QueuedBatch => {
    try {
      const now = new Date();
      const allItems = pendingAdds.current.length ? [...items, ...pendingAdds.current] : items;
      const validEpkIds = allItems.filter((item) => item.status === 'valid').map((item) => item.id);
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
    } catch (error) {
      reportScanError('createBatchRecord', error, { mode, warehouse: warehouseName });
      throw error;
    }
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
        const createdAt = Date.now();
        const newEntries: SyncErrorDetail[] = newOnes.map((r) => ({
          batchNumber: r.batchNumber,
          error: r.error || '上傳失敗',
          epkIds: r.epkIds,
          createdAt,
        }));
        setSyncErrorDetails((prev) => {
          const merged = [...prev, ...newEntries];
          const trimmed = merged.slice(-MAX_SYNC_ERRORS);
          if (trimmed.length !== merged.length) {
            setErrorEpcPageByBatch({});
          }
          seenErrorBatches.current = new Set(trimmed.map((item) => item.batchNumber));
          return trimmed;
        });
        setShowSyncErrorModal(true);
      }
    } else {
      setSyncErrorDetails([]);
      seenErrorBatches.current.clear();
      setErrorEpcPageByBatch({});
    }
    if (result.synced > 0) {
      showToast(`已同步${result.synced} 筆`, 2000);
    }
    if (result.error && isNetworkError(result.error)) {
      showToast(result.error);
    }
    if (result.failed === 0 && result.synced === 0) {
      showToast('目前沒有待同步批次', 1800);
    }
  };

  const attemptSync = async () => {
    try {
      setSyncing(true);
      setSyncProgress({ done: 0, total: 0 });
      const result = await syncQueuedBatches(session, {
        mode,
        onProgress: (progress) => {
          const now = Date.now();
          if (
            now - progressTsRef.current >= PROGRESS_THROTTLE_MS ||
            (progress.total > 0 && progress.done === progress.total)
          ) {
            progressTsRef.current = now;
            setSyncProgress(progress);
          }
        },
      });
      await refreshQueue();
      handleSyncResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失敗';
      reportScanError('attemptSync', error, { mode, batchId });
      if (isNetworkError(message)) {
        showToast(message);
      } else if (!seenErrorBatches.current.has(batchId)) {
        seenErrorBatches.current.add(batchId);
        setSyncErrorDetails((prev) => {
          const merged = [
            ...prev,
            { batchNumber: batchId, error: message, createdAt: Date.now() } as SyncErrorDetail,
          ];
          const trimmed = merged.slice(-MAX_SYNC_ERRORS);
          if (trimmed.length !== merged.length) {
            setErrorEpcPageByBatch({});
          }
          seenErrorBatches.current = new Set(trimmed.map((item) => item.batchNumber));
          return trimmed;
        });
        setShowSyncErrorModal(true);
      }
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleUpload = async () => {
    if (__DEV__) {
      console.log('[Scan] upload tap', { items: items.length, pendingCount, mode, orderNumber });
    }
    const totalItems = items.length + pendingAdds.current.length;
    if (totalItems >= HIGH_WATER_MARK && Date.now() - lastHighWaterReport.current > 60 * 1000) {
      lastHighWaterReport.current = Date.now();
      sentryBridge.captureMessage(
        `ScanScreen:high_water items=${items.length} pendingAdds=${pendingAdds.current.length} pendingBatches=${pendingCount}`,
        'warning',
      );
    }
    if (scanning) {
      toggleScan();
    }
    if (totalItems > MAX_ITEMS) {
      showToast(`單批上限 ${MAX_ITEMS} 筆，請分批再上傳`);
      return;
    }
    if (!totalItems) {
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
      reportScanError('handleUpload', error, { mode, batchId, count: totalItems });
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
        removeClippedSubviews
        windowSize={7}
        maxToRenderPerBatch={20}
        initialNumToRender={20}
        updateCellsBatchingPeriod={50}
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
        {syncProgress && syncProgress.total > 0 ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.round((syncProgress.done / syncProgress.total) * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              已上傳 {syncProgress.done}/{syncProgress.total} 批
              {syncProgress.batchNumber ? ` · 批次 ${syncProgress.batchNumber}` : ''}
            </Text>
          </View>
        ) : null}
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
            data={invalidPageItems}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={20}
            initialNumToRender={20}
            updateCellsBatchingPeriod={50}
            ListHeaderComponent={() =>
              invalidList.length > INVALID_PAGE_SIZE ? (
                <View style={styles.paginationRow}>
                  <Text style={styles.paginationText}>
                    共 {invalidList.length} 筆 · 第 {invalidPage + 1}/{invalidTotalPages} 頁
                  </Text>
                  <View style={styles.paginationButtons}>
                    <TouchableOpacity
                      style={[styles.paginationBtn, invalidPage === 0 && styles.paginationBtnDisabled]}
                      disabled={invalidPage === 0}
                      onPress={() => setInvalidPage((prev) => Math.max(0, prev - 1))}
                    >
                      <Text style={styles.paginationBtnText}>上一頁</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.paginationBtn, invalidPage + 1 >= invalidTotalPages && styles.paginationBtnDisabled]}
                      disabled={invalidPage + 1 >= invalidTotalPages}
                      onPress={() => setInvalidPage((prev) => Math.min(invalidTotalPages - 1, prev + 1))}
                    >
                      <Text style={styles.paginationBtnText}>下一頁</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <View style={styles.rowItem}>
                <View style={styles.indexBubble}>
                  <Text style={{ color: colors.text }}>{invalidPage * INVALID_PAGE_SIZE + index + 1}</Text>
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
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={20}
            initialNumToRender={20}
            updateCellsBatchingPeriod={50}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => {
              const epkIds = item.epkIds ?? [];
              const totalPages = Math.max(1, Math.ceil(epkIds.length / ERROR_EPC_PAGE_SIZE));
              const rawPage = getErrorEpcPage(item.batchNumber);
              const page = Math.min(rawPage, totalPages - 1);
              const pageItems = epkIds.slice(page * ERROR_EPC_PAGE_SIZE, page * ERROR_EPC_PAGE_SIZE + ERROR_EPC_PAGE_SIZE);
              return (
                <View style={[styles.errorCard, { borderColor: '#dc2626' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.indexBubble}>
                      <Ionicons name="warning-outline" size={16} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemText, { color: '#dc2626', fontWeight: '700' }]}>
                        批次 {item.batchNumber}
                      </Text>
                      <Text style={{ color: colors.text, marginTop: 4 }}>原因：{item.error}</Text>
                    </View>
                    {epkIds.length ? (
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

                  {epkIds.length && expandedErrors.has(item.batchNumber) ? (
                    <>
                      {totalPages > 1 ? (
                        <View style={[styles.paginationRow, { marginTop: spacing.sm }]}>
                          <Text style={styles.paginationText}>
                            EPC 第 {page + 1}/{totalPages} 頁（每頁 {ERROR_EPC_PAGE_SIZE} 筆）
                          </Text>
                          <View style={styles.paginationButtons}>
                            <TouchableOpacity
                              style={[styles.paginationBtn, page === 0 && styles.paginationBtnDisabled]}
                              disabled={page === 0}
                              onPress={() => setErrorEpcPage(item.batchNumber, Math.max(0, page - 1))}
                            >
                              <Text style={styles.paginationBtnText}>上一頁</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.paginationBtn, page + 1 >= totalPages && styles.paginationBtnDisabled]}
                              disabled={page + 1 >= totalPages}
                              onPress={() => setErrorEpcPage(item.batchNumber, Math.min(totalPages - 1, page + 1))}
                            >
                              <Text style={styles.paginationBtnText}>下一頁</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.epcWrap}>
                        {pageItems.map((epc, idx) => (
                          <View key={`${epc}-${idx}`} style={styles.epcChip}>
                            <Text style={styles.epcText}>{epc}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                </View>
              );
            }}
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
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paginationButtons: { flexDirection: 'row' },
  paginationBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: '#F8FAFC',
    marginLeft: spacing.sm,
  },
  paginationBtnDisabled: { opacity: 0.5 },
  paginationBtnText: { color: colors.text, fontSize: 12 },
  paginationText: { color: colors.mutedText, fontSize: 12 },
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
  progressWrap: { marginTop: spacing.sm },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: { marginTop: 6, color: colors.mutedText, fontSize: 12 },
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
