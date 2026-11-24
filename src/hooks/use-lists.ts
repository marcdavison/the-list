import { onSnapshot, orderBy, query, where, collection } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/firebase';
import { itemsRef, listRef, toItem, toList, type Item, type ShoppingList } from '@/lib/lists';

type Snapshot<T> = { data: T; loading: boolean; error: Error | null };

/** Every list this device is a member of, most recently active first. */
export function useMyLists(uid: string): Snapshot<ShoppingList[]> {
  const [state, setState] = useState<Snapshot<ShoppingList[]>>({ data: [], loading: true, error: null });

  useEffect(() => {
    // Sorted client-side so no composite index (array-contains + orderBy) is needed.
    const q = query(collection(db, 'lists'), where('memberIds', 'array-contains', uid));
    return onSnapshot(
      q,
      (snap) => {
        const lists = snap.docs.map(toList);
        lists.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
        setState({ data: lists, loading: false, error: null });
      },
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
  }, [uid]);

  return state;
}

/** A single list; `data` is null once loaded if it doesn't exist or was deleted. */
export function useList(listId: string): Snapshot<ShoppingList | null> {
  const [state, setState] = useState<Snapshot<ShoppingList | null>>({ data: null, loading: true, error: null });

  useEffect(() => {
    return onSnapshot(
      listRef(listId),
      (snap) => setState({ data: snap.exists() ? toList(snap) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [listId]);

  return state;
}

/**
 * Live ticked/total item counts for one list (null until loaded). Used by My Lists; it reads
 * every item, which is fine at household scale.
 */
export function useItemCounts(listId: string): { done: number; total: number } | null {
  const [counts, setCounts] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    return onSnapshot(
      itemsRef(listId),
      (snap) =>
        setCounts({ total: snap.size, done: snap.docs.filter((d) => d.get('checked') === true).length }),
      // e.g. permission lost after leaving: just show no count.
      () => setCounts(null),
    );
  }, [listId]);

  return counts;
}

/** Items in a list: unchecked first, then checked, each in the order they were added. */
export function useItems(listId: string): Snapshot<Item[]> {
  const [state, setState] = useState<Snapshot<Item[]>>({ data: [], loading: true, error: null });

  useEffect(() => {
    return onSnapshot(
      query(itemsRef(listId), orderBy('createdAt', 'asc')),
      (snap) => setState({ data: snap.docs.map(toItem), loading: false, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
  }, [listId]);

  const sorted = useMemo(
    () => [...state.data.filter((i) => !i.checked), ...state.data.filter((i) => i.checked)],
    [state.data],
  );

  return { ...state, data: sorted };
}
