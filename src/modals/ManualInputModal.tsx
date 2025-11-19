import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (code: string) => void;
};

export default function ManualInputModal({ visible, onClose, onAdd }: Props) {
  const [value, setValue] = useState('');

  const submit = () => {
    const v = value.trim();
    if (v) {
      onAdd(v);
      setValue('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>手動輸入包裝編號</Text>
          <Text style={styles.sub}>適用於 RFID 標籤損壞或無法讀取的情況</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="例如：EBGA0000001"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            style={styles.input}
          />
          <View style={styles.row}>
            <PrimaryButton title="取消" light onPress={onClose} style={{ flex: 1 }} />
            <View style={{ width: spacing.lg }} />
            <PrimaryButton title="新增" onPress={submit} style={{ flex: 1 }} icon="checkmark" />
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

