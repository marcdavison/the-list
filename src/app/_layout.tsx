import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { NameGate } from '@/components/name-gate';
import { Button, CenteredMessage } from '@/components/ui';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { ProfileProvider } from '@/hooks/use-profile';

SplashScreen.preventAutoHideAsync();

// When the app is cold-started from a share link, put My Lists underneath so Back works.
export const unstable_settings = { initialRouteName: 'index' };

/** Notification consent, push registration and tap handling (renders nothing). */
function Notifications() {
  useNotifications();
  return null;
}

/** Keeps the splash up while signing in; shows a retry screen if sign-in fails. */
function AuthStatus() {
  const { user, error, retry } = useAuth();

  useEffect(() => {
    if (user || error) SplashScreen.hideAsync();
  }, [user, error]);

  if (!error || user) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <CenteredMessage title="Couldn't connect" body="Check your internet connection and try again.">
        <Button title="Try again" onPress={retry} />
      </CenteredMessage>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ProfileProvider>
          {/* The navigator is always mounted so incoming links are never dropped;
              screens wait for the user via <SignedIn>. */}
          <Stack>
            <Stack.Screen name="index" options={{ title: 'My Lists' }} />
            <Stack.Screen name="list/[id]" options={{ title: '' }} />
            <Stack.Screen name="l/[id]" options={{ title: 'Opening list…', headerBackVisible: false }} />
          </Stack>
          <NameGate />
          <AuthStatus />
          <Notifications />
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
