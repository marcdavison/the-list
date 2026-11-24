import type { Timestamp } from 'firebase/firestore';

import type { Comment, ShoppingList } from '@/lib/lists';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "just now", "5 min ago", "3 h ago", "Yesterday 14:05", "12 Nov 14:05", "12 Nov 2025". */
export function formatWhen(ts: Timestamp | null, now = new Date()): string {
  if (!ts) return 'just now';
  const d = ts.toDate();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return `${Math.floor(mins / 60)} h ago`;

  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  if (d >= startOfYesterday) return `Yesterday ${hhmm(d)}`;

  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? `${date} ${hhmm(d)}` : `${date} ${d.getFullYear()}`;
}

/**
 * "You" for your own comments, otherwise the name stored on the comment. Older comments
 * without a name fall back to a role: "List creator", "Shopper" (numbered by join order
 * when several people have joined), or "Former member".
 */
export function authorLabel(
  comment: Pick<Comment, 'authorId' | 'authorName'>,
  list: ShoppingList,
  myUid: string,
): string {
  const { authorId, authorName } = comment;
  if (authorId === myUid) return 'You';
  if (authorName) return authorName;
  if (authorId === list.ownerId) return 'List creator';
  const shoppers = list.memberIds.filter((id) => id !== list.ownerId);
  const index = shoppers.indexOf(authorId);
  if (index === -1) return 'Former member';
  return shoppers.length > 1 ? `Shopper ${index + 1}` : 'Shopper';
}
