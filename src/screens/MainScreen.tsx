import React, { useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  userId: string;
  onLogout: () => void;
};

export default function MainScreen({ userId, onLogout }: Props) {
  const [wh, setWh] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const whOptions = useMemo(
    () => [
      { label: '倉庫 A - 主倉', value: 'A' },
      { label: '倉庫 B - 副倉', value: 'B' },
      { label: '倉庫 C - 臨時倉', value: 'C' },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { label: '入庫', value: 'IN' },
      { label: '出庫', value: 'OUT' },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <Ionicons name="person-outline" size={20} color="#fff" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerCaption}>操作人員</Text>
          <Text style={styles.headerUser}>{userId}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onLogout} accessibilityLabel="登出">
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>建立新批次</Text>
          <Text style={styles.cardSub}>選擇倉庫和作業類型後開始掃描</Text>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>倉庫 *</Text>
            <Select
              placeholder="請選擇倉庫"
              value={wh}
              onChange={setWh}
              options={whOptions}
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>狀態 *</Text>
            <Select
              placeholder="請選擇狀態"
              value={status}
              onChange={setStatus}
              options={statusOptions}
            />
          </View>

          <Pressable style={styles.primaryBtn}>
            <Ionicons
              name="scan-outline"
              size={18}
              color="#fff"
              style={{ marginRight: spacing.md }}
            />
            <Text style={styles.primaryBtnText}>開始掃描</Text>
          </Pressable>
        </View>

        <View style={styles.quickRow}>
          <Pressable style={styles.quickTile}>
            <Ionicons name="time-outline" size={20} color={colors.text} />
            <Text style={styles.quickLabel}>掃描歷史</Text>
          </Pressable>

          <Pressable style={styles.quickTile}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <Text style={styles.quickLabel}>系統設定</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: { marginLeft: spacing.md },
  headerCaption: { color: '#CBD5E1', fontSize: typography.caption },
  headerUser: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSub: { marginTop: 4, color: colors.mutedText, fontSize: typography.body },
  label: { color: colors.text, fontSize: typography.label, marginBottom: spacing.sm },
  placeholder: { color: colors.placeholder, fontSize: typography.body },
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
  quickRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xxl },
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
});

type SelectOption = { label: string; value: string };

type SelectProps = {
  value: string | null;
  onChange: (v: string) => void;
  placeholder: string;
  options: SelectOption[];
};

function Select({ value, onChange, placeholder, options }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const ref = useRef<View>(null);

  const label = useMemo(() => options.find(o => o.value === value)?.label, [value, options]);

  const onOpen = () => {
    ref.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable ref={ref} onPress={onOpen} style={selectStyles.base}>
        <Text style={[selectStyles.valueText, !label && { color: colors.placeholder }]}>
          {label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.mutedText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={selectStyles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[selectStyles.menu, {
              position: 'absolute',
              top: anchor.y + anchor.h + 4,
              left: Math.max(8, anchor.x),
              width: Math.min(anchor.w, Dimensions.get('window').width - 16),
            }]}
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

