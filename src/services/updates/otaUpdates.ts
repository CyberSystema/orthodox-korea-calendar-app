import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

// Only treat a genuine return as a reload moment. Flipping to another app for a couple
// of seconds should never yank the UI out from under the user.
const MIN_BACKGROUND_MS = 20_000;
// Don't re-check on every foreground; the docs warn against polling in a tight loop.
const MIN_CHECK_INTERVAL_MS = 3 * 60_000;

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
      if (next === 'background' || next === 'inactive') {
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
            return;
          }

          // Nothing may run after this — the promise settles just before the reload is
          // posted to the main thread.
          await Updates.reloadAsync();
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
