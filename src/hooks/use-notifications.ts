import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { registerForPushNotifications, type NotificationData } from '@/lib/notifications';

/**
 * Root-level notification wiring:
 * - asks for consent and registers this device once the user is signed in (each app open);
 * - when a notification is tapped, opens the list it's about.
 */
export function useNotifications() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (uid) registerForPushNotifications(uid).then((r) => console.log('[notifications]', r));
  }, [uid]);

  // Covers both a tap that launched the app and taps while it's running.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { listId } = (response.notification.request.content.data ?? {}) as NotificationData;
    if (listId) router.push({ pathname: '/list/[id]', params: { id: listId } });
    // So the same tap isn't handled again on the next render or app open.
    Notifications.clearLastNotificationResponseAsync();
  }, [response]);
}
