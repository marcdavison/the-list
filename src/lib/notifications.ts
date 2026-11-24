import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { arrayUnion, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { userRef } from '@/lib/profile';

/** Data the Cloud Functions attach to every notification (see functions/src/index.ts). */
export type NotificationData = { listId?: string; type?: 'comment' | 'all-ticked' };

export const ANDROID_CHANNEL_ID = 'default';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for consent to send notifications (the OS shows its prompt only the first time),
 * then saves this device's Expo push token to the user's private profile so the Cloud
 * Functions can reach it. Safe to call on every app open.
 *
 * Returns why it stopped, for logging; never throws.
 */
export async function registerForPushNotifications(
  uid: string,
): Promise<'registered' | 'denied' | 'no-project-id' | 'failed'> {
  try {
    // Android 13+: a channel must exist before asking, or the permission prompt won't show.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'List activity',
        description: 'Comments on your lists, and when everything has been ticked off',
        importance: AndroidImportance.HIGH,
      });
    }

    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    const allowed =
      permissions.granted ||
      permissions.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    if (!allowed) return 'denied';

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      // Set by `npx eas-cli@latest init` (see app.config.ts). Without it there is no push token.
      console.warn('[notifications] No EAS projectId configured; skipping push registration');
      return 'no-project-id';
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await setDoc(userRef(uid), { pushTokens: arrayUnion(token) }, { merge: true });
    return 'registered';
  } catch (e) {
    // e.g. offline, Expo Go on Android (no remote push), or a simulator without push support.
    console.warn('[notifications] registration failed', e);
    return 'failed';
  }
}
