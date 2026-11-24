import { onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { toProfile, userRef, type Profile } from '@/lib/profile';

type ProfileState = { profile: Profile | null; loading: boolean };

const ProfileContext = createContext<ProfileState>({ profile: null, loading: true });

/** Keeps the signed-in user's private profile (users/{uid}) in context, live. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<ProfileState & { uid: string | null }>({
    uid: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      userRef(uid),
      (snap) => setState({ uid, profile: toProfile(snap), loading: false }),
      (error) => {
        console.warn('[profile] listen failed', error);
        setState({ uid, profile: null, loading: false });
      },
    );
  }, [uid]);

  // Ignore state left over from a previous user until the new snapshot arrives.
  const current = state.uid === uid ? state : { profile: null, loading: true };
  return (
    <ProfileContext.Provider value={{ profile: current.profile, loading: current.loading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
