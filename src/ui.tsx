import React from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

export const palette = {
  page: '#f2efe7',
  paper: '#faf8f2',
  card: '#f8f4e9',
  ink: '#302f29',
  muted: '#77746d',
  line: '#ded7ca',
  gold: '#947a56',
  accent: '#a56d54',
  green: '#43574a',
  danger: '#99564d',
  shadow: '#514a3d',
};

export function ActionButton({
  label,
  onPress,
  tone = 'secondary',
  compact = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  compact?: boolean;
  disabled?: boolean;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      compact && styles.buttonCompact,
      tone === 'primary' && styles.primary,
      tone === 'quiet' && styles.quiet,
      tone === 'danger' && styles.danger,
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
    ]}
  >
    <Text style={[styles.buttonText, tone === 'primary' && styles.primaryText, tone === 'quiet' && styles.quietText, tone === 'danger' && styles.dangerText]}>{label}</Text>
  </Pressable>;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  autoFocus = false,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  return <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#969187"
    multiline={multiline}
    autoFocus={autoFocus}
    accessibilityLabel={accessibilityLabel || placeholder}
    textAlignVertical={multiline ? 'top' : 'center'}
    style={[styles.input, multiline && styles.multiline]}
  />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: '#ebe6db' },
  buttonCompact: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  primary: { borderColor: palette.green, backgroundColor: palette.green },
  quiet: { borderColor: 'transparent', backgroundColor: 'transparent' },
  danger: { borderColor: '#e2c8c1', backgroundColor: '#f3e5e0' },
  disabled: { opacity: .45 },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
  buttonText: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  primaryText: { color: '#fffaf1' },
  quietText: { color: palette.muted },
  dangerText: { color: palette.danger },
  input: { width: '100%', minHeight: 48, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 12, color: palette.ink, fontSize: 15, marginVertical: 5 },
  multiline: { minHeight: 160, lineHeight: 23, paddingTop: 13 },
  section: { color: palette.ink, fontSize: 17, fontWeight: '700', marginTop: 18, marginBottom: 8 },
});

export const cardSurface = { backgroundColor: palette.paper, borderColor: palette.line, borderWidth: 1, borderRadius: 12 } as const;
