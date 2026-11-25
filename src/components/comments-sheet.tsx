import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useComments, useItems } from '@/hooks/use-lists';
import { useTheme } from '@/hooks/use-theme';
import { authorLabel, formatWhen } from '@/lib/format';
import type { Comment, ShoppingList } from '@/lib/lists';
import { markCommentsSeen } from '@/lib/profile';

type ItemComments = { itemId: string; itemName: string; comments: Comment[] };

/** Bottom sheet listing a list's comments, grouped under each item's name. */
export function CommentsSheet({
  list,
  uid,
  onClose,
}: {
  list: ShoppingList | null;
  /** The viewer, so their own comments read "You". */
  uid: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Full-screen photo, drawn inside the same Modal (nested Modals are unreliable on iOS).
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const close = () => {
    setPhotoUrl(null);
    onClose();
  };

  return (
    <Modal
      visible={!!list}
      transparent
      animationType="fade"
      onRequestClose={() => (photoUrl ? setPhotoUrl(null) : close())}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close comments" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.two },
        ]}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
            Comments · {list?.name}
          </ThemedText>
          <Button title="Close" variant="plain" onPress={close} />
        </View>
        {/* Mounted only while open, so comments are only fetched when someone looks. */}
        {list && <CommentsBody list={list} uid={uid} onOpenPhoto={setPhotoUrl} />}
      </View>

      {photoUrl && (
        <Pressable
          style={styles.viewer}
          onPress={() => setPhotoUrl(null)}
          accessibilityLabel="Close photo">
          <Image source={{ uri: photoUrl }} style={styles.flex} contentFit="contain" />
          <View style={[styles.viewerClose, { top: insets.top + Spacing.two }]}>
            <Ionicons name="close-circle" size={36} color="#ffffff" />
          </View>
        </Pressable>
      )}
    </Modal>
  );
}

function CommentsBody({
  list,
  uid,
  onOpenPhoto,
}: {
  list: ShoppingList;
  uid: string;
  onOpenPhoto: (url: string) => void;
}) {
  const theme = useTheme();
  const { data: comments, loading, error } = useComments(list.id);
  const { data: items } = useItems(list.id);

  // Seen on open, and again on close to cover comments that arrived while it was open.
  useEffect(() => {
    markCommentsSeen(list.id);
    return () => markCommentsSeen(list.id);
  }, [list.id]);

  const groups = useMemo<ItemComments[]>(() => {
    const names = new Map(items.map((i) => [i.id, i.text]));
    const byItem = new Map<string, ItemComments>();
    for (const c of comments) {
      const group = byItem.get(c.itemId) ?? {
        itemId: c.itemId,
        itemName: names.get(c.itemId) ?? 'Removed item',
        comments: [],
      };
      group.comments.push(c);
      byItem.set(c.itemId, group);
    }
    // Items with the most recent comment first; comments within an item stay oldest-first.
    const latest = (g: ItemComments) => g.comments.at(-1)?.createdAt?.toMillis() ?? 0;
    return [...byItem.values()].sort((a, b) => latest(b) - latest(a));
  }, [comments, items]);

  if (loading) return <ActivityIndicator style={styles.status} />;
  if (error) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
        Couldn&apos;t load comments.
      </ThemedText>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.itemId}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
      ListEmptyComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
          No comments yet.
        </ThemedText>
      }
      renderItem={({ item: group }) => (
        <View style={styles.group}>
          <ThemedText type="smallBold">{group.itemName}</ThemedText>
          {group.comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              {!!c.text && <ThemedText type="small">{c.text}</ThemedText>}
              {c.imageUrl && (
                <Pressable
                  onPress={() => onOpenPhoto(c.imageUrl!)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo of ${group.itemName}. Tap to enlarge`}>
                  <Image
                    source={{ uri: c.imageUrl }}
                    style={[styles.photo, { backgroundColor: theme.backgroundElement }]}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                {authorLabel(c, list, uid)} · {formatWhen(c.createdAt)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    maxHeight: '75%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  list: { paddingVertical: Spacing.two },
  group: { gap: Spacing.two, paddingVertical: Spacing.three },
  comment: { gap: Spacing.half },
  meta: { fontSize: 12, lineHeight: 16 },
  photo: { width: 160, height: 160, borderRadius: 10 },
  viewer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000' },
  viewerClose: { position: 'absolute', right: Spacing.three },
  separator: { height: StyleSheet.hairlineWidth },
  status: { paddingVertical: Spacing.four, textAlign: 'center' },
});
