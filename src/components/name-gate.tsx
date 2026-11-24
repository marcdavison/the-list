import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { MAX_DISPLAY_NAME_LENGTH, setDisplayName } from '@/lib/profile';

/**
 * Full-screen "What's your name?" shown over the app until the user has a display name.
 * Rendered as an overlay (not a route) so share links opened on first launch still land
 * on the right screen underneath.
 */
export function NameGate() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  if (!user || profile?.displayName) return null;
  // Blank cover while the profile loads, so My Lists doesn't flash before the prompt.
  if (loading) return <ThemedView style={StyleSheet.absoluteFill} />;
  return <NamePrompt />;
}

function NamePrompt() {
  const [name, setName] = useState('');
  const save = () => setDisplayName(name);

  return (
    <ThemedView style={StyleSheet.absoluteFill}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <ThemedText type="subtitle">What&apos;s your name?</ThemedText>
          <ThemedText themeColor="textSecondary">
            People you share lists with will see it next to your comments.
          </ThemedText>
          <Input
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            autoComplete="name"
            textContentType="givenName"
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder="Your name"
            returnKeyType="done"
            onSubmitEditing={save}
            style={styles.input}
          />
          <Button title="Continue" onPress={save} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  card: { gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth / 2, alignSelf: 'center' },
  input: { flex: 0 },
});
