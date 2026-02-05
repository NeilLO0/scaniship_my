import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  title: string;
  onPress?: () => void;
  icon?: string;
  style?: ViewStyle;
  light?: boolean;
};

export default function PrimaryButton({ title, onPress, icon, style, light }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        light ? styles.light : styles.dark,
        { opacity: pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as any}
          size={18}
          color={light ? colors.text : '#fff'}
          style={{ marginRight: spacing.md }}
        />
      ) : null}
      <Text style={[styles.text, light && { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  dark: {
    backgroundColor: colors.primary,
  },
  light: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  text: {
    color: '#fff',
    fontSize: typography.button,
    fontWeight: '600',
  },
});

