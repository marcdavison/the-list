import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, CenteredMessage, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SignedIn } from '@/hooks/use-auth';
import { useMyLists } from '@/hooks/use-lists';
import { useTheme } from '@/hooks/use-theme';
import { createList, deleteList, leaveList, MAX_NAME_LENGTH, type ShoppingList } from '@/lib/lists';

export default function MyListsScreen() {
  return <SignedIn>{(uid) => <MyLists uid={uid} />}</SignedIn>;
}

function MyLists({ uid }: { uid: string }) {
  const { data: lists, loading, error } = useMyLists(uid);
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const id = createList(name);
    setName('');
    router.push({ pathname: '/list/[id]', params: { id } });
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // 0 because the translucent header means this view already starts at the top of the screen.
        keyboardVerticalOffset={0}>
        <FlatList
          data={lists}
          keyExtractor={(l) => l.id}
          // iOS: inset content below the translucent native header (and status bar).
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          renderItem={({ item }) => <ListRow list={item} isOwner={item.ownerId === uid} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            loading ? (
              <CenteredMessage loading />
            ) : error ? (
              <CenteredMessage title="Couldn't load your lists" body={error.message} />
            ) : (
              <CenteredMessage
                title="No lists yet"
                body="Create a list below, then share the link so others can add to it."
              />
            )
          }
        />
        <SafeAreaView edges={['bottom']} style={styles.composerWrap}>
          <View style={styles.composer}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="New list name"
              maxLength={MAX_NAME_LENGTH}
              returnKeyType="done"
              onSubmitEditing={create}
            />
            <Button title="Create" onPress={create} disabled={!name.trim()} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function ListRow({ list, isOwner }: { list: ShoppingList; isOwner: boolean }) {
  const theme = useTheme();
  const others = list.memberIds.length - 1;

  const confirmRemove = () => {
    if (isOwner) {
      Alert.alert(`Delete "${list.name}"?`, 'This removes it for everyone it is shared with.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteList(list.id).catch(() => Alert.alert('Delete failed', 'Check your connection and try again.')),
        },
      ]);
    } else {
      Alert.alert(`Leave "${list.name}"?`, 'You can rejoin with the share link.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveList(list.id) },
      ]);
    }
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
      onLongPress={confirmRemove}
      accessibilityHint={isOwner ? 'Long press to delete' : 'Long press to leave'}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <ThemedText numberOfLines={1}>{list.name || 'Untitled list'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {others > 0 ? `Shared with ${others} ${others === 1 ? 'person' : 'people'}` : 'Only you'}
        {isOwner ? '' : ' · Shared with you'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: { padding: Spacing.three, borderRadius: 12, gap: Spacing.half },
  composerWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  composer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
