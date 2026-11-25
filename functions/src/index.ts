/**
 * Cloud Functions for the Shopping List app. They react to Firestore writes: two send push
 * notifications through Expo's push service, one cleans up comment photos in Storage.
 *
 * Data model (see ../../src/lib/lists.ts and ../../firestore.rules):
 *   lists/{listId}                     name, ownerId, memberIds[]
 *   lists/{listId}/items/{itemId}      text, checked, checkedBy
 *   lists/{listId}/comments/{id}       itemId, text, authorId, authorName?, imagePath?
 *   (Storage) lists/{listId}/comments/{id}.jpg   comment photo
 *   users/{uid}                        displayName, pushTokens[]
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';

import { sendToUsers } from './push.js';

initializeApp();
const db = getFirestore();

// The Firestore database is in the eur3 (Europe) multi-region, so the functions run in
// europe-west1, which is inside it. maxInstances keeps a lid on cost from a runaway loop.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

type List = { name?: string; ownerId?: string; memberIds?: string[] };
type Item = { text?: string; checked?: boolean; checkedBy?: string | null };
type Comment = {
  itemId?: string;
  text?: string;
  authorId?: string;
  authorName?: string;
  imagePath?: string;
};

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** New comment → everyone else on the list. */
export const notifyOnComment = onDocumentCreated(
  'lists/{listId}/comments/{commentId}',
  async (event) => {
    const comment = event.data?.data() as Comment | undefined;
    const { listId } = event.params;
    if (!comment?.authorId || !comment.itemId) return;

    const [listSnap, itemSnap] = await Promise.all([
      db.doc(`lists/${listId}`).get(),
      db.doc(`lists/${listId}/items/${comment.itemId}`).get(),
    ]);
    const list = listSnap.data() as List | undefined;
    if (!list) return;

    const recipients = (list.memberIds ?? []).filter((id) => id !== comment.authorId);
    const itemName = (itemSnap.data() as Item | undefined)?.text ?? 'an item';
    const author = comment.authorName ?? 'Someone';

    const text = truncate(comment.text ?? '', 180);
    const hasPhoto = !!comment.imagePath;

    await sendToUsers(db, recipients, {
      title: hasPhoto ? `${author} sent a photo of ${itemName}` : `${author} commented on ${itemName}`,
      body: hasPhoto ? (text ? `📷 ${text}` : '📷 Photo') : text,
      subtitle: list.name,
      data: { listId, type: 'comment' },
    });
  },
);

/**
 * A comment was deleted (with its item, or the whole list) → delete its photo from Storage.
 * The app can't do this itself reliably, since deletes happen in Firestore batches.
 */
export const deleteCommentPhoto = onDocumentDeleted(
  'lists/{listId}/comments/{commentId}',
  async (event) => {
    const imagePath = (event.data?.data() as Comment | undefined)?.imagePath;
    if (!imagePath) return;
    await getStorage().bucket().file(imagePath).delete({ ignoreNotFound: true });
    logger.info('Deleted comment photo', { imagePath });
  },
);

/**
 * An item went from unticked to ticked and now nothing is left unticked
 * → everyone on the list except the person who ticked it.
 */
export const notifyWhenAllTicked = onDocumentUpdated(
  'lists/{listId}/items/{itemId}',
  async (event) => {
    const before = event.data?.before.data() as Item | undefined;
    const after = event.data?.after.data() as Item | undefined;
    if (!before || !after || before.checked || !after.checked) return;

    const { listId } = event.params;
    const remaining = await db
      .collection(`lists/${listId}/items`)
      .where('checked', '==', false)
      .limit(1)
      .get();
    if (!remaining.empty) return;

    const listSnap = await db.doc(`lists/${listId}`).get();
    const list = listSnap.data() as List | undefined;
    if (!list) return;

    const tickedBy = after.checkedBy ?? null;
    const tickerName = tickedBy
      ? ((await db.doc(`users/${tickedBy}`).get()).get('displayName') as string | undefined)
      : undefined;
    const recipients = (list.memberIds ?? []).filter((id) => id !== tickedBy);

    logger.info('All items ticked', { listId, tickedBy, recipients: recipients.length });
    await sendToUsers(db, recipients, {
      title: `${list.name ?? 'Your list'} is done ✓`,
      body: `${tickerName ?? 'Someone'} has ticked off everything on the list.`,
      data: { listId, type: 'all-ticked' },
    });
  },
);
