import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { Alert } from 'react-native';

import { auth, db } from '@/lib/firebase';
import type { ShopId } from '@/lib/shops';

export type ShoppingList = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  /** Total comments across all items (0 when absent on older lists). */
  commentCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type Item = {
  id: string;
  text: string;
  /** Null for items created before shops were added. */
  shop: ShopId | null;
  checked: boolean;
  createdBy: string;
  checkedBy: string | null;
  /** Comments on this item (0 when absent). */
  commentCount: number;
  createdAt: Timestamp | null;
};

export type Comment = {
  id: string;
  itemId: string;
  text: string;
  authorId: string;
  createdAt: Timestamp | null;
};

export const MAX_ITEM_LENGTH = 200;
export const MAX_NAME_LENGTH = 80;
export const MAX_COMMENT_LENGTH = 500;

export const listRef = (listId: string) => doc(db, 'lists', listId);
export const itemsRef = (listId: string) => collection(db, 'lists', listId, 'items');
export const commentsRef = (listId: string) => collection(db, 'lists', listId, 'comments');

function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in yet');
  return user.uid;
}

// serverTimestamps: 'estimate' gives pending local writes a timestamp instead of null,
// so freshly added items sort correctly before the server acknowledges them.
export function toList(snap: DocumentSnapshot): ShoppingList {
  const data = snap.data({ serverTimestamps: 'estimate' }) as Omit<ShoppingList, 'id'>;
  return { id: snap.id, ...data, commentCount: data.commentCount ?? 0 };
}

export function toItem(snap: DocumentSnapshot): Item {
  const data = snap.data({ serverTimestamps: 'estimate' }) as Omit<Item, 'id'>;
  return { id: snap.id, ...data, shop: data.shop ?? null, commentCount: data.commentCount ?? 0 };
}

/**
 * Writes are not awaited by the UI: Firestore applies them locally at once and
 * syncs in the background (the returned promise only settles on server ack).
 */
function logError(action: string) {
  return (e: unknown) => {
    console.warn(`[lists] ${action} failed`, e);
    const code = (e as { code?: string })?.code;
    Alert.alert(
      "Couldn't save that change",
      code === 'permission-denied'
        ? 'The server rejected it. If you just updated the app, make sure the latest Firestore rules are published.'
        : 'Check your connection and try again.',
    );
  };
}

/** Creates a list and returns its id immediately (works offline). */
export function createList(name: string): string {
  const me = uid();
  const ref = doc(collection(db, 'lists'));
  const batch = writeBatch(db);
  batch.set(ref, {
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    ownerId: me,
    memberIds: [me],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.commit().catch(logError('createList'));
  return ref.id;
}

export function renameList(listId: string, name: string) {
  updateDoc(listRef(listId), {
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    updatedAt: serverTimestamp(),
  }).catch(logError('renameList'));
}

/** Owner only: deletes every item, then the list (Firestore doesn't cascade). */
export async function deleteList(listId: string) {
  const [items, comments] = await Promise.all([getDocs(itemsRef(listId)), getDocs(commentsRef(listId))]);
  const docs = [...items.docs, ...comments.docs];
  // Batches are capped at 500 writes; keep the list doc delete in the final batch.
  for (let i = 0; i < docs.length || i === 0; i += 450) {
    const batch = writeBatch(db);
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    if (i + 450 >= docs.length) batch.delete(listRef(listId));
    await batch.commit();
  }
}

/** Non-owners leave instead of deleting; the list disappears from their home screen. */
export function leaveList(listId: string) {
  updateDoc(listRef(listId), { memberIds: arrayRemove(uid()) }).catch(logError('leaveList'));
}

export class ListNotFoundError extends Error {}

/**
 * Called when opening a share link. Needs the server (to confirm the list exists),
 * so unlike the other writes this one is awaited.
 */
export async function joinList(listId: string) {
  const me = uid();
  const snap = await getDoc(listRef(listId));
  if (!snap.exists()) throw new ListNotFoundError(listId);
  if ((snap.data().memberIds as string[]).includes(me)) return;
  await updateDoc(listRef(listId), { memberIds: arrayUnion(me) });
}

export function addItem(listId: string, shop: ShopId, text: string) {
  const trimmed = text.trim().slice(0, MAX_ITEM_LENGTH);
  if (!trimmed) return;
  const batch = writeBatch(db);
  batch.set(doc(itemsRef(listId)), {
    text: trimmed,
    shop,
    checked: false,
    createdBy: uid(),
    checkedBy: null,
    createdAt: serverTimestamp(),
  });
  batch.update(listRef(listId), { updatedAt: serverTimestamp() });
  batch.commit().catch(logError('addItem'));
}

export function setItemChecked(listId: string, itemId: string, checked: boolean) {
  const batch = writeBatch(db);
  batch.update(doc(itemsRef(listId), itemId), { checked, checkedBy: checked ? uid() : null });
  batch.update(listRef(listId), { updatedAt: serverTimestamp() });
  batch.commit().catch(logError('setItemChecked'));
}

/**
 * Owner only. Deletes the items and their comments, and takes those comments off the
 * list's comment count so My Lists stays accurate.
 */
export function deleteItems(listId: string, itemIds: string[]) {
  if (!itemIds.length) return;
  (async () => {
    const ids = itemIds.slice(0, 200);
    // Firestore 'in' queries accept at most 30 values.
    const chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ids.slice(i * 30, i * 30 + 30));
    const commentSnaps = await Promise.all(
      chunks.map((chunk) => getDocs(query(commentsRef(listId), where('itemId', 'in', chunk)))),
    );
    const comments = commentSnaps.flatMap((s) => s.docs);

    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(doc(itemsRef(listId), id)));
    comments.forEach((c) => batch.delete(c.ref));
    batch.update(listRef(listId), {
      updatedAt: serverTimestamp(),
      ...(comments.length ? { commentCount: increment(-comments.length) } : {}),
    });
    await batch.commit();
  })().catch(logError('deleteItems'));
}

export function addComment(listId: string, itemId: string, text: string) {
  const trimmed = text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!trimmed) return;
  const batch = writeBatch(db);
  batch.set(doc(commentsRef(listId)), {
    itemId,
    text: trimmed,
    authorId: uid(),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(itemsRef(listId), itemId), { commentCount: increment(1) });
  batch.update(listRef(listId), { commentCount: increment(1), updatedAt: serverTimestamp() });
  batch.commit().catch(logError('addComment'));
}
