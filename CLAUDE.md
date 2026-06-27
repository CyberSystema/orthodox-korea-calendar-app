# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Orthodox Korea Calendar — an **Expo (managed workflow) React Native** app showing the Orthodox liturgical calendar (feasts, fasts, readings, saints) plus admin-authored events, in **English and Korean**, for iOS and Android. The backend is a Cloudflare Worker; liturgical day data is pulled from a public GitHub repo. Builds and submissions go through **EAS**.

Stack: Expo SDK 56 / React Native 0.85 / React 19 / TypeScript 6, Zustand (state), React Navigation, i18next, dayjs, react-native-reanimated 4 + react-native-svg.

## Commands

```bash
npm run typecheck            # tsc --noEmit — the primary validation gate (there is no test suite)
npm run doctor               # npx expo-doctor — checks SDK/dependency health
npm start                    # expo start (Metro)
npm run start:clear          # expo start --clear (reset Metro cache)
npm run ios / npm run android  # local native run (expo run:*) — triggers a prebuild

# EAS (remote) builds — appVersionSource is "remote", versions auto-increment
npm run build:ios:preview        # → staging backend
npm run build:ios:production     # → production backend
npm run build:android:preview / :production
npm run submit:ios / submit:android
```

There is **no test runner configured** — `npm run typecheck` is the validation gate after changes.

When invoked from inside Xcode, use the `xcode-tools` MCP `BuildProject` to compile the native iOS app, and `GetBuildLog` (severity `error`) to read failures.

## Architecture (the big picture)

**Boot chain:** `index.ts` → `App.tsx` (imports `react-native-gesture-handler` first) → `src/app/RootApp.tsx`. `RootApp` is the orchestrator: it initializes notifications, hydrates both stores, kicks off calendar-data sync from GitHub, registers the push subscription, wires deep linking, and gates a minimum-duration branded splash (`ByzantineSplashScreen`).

**State — two Zustand stores (no Redux, no Combine/observables):**
- `src/store/useAppStore.ts` — language, hydration flag, and admin/staff auth state. Persisted via `secureStorage`.
- `src/features/events/useEventsStore.ts` — admin-authored custom events and their incremental backend sync (cursor-paged), persisted to secure storage.

**Calendar data has TWO independent sources, merged at read time:**
1. **Liturgical days** (feasts/fasts/readings/tone) — fetched from a public GitHub repo by `src/features/calendar/webCalendarSource.ts`, cached to the device filesystem, loaded per liturgical year.
2. **Events** (admin-created, may recur) — from the Cloudflare backend, synced incrementally into `useEventsStore`.

`src/features/calendar/calendarService.ts` is the read API the screens use. It builds **in-memory indexes** (by-date and by-month, split into public vs. admin-draft) from both sources, expands **recurring events** into bounded occurrence dates (±1 year window, capped), and dedupes. Its index cache invalidates by **reference identity** of `customEvents` — every store mutation must return a *new* array (it does), so never mutate event arrays in place.

**Backend access is layered — keep the layers separate:**
- `src/services/backend-sdk/` — transport-agnostic API client (`OrthodoxCalendarApiClient`), request/response `contracts`, and token/cursor `stores`. No app-specific assumptions.
- `src/services/api/` — app wiring on top of the SDK: the singleton `backendClient` (`backendClient.ts`), `eventsRepository`, `subscriptions` (push registration), and `adminAuth`. The admin bearer token and sync cursor live in **SecureStore** (Keychain/Keystore), never in plaintext.

**Navigation:** `src/navigation/RootNavigator.tsx` (native-stack) hosts `MainTabs` (Today, Month) plus `EventDetail`, `Settings`, and the hidden `SecretMenu`. Deep links are normalized in `src/services/deepLinking/linking.ts` (custom scheme `okncalendar://` and `applinks:orthodox-korea-calendar.pages.dev`); only those origins are honored.

