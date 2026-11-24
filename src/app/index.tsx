import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/comments-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, CenteredMessage, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SignedIn } from '@/hooks/use-auth';
import { useItemCounts, useMyLists } from '@/hooks/use-lists';
import { useProfile } from '@/hooks/use-profile';
import { hasUnreadComments } from '@/lib/profile';
import { useTheme } from '@/hooks/use-theme';
import {
  createList,
  deleteList,
  leaveList,
  MAX_NAME_LENGTH,
  renameList,
  type ShoppingList,
} from '@/lib/lists';

export default function MyListsScreen() {
  return <SignedIn>{(uid) => <MyLists uid={uid} />}</SignedIn>;
}

function MyLists({ uid }: { uid: string }) {
  const { data: lists, loading, error } = useMyLists(uid);
  const [name, setName] = useState('');
  // Only one list can be renamed at a time.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [commentsListId, setCommentsListId] = useState<string | null>(null);
  // Looked up live so the sheet's title follows renames; closes if the list goes away.
  const commentsList = lists.find((l) => l.id === commentsListId) ?? null;

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
          // Lets the Save button receive taps while the keyboard is open.
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ListRow
              list={item}
              isOwner={item.ownerId === uid}
              renaming={renamingId === item.id}
              onRename={() => setRenamingId(item.id)}
              onRenameDone={() => setRenamingId(null)}
              onShowComments={() => setCommentsListId(item.id)}
            />
          )}
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
      <CommentsSheet list={commentsList} uid={uid} onClose={() => setCommentsListId(null)} />
    </ThemedView>
  );
}

function ListRow({
  list,
  isOwner,
  renaming,
  onRename,
  onRenameDone,
  onShowComments,
}: {
  list: ShoppingList;
  isOwner: boolean;
  renaming: boolean;
  onRename: () => void;
  onRenameDone: () => void;
  onShowComments: () => void;
}) {
  const theme = useTheme();
  const others = list.memberIds.length - 1;
  const counts = useItemCounts(list.id);
  const { profile } = useProfile();
  const unread = hasUnreadComments(list.lastCommentAt, profile, list.id);
  const [draft, setDraft] = useState(list.name);

  const startRename = () => {
    setDraft(list.name);
    onRename();
  };

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) return; // Save is disabled for an empty name
    if (trimmed !== list.name) renameList(list.id, trimmed);
    onRenameDone();
  };

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

  const summary = (
    <ThemedText type="small" themeColor="textSecondary">
      {others > 0 ? `Shared with ${others} ${others === 1 ? 'person' : 'people'}` : 'Only you'}
      {isOwner ? '' : ' · Shared with you'}
    </ThemedText>
  );

  if (renaming) {
    return (
      <View style={styles.renameWrap}>
        <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            selectTextOnFocus // highlights the current name so typing replaces it
            maxLength={MAX_NAME_LENGTH}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="New list name"
            style={[styles.renameInput, { color: theme.text }]}
          />
          {summary}
        </View>
        <View style={styles.renameActions}>
          <Button title="Cancel" variant="plain" onPress={onRenameDone} />
          <Button title="Save" onPress={save} disabled={!draft.trim()} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
      onLongPress={confirmRemove}
      accessibilityHint={isOwner ? 'Long press to delete' : 'Long press to leave'}
      style={({ pressed }) => [
        styles.row,
        styles.rowLayout,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <ThemedText numberOfLines={1} style={styles.titleText}>
            {list.name || 'Untitled list'}
          </ThemedText>
          {counts && (
            <ThemedText
              themeColor="textSecondary"
              accessibilityLabel={
                counts.done > 0
                  ? `${counts.done} of ${counts.total} items ticked`
                  : `${counts.total} item${counts.total === 1 ? '' : 's'}`
              }>
              ({counts.done > 0 ? `${counts.done}/${counts.total}` : counts.total})
            </ThemedText>
          )}
        </View>
        {summary}
      </View>
      {list.commentCount > 0 && (
        <Pressable
          onPress={onShowComments}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Show ${list.commentCount} comment${list.commentCount === 1 ? '' : 's'}${unread ? ', new comments' : ''}`}
          style={({ pressed }) => [styles.commentBadge, { opacity: pressed ? 0.6 : 1 }]}>
          {/* Blue and filled when there are comments you haven't seen; grey outline once seen. */}
          <Ionicons
            name={unread ? 'chatbubble' : 'chatbubble-outline'}
            size={20}
            color={unread ? theme.accent : theme.textSecondary}
          />
          <ThemedText type="smallBold" style={{ color: unread ? theme.accent : theme.textSecondary }}>
            {list.commentCount}
          </ThemedText>
        </Pressable>
      )}
      {/* Only the list's creator can rename or remove it (also enforced in firestore.rules). */}
      {isOwner && (
        <View style={styles.ownerActions}>
          <Pressable
            onPress={startRename}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${list.name}`}>
            <ThemedText type="small" style={{ color: theme.accent, fontWeight: 600 }}>
              Rename
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={confirmRemove}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${list.name}`}>
            <ThemedText type="small" style={{ color: theme.danger, fontWeight: 600 }}>
              Remove
            </ThemedText>
          </Pressable>
        </View>
      )}
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
  row: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.half,
    // Reserved so the accent border in rename mode doesn't shift the layout.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowLayout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  // A long name truncates with "…" but the (2/7) count stays visible.
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  titleText: { flexShrink: 1 },
  ownerActions: { alignItems: 'flex-end', gap: Spacing.two },
  commentBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  renameWrap: { gap: Spacing.two },
  renameInput: { fontSize: 16, lineHeight: 24, fontWeight: 500, padding: 0 },
  renameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
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
