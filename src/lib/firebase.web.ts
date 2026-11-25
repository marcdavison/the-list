// Web variant: browser persistence is the default, and getReactNativePersistence
// does not exist in Firebase's browser bundle.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

import { firebaseConfig, emulatorHost, useEmulators } from '@/lib/config';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (useEmulators && !(globalThis as { __emulatorsConnected?: boolean }).__emulatorsConnected) {
  (globalThis as { __emulatorsConnected?: boolean }).__emulatorsConnected = true;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectStorageEmulator(storage, emulatorHost, 9199);
}
