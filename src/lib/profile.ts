import { doc, setDoc, type DocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { Alert } from 'react-native';

import { auth, db } from '@/lib/firebase';

export const MAX_DISPLAY_NAME_LENGTH = 40;

/**
 * Private per-user data in users/{uid}. Only its owner can read it (see firestore.rules):
 * other people see your name only via the authorName stored on your comments.
 */
export type Profile = {
  displayName: string | null;
  /** When this user last opened each list's comments, keyed by list id. */
  lastSeenComments: Record<string, Timestamp>;
};

export const userRef = (uid: string) => doc(db, 'users', uid);

export function toProfile(snap: DocumentSnapshot): Profile {
  const data = snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : {};
  return {
    displayName: (data.displayName as string | undefined) ?? null,
    lastSeenComments: (data.lastSeenComments as Record<string, Timestamp> | undefined) ?? {},
  };
}

/** Not awaited: the profile listener sees the change locally at once. */
export function setDisplayName(name: string) {
  const user = auth.currentUser;
  const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!user || !trimmed) return;
  setDoc(userRef(user.uid), { displayName: trimmed }, { merge: true }).catch((e) => {
    console.warn('[profile] setDisplayName failed', e);
    Alert.alert("Couldn't save your name", 'Check your connection and try again.');
  });
}
