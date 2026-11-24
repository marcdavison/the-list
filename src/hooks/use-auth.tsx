import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth } from '@/lib/firebase';

type AuthState = { user: User | null; error: Error | null; retry: () => void };

const AuthContext = createContext<AuthState>({ user: null, error: null, retry: () => {} });

/** Signs the device in anonymously on first launch; the identity persists after that. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) {
        setError(null);
        signInAnonymously(auth).catch((e: Error) => setError(e));
      }
    });
  }, [attempt]);

  return (
    <AuthContext.Provider value={{ user, error, retry: () => setAttempt((n) => n + 1) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Renders children with the signed-in uid, or nothing while sign-in is in progress. */
export function SignedIn({ children }: { children: (uid: string) => ReactNode }) {
  const { user } = useAuth();
  return user ? children(user.uid) : null;
}
