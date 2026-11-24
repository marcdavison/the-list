/**
 * Sending through Expo's push service: https://docs.expo.dev/push-notifications/sending-notifications/
 * One HTTP call per 100 messages; tokens Expo reports as DeviceNotRegistered are removed.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PER_REQUEST = 100;

export type PushContent = {
  title: string;
  body: string;
  /** iOS only: shown under the title. */
  subtitle?: string;
  /** Read by the app when the notification is tapped (see src/lib/notifications.ts). */
  data: { listId: string; type: 'comment' | 'all-ticked' };
};

type ExpoMessage = PushContent & {
  to: string;
  sound: 'default';
  channelId: 'default';
  priority: 'high';
};

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

/** Looks up each user's Expo push tokens and sends them all `content`. */
export async function sendToUsers(db: Firestore, uids: string[], content: PushContent) {
  if (!uids.length) return;

  const userSnaps = await db.getAll(...uids.map((uid) => db.doc(`users/${uid}`)));
  const tokenOwner = new Map<string, string>();
  for (const snap of userSnaps) {
    const tokens = (snap.get('pushTokens') as unknown[] | undefined) ?? [];
    for (const t of tokens) if (typeof t === 'string') tokenOwner.set(t, snap.id);
  }
  const tokens = [...tokenOwner.keys()];
  if (!tokens.length) {
    logger.info('No push tokens for recipients', { recipients: uids.length });
    return;
  }

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    ...content,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  }));

  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += MAX_PER_REQUEST) {
    const batch = messages.slice(i, i + MAX_PER_REQUEST);
    const tickets = await postToExpo(batch);
    tickets.forEach((ticket, j) => {
      if (ticket.status !== 'error') return;
      logger.warn('Expo push ticket error', { error: ticket.details?.error, message: ticket.message });
      if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[j].to);
    });
  }

  await Promise.all(
    deadTokens.map((token) =>
      db.doc(`users/${tokenOwner.get(token)}`).update({ pushTokens: FieldValue.arrayRemove(token) }),
    ),
  );
  logger.info('Push sent', { tokens: tokens.length, removed: deadTokens.length, type: content.data.type });
}

async function postToExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };
  // Only needed if "Enhanced security for push notifications" is turned on in the Expo dashboard.
  if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
  const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[]; errors?: unknown } | null;
  if (!res.ok || !json?.data) {
    logger.error('Expo push request failed', { status: res.status, errors: json?.errors });
    return [];
  }
  return json.data;
}
