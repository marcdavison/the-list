import { ActivityIndicator, Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'plain';
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        primary && { backgroundColor: theme.accent },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <ThemedText style={{ color: primary ? theme.onAccent : theme.accent, fontWeight: 600 }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export type TextInputRef = React.ComponentRef<typeof TextInput>;

export function Input({ ref, ...props }: TextInputProps & { ref?: React.Ref<TextInputRef> }) {
  const theme = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.backgroundElement },
        props.style,
      ]}
    />
  );
}

export function CenteredMessage({
  title,
  body,
  loading,
  children,
}: {
  title?: string;
  body?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <ThemedView style={styles.centered}>
      {loading && <ActivityIndicator size="large" />}
      {title && <ThemedText type="smallBold" style={styles.centerText}>{title}</ThemedText>}
      {body && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {body}
        </ThemedText>
      )}
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: { textAlign: 'center' },
});
