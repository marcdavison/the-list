import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, CenteredMessage } from '@/components/ui';
import { SignedIn } from '@/hooks/use-auth';
import { joinList, ListNotFoundError } from '@/lib/lists';

/**
 * Entry point for share links: https://<SHARE_HOST>/l/<listId> (or shoppinglist://l/<listId>).
 * Joins the list, then replaces this screen with the list itself.
 */
export default function JoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SignedIn>{() => <Join listId={id} />}</SignedIn>;
}

function Join({ listId }: { listId: string }) {
  const [error, setError] = useState<'not-found' | 'failed' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    joinList(listId)
      .then(() => {
        if (!cancelled) router.replace({ pathname: '/list/[id]', params: { id: listId } });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ListNotFoundError ? 'not-found' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [listId, attempt]);

  if (error === 'not-found') {
    return (
      <CenteredMessage title="List not found" body="This link may be wrong, or the list was deleted.">
        <Button title="Go to my lists" onPress={() => router.replace('/')} />
      </CenteredMessage>
    );
  }
  if (error === 'failed') {
    return (
      <CenteredMessage title="Couldn't open this list" body="Check your internet connection and try again.">
        <Button
          title="Try again"
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
        <Button title="Go to my lists" variant="plain" onPress={() => router.replace('/')} />
      </CenteredMessage>
    );
  }
  return <CenteredMessage loading body="Opening shared list…" />;
}