**Admin / staff (backend-driven, never client-side password checks):**
- The **secret admin console** (`SecretMenuScreen`) is reached by **7 rapid taps on the "ORTHODOX KOREA" brand title** → password prompt → Cloudflare admin login. It includes a backend terminal; destructive commands against `prod` require confirmation.
- **Staff mode** (event editing) is toggled in `Settings`. Auth state persists as a flag + a verified session token only — **never store the raw passcode**.

## Localization

i18next with `en` and `ko` (`src/i18n/locales/`). `src/i18n/index.ts` initializes i18n and registers the dayjs `ko` locale process-wide. **`en.ts` and `ko.ts` must stay at full key parity** — a referenced key missing from a locale renders the raw key string to users (a release blocker). User-facing strings go through `t()`; the `SecretMenuScreen` admin console is intentionally English-only.

## Config & conventions that bite

- **Environments:** `EXPO_PUBLIC_APP_API_BASE_URL` selects the backend, set per EAS profile in `eas.json` (preview → staging, production → production). `backendClient.ts` falls back to a hardcoded prod URL when unset (and a dev URL under `__DEV__`). `EXPO_PUBLIC_CALENDAR_DATA_BASE_URL` optionally overrides the GitHub data source.
- **babel.config.js:** do **not** list `react-native-worklets/plugin` (or the old `react-native-reanimated/plugin`) manually — `babel-preset-expo` (SDK 56) auto-injects it for Reanimated 4. Adding it double-applies the worklets transform.
- **patch-package:** patches in `patches/` auto-apply via the `postinstall` hook. We currently patch `expo-modules-jsi` (a C-function-pointer formed from a ternary that newer Swift toolchains reject). After `npm install` patches re-apply automatically; if you edit a node_modules native source, regenerate with `npx patch-package <pkg> --include '<file-regex>'` (the `--include` filter is required here — the xcframework build script dumps build artifacts inside the package that would otherwise pollute the patch).
- **UIScene lifecycle (iOS):** Expo SDK 56's template starts React Native from `AppDelegate.didFinishLaunchingWithOptions` and ships no UIScene support, but the current iOS SDK *requires* UIScene adoption (Apple TN3187) or the app fails to launch. The local config plugin `plugins/withIosSceneLifecycle.js` injects both halves together on every prebuild — the `UIApplicationSceneManifest` (Info.plist) **and** a `SceneDelegate` in `AppDelegate.swift` that starts RN in the scene's window and forwards deep links to the existing AppDelegate handlers. Keep them in that one plugin; never add the scene manifest to `app.json` alone (an orphaned manifest pointing at a missing `SceneDelegate` class breaks launch). If the Expo template's RN-startup block changes, the plugin throws a clear error to update it.
- **Splash screen is two layers — keep them visually matched.** iOS always shows a mandatory native launch splash *before* JS runs, then the React-Native `ByzantineSplashScreen` (`src/components/common/`) animates once the bundle loads. To avoid a jarring two-screen effect, the native splash is intentionally a **bare solid background with no logo** (`expo-splash-screen` configured with only `backgroundColor: "#3A0A0A"`, which equals `colors.primaryDeep` — the animated splash's opening color), so it blends straight into the animated one. Don't re-add an `image` to the splash plugin (that brings back the static centered-icon screen). The native splash lingers longer in Debug (waiting on Metro) than in Release (embedded bundle).
- **Native `ios/` and `android/` are gitignored generated output** (Expo prebuild). EAS regenerates them on remote builds; for a clean local native build run `npx expo prebuild --clean`. Avoid hand-editing files under `ios/` — changes are lost on the next prebuild (use config plugins / `app.json` instead).
- **`GoogleService-Info.plist` and `google-services.json`** (Firebase) are gitignored and referenced in `app.json`; they must be supplied to EAS builds (file secrets) or builds fail.
- Prefer Swift `async/await`-style APIs over Combine, and React `async`/`await` over RxJS-style observables, consistent with the existing code.
