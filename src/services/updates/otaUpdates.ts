import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

import { colors } from '../../theme/colors';

// Only treat a genuine return as a reload moment. Flipping to another app for a couple
// of seconds should never yank the UI out from under the user.
const MIN_BACKGROUND_MS = 20_000;
// Don't re-check on every foreground; the docs warn against polling in a tight loop.
const MIN_CHECK_INTERVAL_MS = 3 * 60_000;

// The reload swap gets a brand-coloured cover instead of expo-updates' default WHITE
// screen (ReloadScreenConfiguration defaults: backgroundColor white, fade false). A
// white flash mid-session is exactly what plugins/withIosSceneLifecycle.js and
// withSolidLaunchScreen.js exist to prevent at launch; don't reintroduce it here.
const RELOAD_SCREEN_OPTIONS = {
  backgroundColor: colors.primaryDeep,
  fade: true,
} as const;

/**
 * Applies published JS updates without waiting for the "launch after next".
 *
 * expo-updates checks on cold launch by default, but downloads in the background and
 * only runs the new bundle on the NEXT launch — for a calendar people background rather
 * than quit, that can take days. This adds the other half: when the app is foregrounded
 * after a real absence, check → download → reload. Foregrounding is the safe moment,
 * because a reload there is indistinguishable from a fresh open.
 *
 * No-ops in development (expo-updates methods only work in release builds) and whenever
 * updates are disabled.
 */
export function useOtaForegroundUpdates() {
  const lastCheckedAt = useRef(0);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      // ONLY 'background' counts as leaving. 'inactive' is an iOS-only transient state
      // — the app switcher, Control Center, an incoming call, a Face ID or system
      // permission alert — and the app is still on screen. Treating it as "left the
      // app" would hard-reload iOS users who merely pulled down Control Center for
      // half a minute, throwing away their navigation state and any in-progress edit.
      // (iOS always passes through 'inactive' on its way to 'background', so watching
      // 'background' alone loses nothing, and Android never emits 'inactive' — which
      // is why device testing on Android could not surface this.)
      if (next === 'background') {
        if (backgroundedAt.current === null) {
          backgroundedAt.current = Date.now();
        }
        return;
      }
      if (next !== 'active') {
        return;
      }

      const awayForMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (awayForMs < MIN_BACKGROUND_MS) {
        return;
      }
      if (Date.now() - lastCheckedAt.current < MIN_CHECK_INTERVAL_MS) {
        return;
      }
      lastCheckedAt.current = Date.now();

      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync();
          if (!check.isAvailable) {
            return;
          }

          const fetched = await Updates.fetchUpdateAsync();
          if (!fetched.isNew) {
            // Already downloaded (expo-updates also checks on every cold launch). The
            // native layer will run it on the next cold start, so don't reload here —
            // restarting the app to apply something the user will get anyway is a
            // worse trade than waiting.
            return;
          }

          // Nothing may run after this — the promise settles just before the reload is
          // posted to the main thread.
          await Updates.reloadAsync({ reloadScreenOptions: RELOAD_SCREEN_OPTIONS });
        } catch (error) {
          // A failed check must never affect the running app; the native on-launch
          // check remains as the fallback path.
          console.warn('[Updates] foreground update check failed:', error);
        }
      })();
    });

    return () => subscription.remove();
  }, []);
}
