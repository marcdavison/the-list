import { Platform } from 'react-native';

// All values come from .env (see .env.example). EXPO_PUBLIC_* vars are inlined at build time
// and must be referenced with dot notation for that to work.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Host serving share links and the app-association files, e.g. "my-project.web.app". */
export const SHARE_HOST = process.env.EXPO_PUBLIC_SHARE_HOST ?? 'localhost';

export function shareUrl(listId: string) {
  return `https://${SHARE_HOST}/l/${listId}`;
}

export const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';

// The Android emulator reaches the host machine at 10.0.2.2, not localhost.
export const emulatorHost =
  process.env.EXPO_PUBLIC_EMULATOR_HOST ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
