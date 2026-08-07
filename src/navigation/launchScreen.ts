import type { MainTabsParamList } from './types';

/**
 * Which tab the app opens on (Settings → Launch Screen).
 *
 * Typed as keys of `MainTabsParamList`, so renaming a tab route breaks this at
 * compile time rather than silently persisting a route name that no longer
 * exists.
 *
 * TIMING MATTERS: `initialRouteName` is only read when the navigator MOUNTS, so
 * this has to be hydrated before that happens. It is set in the same `set()`
 * that flips `isHydrated` in useAppStore, and RootApp renders the navigator only
 * once hydration is done — change either of those and the app would always open
 * on the default instead.
 */
export const LAUNCH_SCREENS = ['Today', 'Month', 'Announcements'] as const satisfies ReadonlyArray<
  keyof MainTabsParamList
>;

export type LaunchScreen = (typeof LAUNCH_SCREENS)[number];

/** Today — the behaviour before this setting existed. */
export const DEFAULT_LAUNCH_SCREEN: LaunchScreen = 'Today';

/** i18n keys for the picker, kept beside the values so they cannot drift apart. */
export const LAUNCH_SCREEN_LABEL_KEYS: Record<LaunchScreen, string> = {
  Today: 'nav.today',
  Month: 'nav.month',
  Announcements: 'nav.announcements',
};

/** A persisted value may be anything (older build, renamed route) — snap it back. */
export function normalizeLaunchScreen(raw: string | null | undefined): LaunchScreen {
  return (LAUNCH_SCREENS as readonly string[]).includes(raw ?? '')
    ? (raw as LaunchScreen)
    : DEFAULT_LAUNCH_SCREEN;
}
