import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  Share,
  StyleSheet,
  TextInput,
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
  addItem,
  deleteItems,
  MAX_ITEM_LENGTH,
  MAX_NAME_LENGTH,
  renameList,
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
  const inputRef = useRef<TextInputRef>(null);

  const done = items.filter((i) => i.checked).length;
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
              <ListName list={list} />
              <ThemedText type="small" themeColor="textSecondary">
                {items.length === 0 ? 'No items yet' : `${done} of ${items.length} done`}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <ItemRow listId={list.id} item={item} canCheck={uid !== list.ownerId} />
          )}
          ListEmptyComponent={loading ? <CenteredMessage loading /> : undefined}
          ListFooterComponent={
            done > 0 ? (
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
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The list name, editable in place. Saves on blur/submit. */
function ListName({ list }: { list: ShoppingList }) {
  const theme = useTheme();
  const [name, setName] = useState(list.name);

  // Pick up renames made by other people, unless we're mid-edit.
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setName(list.name);
  }, [list.name]);

  const save = () => {
    editing.current = false;
    if (name.trim() && name.trim() !== list.name) renameList(list.id, name);
    else setName(list.name);
  };

  return (
    <TextInput
      value={name}
      onChangeText={setName}
      onFocus={() => (editing.current = true)}
      onBlur={save}
      onSubmitEditing={save}
      maxLength={MAX_NAME_LENGTH}
      placeholder="List name"
      placeholderTextColor={theme.textSecondary}
      accessibilityLabel="List name"
      style={[styles.title, { color: theme.text }]}
    />
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
      <ThemedText style={[styles.chevron, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>
        ›
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.flex, selected && { color: theme.accent }]}>
        {section.title}
      </ThemedText>
      <ThemedText type="small" style={{ color: allDone ? theme.accent : theme.textSecondary }}>
        {allDone ? '✓ ' : ''}
        {section.done}/{section.total}
      </ThemedText>
    </Pressable>
  );
}

/**
 * One item. `canCheck` is false for the list's creator: they write the list, and the people
 * it's shared with tick things off. The creator still sees ticked items struck through.
 */
function ItemRow({ listId, item, canCheck }: { listId: string; item: Item; canCheck: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      <Pressable
        style={styles.itemMain}
        disabled={!canCheck}
        onPress={() => setItemChecked(listId, item.id, !item.checked)}
        accessibilityRole={canCheck ? 'checkbox' : 'text'}
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={item.text}>
        {canCheck && (
          <View
            style={[
              styles.checkbox,
              { borderColor: item.checked ? theme.accent : theme.textSecondary },
              item.checked && { backgroundColor: theme.accent },
            ]}>
            {item.checked && <ThemedText style={[styles.tick, { color: theme.onAccent }]}>✓</ThemedText>}
          </View>
        )}
        <ThemedText
          style={[styles.flex, item.checked && styles.checkedText]}
          themeColor={item.checked ? 'textSecondary' : 'text'}>
          {item.text}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => deleteItems(listId, [item.id])}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.text}`}>
        <ThemedText themeColor="textSecondary" style={styles.delete}>
          ×
        </ThemedText>
      </Pressable>
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
  title: { fontSize: 28, fontWeight: 700, padding: 0 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 14, lineHeight: 16, fontWeight: 700 },
  checkedText: { textDecorationLine: 'line-through' },
  delete: { fontSize: 24, lineHeight: 28, paddingHorizontal: Spacing.one },
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
  chevron: { fontSize: 22, lineHeight: 22, width: 14, textAlign: 'center' },
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
