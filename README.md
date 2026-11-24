# Shopping List

A React Native (Expo) app for making shopping lists and sharing them with a link. Everyone who opens the link can add items and tick them off, and changes sync live through Firebase.

## Stack

- **App:** Expo SDK 58, expo-router and TypeScript
- **Firebase:** anonymous sign-in, Firestore for lists and items, and Hosting for share links and app-association files
- **Firebase project:** `the-list-af068` (set in `.firebaserc` and `.env`)

## Setup

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
cp .env.example .env   # then fill in, if .env doesn't exist yet
npm start
```

### One-time Firebase Console setup

1. **Authentication** → Sign-in method: enable **Anonymous**.
2. **Firestore Database**: create a database. Production mode is fine, because the rules below control access.
3. Paste the contents of [firestore.rules](firestore.rules) into the **Firestore** → **Rules** tab and publish them, or run `npx firebase login` and then `npm run deploy:firebase` (this also deploys hosting).

## How sharing works

- Each list's Firestore ID (20 random characters) is its share secret. The share link is `https://the-list-af068.web.app/l/<listId>`.
- When someone opens the link, the app's [src/app/l/[id].tsx](src/app/l/[id].tsx) route adds them to the list's `memberIds`, then shows the list.
- If the app isn't installed, the link opens [hosting/public/l/index.html](hosting/public/l/index.html), which sends the person to the App Store or Google Play.
- There is no deferred deep linking: after installing, the person has to tap the link again.

### Before universal links and app links work

These need the app to be registered with Apple and Google, and need a development build. They don't work in Expo Go.

| File | Replace |
| --- | --- |
| `hosting/public/.well-known/apple-app-site-association` | `APPLE_TEAM_ID` with your Apple Developer Team ID |
| `hosting/public/.well-known/assetlinks.json` | `ANDROID_SHA256_FINGERPRINT` with the output of `npx eas-cli@latest credentials -p android` |
| `hosting/public/l/index.html` | `APP_STORE_URL` and `PLAY_STORE_URL`, once the app is published |

Then deploy hosting and make a build: `npx eas-cli@latest build --profile development`.

The bundle ID and package name are both `com.lesterlabs.shoppinglist`, set in [app.config.ts](app.config.ts).

To test links:

```bash
npx uri-scheme open "shoppinglist://l/<listId>" --ios     # custom scheme, works in development
xcrun simctl openurl booted https://the-list-af068.web.app/l/<listId>
adb shell am start -a android.intent.action.VIEW -d https://the-list-af068.web.app/l/<listId>
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` / `ios` / `android` | Expo dev server |
| `npm run typecheck` / `lint` | `tsc --noEmit` / `expo lint` |
| `npm run deploy:firebase` | Deploys Firestore rules and Hosting |
| `npm run emulators` | Local Auth, Firestore and Hosting emulators. Set `EXPO_PUBLIC_USE_EMULATORS=true` in `.env` to point the app at them. Needs Java 21 or later. |
| `npm run test:rules` | Security-rules tests in [tests/](tests/), run against the emulator. Needs Java 21 or later. |

## Project layout

```
src/app/_layout.tsx      Stack navigator, anonymous sign-in, splash handling
src/app/index.tsx        My Lists (create; long-press to delete or leave)
src/app/list/[id].tsx    List detail (add, tick, delete, clear checked, rename, share)
src/app/l/[id].tsx       Share-link entry: joins the list, then opens it
src/lib/firebase.ts      Firebase init (.web.ts variant for web)
src/lib/lists.ts         All Firestore reads and writes
src/hooks/use-lists.ts   Realtime hooks (useMyLists, useList, useItems)
firestore.rules          Who can read and write what
hosting/public/          Share-link fallback page and app-association files
```
