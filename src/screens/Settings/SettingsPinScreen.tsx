import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import HeaderBar from '../../components/HeaderBar';
import { colors, radius, spacing, typography } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = { onBack: () => void; onVerified: (target: 'hardware' | 'api') => void };

export default function SettingsPinScreen({ onBack, onVerified }: Props) {
  const [pin, setPin] = useState('');
  const target: 'hardware' | 'api' = 'hardware';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <HeaderBar title="系統設定" onBack={onBack} />
      <View style={{ padding: spacing.xl }}>
        <View style={styles.card}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.iconWrap}><Ionicons name="lock-closed-outline" color={colors.text} size={28} /></View>
            <Text style={styles.title}>需要驗證</Text>
            <Text style={styles.sub}>請輸入管理員密碼以繼續</Text>
          </View>

          <Text style={styles.label}>密碼</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="請輸入密碼"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            secureTextEntry
          />
          <PrimaryButton title="驗證" icon="checkmark-circle-outline" onPress={() => onVerified(target)} />
          <Text style={styles.hint}>預設密碼: admin123</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.inputBorder },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: spacing.md, fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { marginTop: 4, color: colors.mutedText, fontSize: typography.caption },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.text, fontSize: typography.label },
  input: { backgroundColor: colors.inputBg, borderRadius: radius.md, height: 48, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.inputBorder, marginBottom: spacing.lg },
  hint: { marginTop: spacing.md, color: colors.mutedText, fontSize: typography.caption, textAlign: 'center' },
});
