import type { ExpoConfig } from 'expo/config';

// Expo CLI loads .env before evaluating this file, so the share host lives in one place.
const SHARE_HOST = process.env.EXPO_PUBLIC_SHARE_HOST ?? 'localhost';
const BUNDLE_ID = 'com.lesterlabs.shoppinglist';

const config: ExpoConfig = {
  name: 'Shopping List',
  slug: 'shopping-list',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'shoppinglist',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: BUNDLE_ID,
    // Universal links: iOS opens https://<SHARE_HOST>/l/* in the app when installed.
    associatedDomains: [`applinks:${SHARE_HOST}`],
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // App links: verified against https://<SHARE_HOST>/.well-known/assetlinks.json
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: SHARE_HOST, pathPrefix: '/l' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
