import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShopPicker } from '@/components/shop-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, CenteredMessage, Input, type TextInputRef } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SignedIn } from '@/hooks/use-auth';
import { useItems, useList } from '@/hooks/use-lists';
import { useTheme } from '@/hooks/use-theme';
import { shareUrl } from '@/lib/config';
import {
  addComment,
  addItem,
  deleteItems,
  MAX_COMMENT_LENGTH,
  MAX_ITEM_LENGTH,
  setItemChecked,
  type Item,
  type ShoppingList,
} from '@/lib/lists';
import { OTHER_SHOP, SHOPS, shopLabel, type ShopId } from '@/lib/shops';

type ShopSection = {
  key: string;
  title: string;
  done: number;
  total: number;
  data: Item[];
};

/** Groups items by shop in SHOPS order (legacy items without a shop go last, under "Other"). */
function groupByShop(items: Item[], collapsed: Set<string>): ShopSection[] {
  const order = [...SHOPS.map((s) => s.id as string), OTHER_SHOP];
  return order.flatMap((key) => {
    const shopItems = items.filter((i) => (i.shop ?? OTHER_SHOP) === key);
    if (!shopItems.length) return [];
    return [
      {
        key,
        title: shopLabel(key),
        done: shopItems.filter((i) => i.checked).length,
        total: shopItems.length,
        // A collapsed section keeps its header but renders no rows.
        data: collapsed.has(key) ? [] : shopItems,
      },
    ];
  });
}

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SignedIn>{(uid) => <ListLoader listId={id} uid={uid} />}</SignedIn>;
}

function ListLoader({ listId, uid }: { listId: string; uid: string }) {
  const { data: list, loading, error } = useList(listId);

  if (loading) return <CenteredMessage loading />;
  if (error || !list || !list.memberIds.includes(uid)) {
    return (
      <CenteredMessage
        title="List not available"
        body="It may have been deleted, or you may have left it. Ask for a new share link to rejoin.">
        <Button title="Back to my lists" onPress={() => router.replace('/')} />
      </CenteredMessage>
    );
  }
  return <ListDetail list={list} uid={uid} />;
}

