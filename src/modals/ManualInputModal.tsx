import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (code: string) => string | null;
};

export default function ManualInputModal({ visible, onClose, onAdd }: Props) {
  const [value, setValue] = useState('');

  const handleClose = () => {
    setValue('');
    onClose();
  };

  const submit = () => {
    const message = onAdd(value);
    if (message) {
      return;
    }
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={styles.card}>
          <Text style={styles.title}>輸入包裝資料</Text>
          <Text style={styles.sub}>可輸入掃描到的任何字串，不再限制格式。</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="例：EBGA0000001"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoFocus
          />
          <View style={styles.row}>
            <PrimaryButton title="取消" light onPress={handleClose} style={{ flex: 1 }} />
            <View style={{ width: spacing.lg }} />
            <PrimaryButton title="加入" onPress={submit} style={{ flex: 1 }} icon="checkmark" />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    width: '100%',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { marginTop: 6, color: colors.mutedText, fontSize: typography.caption },
  input: {
    marginTop: spacing.lg,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    fontSize: typography.body,
  },
  row: { flexDirection: 'row', marginTop: spacing.xl },
});
