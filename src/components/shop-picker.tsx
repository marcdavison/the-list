import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SHOPS, shopLabel, type ShopId } from '@/lib/shops';

/** A dropdown-style button that opens a bottom sheet of shops to choose from. */
export function ShopPicker({
  value,
  onChange,
}: {
  value: ShopId | null;
  onChange: (shop: ShopId) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const choose = (shop: ShopId) => {
    onChange(shop);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Shop: ${shopLabel(value)}. Change shop` : 'Choose a shop'}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText themeColor={value ? 'text' : 'textSecondary'} style={styles.flex}>
          {value ? shopLabel(value) : 'Choose a shop'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close shop list"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.two },
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetTitle}>
            Which shop are these items from?
          </ThemedText>
          <FlatList
            data={SHOPS}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => {
              const selected = item.id === value;
              return (
                <Pressable
                  onPress={() => choose(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed || selected ? theme.backgroundElement : 'transparent' },
                  ]}>
                  <ThemedText style={styles.flex}>{item.label}</ThemedText>
                  {selected && <ThemedText style={{ color: theme.accent }}>✓</ThemedText>}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
    maxHeight: '70%',
  },
  sheetTitle: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 10,
  },
});