function ListDetail({ list, uid }: { list: ShoppingList; uid: string }) {
  const theme = useTheme();
  const { data: items, loading } = useItems(list.id);
  const [text, setText] = useState('');
  const [shop, setShop] = useState<ShopId | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const inputRef = useRef<TextInputRef>(null);

  const isOwner = uid === list.ownerId;
  const done = items.filter((i) => i.checked).length;
  // Null if the item being commented on was deleted meanwhile, which closes the box.
  const commentingItem = items.find((i) => i.id === commentingId) ?? null;
  const sections = useMemo(() => groupByShop(items, collapsed), [items, collapsed]);

  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const expandSection = (key: string) =>
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

  // Tapping a different shop selects it (and opens it) so new items go there;
  // tapping the already-selected shop, or "Other", just opens/closes it.
  const onShopHeaderPress = (key: string) => {
    const isRealShop = SHOPS.some((s) => s.id === key);
    if (isRealShop && key !== shop) {
      setShop(key as ShopId);
      expandSection(key);
    } else {
      toggleSection(key);
    }
  };

  const add = () => {
    if (!shop || !text.trim()) return;
    addItem(list.id, shop, text);
    setText('');
    expandSection(shop); // make sure the new item is visible if its shop was collapsed
    inputRef.current?.focus(); // keep the keyboard up for rapid entry
  };

  const share = () => {
    const url = shareUrl(list.id);
    Share.share(
      Platform.OS === 'ios'
        ? { message: `Help me with "${list.name}"`, url }
        : { message: `Help me with "${list.name}": ${url}` },
    );
  };

  return (
    // The header + status bar inset comes from the FlatList's contentInsetAdjustmentBehavior,
    // so only the side edges here; the composer's own SafeAreaView handles the bottom.
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ headerRight: () => <Button title="Share" variant="plain" onPress={share} /> }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // 0 because the translucent header means this view already starts at the top of the screen.
        keyboardVerticalOffset={0}>
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          // iOS: inset content below the translucent native header (and status bar).
          contentInsetAdjustmentBehavior="automatic"
          // Sticky headers would slide under the translucent nav header.
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <ShopHeader
              section={section}
              open={!collapsed.has(section.key)}
              selected={section.key === shop}
              onPress={() => onShopHeaderPress(section.key)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              {/* Read-only here; lists are renamed from My Lists. */}
              <ThemedText style={styles.title} accessibilityRole="header">
                {list.name || 'Untitled list'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {items.length === 0 ? 'No items yet' : `${done} of ${items.length} done`}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <ItemRow
              listId={list.id}
              item={item}
              isOwner={isOwner}
              commenting={item.id === commentingId}
              onComment={() => setCommentingId(item.id)}
            />
          )}
          ListEmptyComponent={loading ? <CenteredMessage loading /> : undefined}
          ListFooterComponent={
            // Removing items is the creator's job, so only they see "Clear checked".
            isOwner && done > 0 ? (
              <View style={styles.footer}>
                <Button
                  title={`Clear ${done} checked`}
                  variant="plain"
                  onPress={() => deleteItems(list.id, items.filter((i) => i.checked).map((i) => i.id))}
                />
              </View>
            ) : undefined
          }
        />
        <SafeAreaView edges={['bottom']} style={styles.composerWrap}>
          {commentingItem ? (
            <CommentComposer
              // A fresh composer (empty, focused) for each item.
              key={commentingItem.id}
              listId={list.id}
              item={commentingItem}
              onClose={() => setCommentingId(null)}
            />
          ) : (
            <View style={styles.composerStack}>
              <ShopPicker value={shop} onChange={setShop} />
              <View style={styles.composer}>
                <Input
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  editable={!!shop}
                  placeholder={shop ? `Add an item for ${shopLabel(shop)}` : 'Choose a shop first'}
                  maxLength={MAX_ITEM_LENGTH}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onSubmitEditing={add}
                />
                <Button title="Add" onPress={add} disabled={!shop || !text.trim()} />
              </View>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


/** Tappable shop heading that opens/closes that shop's items. */
function ShopHeader({
  section,
  open,
  selected,
  onPress,
}: {
  section: ShopSection;
  open: boolean;
  /** This is the shop new items are being added to. */
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const allDone = section.done === section.total;
  const background = selected ? theme.accentSoft : theme.backgroundElement;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, selected }}
      accessibilityLabel={`${section.title}, ${section.done} of ${section.total} done`}
      accessibilityHint={
        selected ? (open ? 'Collapses this shop' : 'Expands this shop') : 'Adds new items to this shop'
      }
      style={({ pressed }) => [
        styles.shopHeader,
        { backgroundColor: background, opacity: pressed ? 0.7 : 1 },
        selected && { borderColor: theme.accent },
      ]}>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={selected ? theme.accent : theme.textSecondary}
        style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
      />
      <ThemedText type="smallBold" style={[styles.flex, selected && { color: theme.accent }]}>
        {section.title}
      </ThemedText>
      {allDone && <Ionicons name="checkmark" size={16} color={theme.accent} />}
      <ThemedText type="small" style={{ color: allDone ? theme.accent : theme.textSecondary }}>
        {section.done}/{section.total}
      </ThemedText>
    </Pressable>
  );
}

/**
 * One item: text, then a chat button (with its comment count), a tick button for
 * "in the basket", and, for the list's creator only, a delete button.
 */
function ItemRow({
  listId,
  item,
  isOwner,
  commenting,
  onComment,
}: {
  listId: string;
  item: Item;
  isOwner: boolean;
  /** The comment box at the bottom of the screen is open for this item. */
  commenting: boolean;
  onComment: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.itemRow,
        { borderBottomColor: theme.border },
        commenting && { backgroundColor: theme.accentSoft },
      ]}>
      <ThemedText
        style={[styles.itemText, item.checked && styles.checkedText]}
        themeColor={item.checked ? 'textSecondary' : 'text'}>
        {item.text}
      </ThemedText>

      <Pressable
        onPress={onComment}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          item.commentCount
            ? `Comment on ${item.text}, ${item.commentCount} comment${item.commentCount === 1 ? '' : 's'}`
            : `Comment on ${item.text}`
        }
        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons
          name={item.commentCount > 0 ? 'chatbubble' : 'chatbubble-outline'}
          size={22}
          color={item.commentCount > 0 ? theme.accent : theme.textSecondary}
        />
        {item.commentCount > 0 && (
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            {item.commentCount}
          </ThemedText>
        )}
      </Pressable>

      <Pressable
        onPress={() => setItemChecked(listId, item.id, !item.checked)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.text} in basket`}
        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons
          name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={item.checked ? theme.accent : theme.textSecondary}
        />
      </Pressable>

      {isOwner && (
        <Pressable
          onPress={() => deleteItems(listId, [item.id])}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.text}`}
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

/** Replaces the add-item bar while commenting, so it always sits above the keyboard. */
function CommentComposer({
  listId,
  item,
  onClose,
}: {
  listId: string;
  item: Item;
  onClose: () => void;
}) {
  const [comment, setComment] = useState('');

  const submit = () => {
    if (!comment.trim()) return;
    addComment(listId, item.id, comment);
    setComment('');
    onClose();
  };

  return (
    <View style={styles.composerStack}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        Comment on <ThemedText type="smallBold">{item.text}</ThemedText>
      </ThemedText>
      <Input
        value={comment}
        onChangeText={setComment}
        autoFocus
        multiline
        maxLength={MAX_COMMENT_LENGTH}
        placeholder="Can't find it? Need to ask something?"
        accessibilityLabel={`Comment on ${item.text}`}
        style={styles.commentInput}
      />
      <View style={styles.commentActions}>
        <Button title="Close" variant="plain" onPress={onClose} />
        <Button title="Comment" onPress={submit} disabled={!comment.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingVertical: Spacing.three, gap: Spacing.one },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: { flex: 1, paddingVertical: Spacing.three },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
  },
  checkedText: { textDecorationLine: 'line-through' },
  commentInput: { flex: 0, minHeight: 72, maxHeight: 140, textAlignVertical: 'top' },
  commentActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  footer: { paddingTop: Spacing.three, alignItems: 'center' },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
    // Always reserve the border so selecting a shop doesn't shift the layout.
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginTop: Spacing.three,
  },
  composerWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  composerStack: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  composer: { flexDirection: 'row', gap: Spacing.two },
});
