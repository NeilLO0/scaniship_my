import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../theme';

type Props = {
  title?: string;
  onBack?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
};

export default function HeaderBar({ title, onBack, rightIcon, onRightPress }: Props) {
  return (
    <View style={styles.header}>
      <View style={{ width: 32 }}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityLabel="返回">
            <Ionicons name="chevron-back-outline" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 32, alignItems: 'flex-end' }}>
        {rightIcon ? (
          <Pressable onPress={onRightPress} accessibilityLabel="操作">
            <Ionicons name={rightIcon as any} size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
