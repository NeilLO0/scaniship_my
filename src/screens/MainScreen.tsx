import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme';
import { Session } from '../storage/session';
import { fetchLogisticBranches, LogisticBranch } from '../services/logistics';

type Props = {
  session: Session;
  onLogout: () => void;
  onStartScan?: (args: { mode: 'IN' | 'OUT'; warehouseLabel: string; branch: LogisticBranch; orderNo?: string }) => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
};

export default function MainScreen({ session, onLogout, onStartScan, onOpenHistory, onOpenSettings }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [status, setStatus] = useState<'IN' | 'OUT' | null>(null);
  const [orderNo, setOrderNo] = useState('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [branches, setBranches] = useState<LogisticBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setBranchesLoading(true);
    setBranchesError(null);
    fetchLogisticBranches(session.user.id, session.token)
      .then((data) => {
        if (!mounted) return;
        setBranches(data);
      })
      .catch((error) => mounted && setBranchesError(error instanceof Error ? error.message : '讀取節點失敗'))
      .finally(() => mounted && setBranchesLoading(false));
    return () => {
      mounted = false;
    };
  }, [session.user.id, session.token]);

  const branchOptions = useMemo(
    () =>
      branches.map((item) => ({
        label: item.label,
        value: String(item.branch_id ?? item.id),
      })),
    [branches],
  );

  const statusOptions = useMemo(
    () => [
      { label: '入庫', value: 'IN' as const },
      { label: '出庫', value: 'OUT' as const },
    ],
    [],
  );

  const selectedBranch = useMemo(
    () => branches.find((item) => String(item.branch_id ?? item.id) === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const startDisabled = !selectedBranch || !status || (status === 'OUT' && !orderNo.trim());

  const handleStart = () => {
    if (!onStartScan || !selectedBranch || !status) return;
    if (status === 'OUT' && !orderNo.trim()) {
      setOrderError('出庫作業需輸入訂單編號');
      return;
    }
    setOrderError(null);
    onStartScan({
      mode: status,
      warehouseLabel: selectedBranch.label,
      branch: selectedBranch,
      orderNo: orderNo.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <Ionicons name="person-outline" size={20} color="#fff" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerCaption}>操作人員</Text>
          <Text style={styles.headerUser}>{session.user.account}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onLogout} accessibilityLabel="登出">
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>建立新批次</Text>
          <Text style={styles.cardSub}>選擇倉庫與狀態後即可開始掃描</Text>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>倉庫 *</Text>
            <Select
              placeholder={branchesLoading ? '讀取中…' : '請選擇倉庫'}
              value={selectedBranchId}
              onChange={(value) => setSelectedBranchId(value)}
              options={branchOptions}
              disabled={branchesLoading || !branchOptions.length}
            />
            {branchesError ? <Text style={styles.error}>{branchesError}</Text> : null}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>狀態 *</Text>
            <Select
              placeholder="請選擇狀態"
              value={status}
              onChange={(value) => setStatus(value as 'IN' | 'OUT')}
              options={statusOptions}
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>訂單編號 (出庫必填)</Text>
            <TextInput
              value={orderNo}
              onChangeText={(text) => {
                setOrderNo(text);
                if (text) setOrderError(null);
              }}
              placeholder="輸入訂單編號"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
            {orderError ? <Text style={styles.error}>{orderError}</Text> : null}
          </View>

          <Pressable style={[styles.primaryBtn, startDisabled && { opacity: 0.5 }]} onPress={handleStart} disabled={startDisabled}>
            <Ionicons name="scan-outline" size={18} color="#fff" style={{ marginRight: spacing.md }} />
            <Text style={styles.primaryBtnText}>開始掃描</Text>
          </Pressable>
        </View>

        <View style={styles.quickRow}>
          <Pressable style={styles.quickTile} onPress={onOpenHistory}>
            <Ionicons name="time-outline" size={20} color={colors.text} />
            <Text style={styles.quickLabel}>掃描紀錄</Text>
          </Pressable>

          <Pressable style={styles.quickTile} onPress={onOpenSettings}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <Text style={styles.quickLabel}>系統設定</Text>
          </Pressable>
        </View>

        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>API 節點回傳</Text>
          {branchesLoading ? (
            <Text style={styles.debugText}>讀取中...</Text>
          ) : branchesError ? (
            <Text style={[styles.debugText, { color: '#DC2626' }]}>{branchesError}</Text>
          ) : branches.length ? (
            <Text style={styles.debugJson}>{JSON.stringify(branches, null, 2)}</Text>
          ) : (
            <Text style={styles.debugText}>尚未取得節點資料</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTextWrap: { marginLeft: spacing.md },
  headerCaption: { color: '#fff', opacity: 0.7, fontSize: 12 },
  headerUser: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  body: { flex: 1, padding: spacing.xl, gap: spacing.xl },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSub: { marginTop: 4, color: colors.mutedText, fontSize: typography.body },
  label: { color: colors.text, fontSize: typography.label, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    fontSize: typography.body,
  },
  primaryBtn: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnText: { color: '#fff', fontSize: typography.button, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: spacing.lg },
  quickTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { marginTop: spacing.sm, color: colors.text },
  debugBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: spacing.lg,
    backgroundColor: '#fff',
  },
  debugTitle: { fontWeight: '600', marginBottom: spacing.sm, color: colors.text },
  debugText: { color: colors.mutedText },
  debugJson: { color: colors.text, fontFamily: 'monospace', fontSize: 12 },
  error: { color: '#DC2626', marginTop: spacing.sm },
});

type SelectOption = { label: string; value: string };

type SelectProps = {
  value: string | null;
  onChange: (v: string) => void;
  placeholder: string;
  options: SelectOption[];
  disabled?: boolean;
};

function Select({ value, onChange, placeholder, options, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const ref = useRef<View>(null);

  const label = useMemo(() => options.find((o) => o.value === value)?.label, [value, options]);

  const onOpen = () => {
    if (disabled) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable
        ref={ref}
        onPress={onOpen}
        style={[selectStyles.base, disabled && selectStyles.disabled]}
        accessibilityState={{ disabled }}
      >
        <Text style={[selectStyles.valueText, !label && { color: colors.placeholder }]}>
          {label || placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.mutedText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={selectStyles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              selectStyles.menu,
              {
                position: 'absolute',
                top: anchor.y + anchor.h + 4,
                left: Math.max(8, anchor.x),
                width: Math.min(anchor.w, Dimensions.get('window').width - 16),
              },
            ]}
          >
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [selectStyles.item, pressed && selectStyles.itemPressed]}
              >
                <Text style={selectStyles.itemText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const selectStyles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.6,
  },
  valueText: { color: colors.text, fontSize: typography.body },
  backdrop: { flex: 1 },
  menu: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  item: { paddingVertical: 10, paddingHorizontal: spacing.lg },
  itemPressed: { backgroundColor: '#EEF2FF' },
  itemText: { color: colors.text },
});
