import i18n from 'i18next';
import { create } from 'zustand';

import { hasAdminAuthToken, verifyAdminCloudflareSession } from '../services/api/adminAuth';
import { canUseEventsApi } from '../services/api/eventsRepository';
import {
  DEFAULT_LAUNCH_SCREEN,
  normalizeLaunchScreen,
  type LaunchScreen,
} from '../navigation/launchScreen';
import { secureStorage } from '../services/storage/secureStorage';
import { DEFAULT_THEME_MODE, normalizeThemeMode, type ThemeMode } from '../theme/useTheme';
import { DEFAULT_DIRECTION, normalizeDirection, type Direction } from '../theme/direction';
import { DEFAULT_FONT_SCALE, normalizeFontScale, type FontScale } from '../theme/fontScale';
import type { SupportedLanguage } from '../types/language';

const LANGUAGE_KEY = 'app.language';
const FONT_SCALE_KEY = 'app.fontScale';
const LAUNCH_SCREEN_KEY = 'app.launchScreen';
const THEME_MODE_KEY = 'app.themeMode';
const DIRECTION_KEY = 'app.direction';
// Owner builds only: hide every owner surface so the app presents exactly as a
// parishioner's copy does. Persisted, so a restart does not quietly restore the
// owner's view mid-test.
const PREVIEW_PUBLIC_KEY = 'app.previewPublic';
// We persist only the fact that staff mode is enabled — never the raw passcode.
// The session token (managed by the SDK) is what proves authentication.
const STAFF_MODE_KEY = 'auth.staffModeEnabled';
// Older builds stored the raw passcode here; we migrate off it and purge it.
const LEGACY_STAFF_PASSCODE_KEY = 'auth.staffPasscode';

type AppState = {
  isHydrated: boolean;
  language: SupportedLanguage;
  /** Reader-chosen text size multiplier; see theme/fontScale.ts. */
  fontScale: FontScale;
  /** Which tab the app opens on; see navigation/launchScreen.ts. */
  launchScreen: LaunchScreen;
  /** Light / dark / follow-the-system; see theme/useTheme.ts. */
  themeMode: ThemeMode;
  /** Which visual design is active; see theme/direction.ts. */
  direction: Direction;
  /**
   * Owner builds only: present as the public app.
   *
   * Never true in a public build, because nothing there can set it — the toggle
   * lives behind the owner flag. See config/ownerSurfaces.
   */
  previewPublic: boolean;
  selectedDateISO: string | null;
  adminMode: boolean;
  cloudflareAdminAuthenticated: boolean;
  secretMenuUnlocked: boolean;
  hydratePreferences: () => Promise<void>;
  setLanguage: (language: SupportedLanguage) => void;
  setFontScale: (fontScale: FontScale) => void;
  setLaunchScreen: (launchScreen: LaunchScreen) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setDirection: (direction: Direction) => void;
  setPreviewPublic: (value: boolean) => void;
  setSelectedDateISO: (dateISO: string | null) => void;
  setAdminMode: (value: boolean) => void;
  setCloudflareAdminAuthenticated: (value: boolean) => void;
  setSecretMenuUnlocked: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  language: (i18n.language as SupportedLanguage) || 'en',
  fontScale: DEFAULT_FONT_SCALE,
  launchScreen: DEFAULT_LAUNCH_SCREEN,
  themeMode: DEFAULT_THEME_MODE,
  direction: DEFAULT_DIRECTION,
  previewPublic: false,
  selectedDateISO: null,
  adminMode: false,
  cloudflareAdminAuthenticated: false,
  secretMenuUnlocked: false,
  hydratePreferences: async () => {
    const [
      savedLanguage,
      savedFontScale,
      savedLaunchScreen,
      savedThemeMode,
      savedDirection,
      savedPreviewPublic,
      hadAuthToken,
      staffModeFlag,
      legacyPasscode,
    ] = await Promise.all([
      secureStorage.getItem(LANGUAGE_KEY),
      secureStorage.getItem(FONT_SCALE_KEY),
      secureStorage.getItem(LAUNCH_SCREEN_KEY),
      secureStorage.getItem(THEME_MODE_KEY),
      secureStorage.getItem(DIRECTION_KEY),
      secureStorage.getItem(PREVIEW_PUBLIC_KEY),
      hasAdminAuthToken(),
      secureStorage.getItem(STAFF_MODE_KEY),
      secureStorage.getItem(LEGACY_STAFF_PASSCODE_KEY),
    ]);

    let staffModeEnabled = staffModeFlag === '1';
    let cloudflareAdminAuthenticated = false;

    // One-time migration: older builds derived staff mode from a stored passcode.
    // Carry that forward as the flag, then permanently purge the stored secret.
    if (legacyPasscode !== null) {
      if (!staffModeEnabled && legacyPasscode.trim()) {
        staffModeEnabled = true;
        await secureStorage.setItem(STAFF_MODE_KEY, '1');
      }
      await secureStorage.deleteItem(LEGACY_STAFF_PASSCODE_KEY);
    }

    if (savedLanguage === 'en' || savedLanguage === 'ko') {
      await i18n.changeLanguage(savedLanguage);
      set({ language: savedLanguage });
    }

    // Verify the persisted session token rather than replaying a stored secret.
    // If the token has expired, staff mode stays enabled but unauthenticated and
    // the Settings screen prompts the user to re-enter the passcode.
    if (staffModeEnabled && hadAuthToken && canUseEventsApi()) {
      try {
        cloudflareAdminAuthenticated = await verifyAdminCloudflareSession();
      } catch (error) {
        console.warn('[App] staff session verification failed:', error);
      }
    }

    set({
      isHydrated: true,
      // Set with the same commit that flips isHydrated, so the navigator's first
      // render already uses the reader's size — no visible resize on launch.
      fontScale: normalizeFontScale(savedFontScale),
      // Same reason, but load-bearing rather than cosmetic: `initialRouteName` is
      // read ONLY when the navigator mounts, and RootApp mounts it once hydration
      // finishes. Committing this later would always open the default tab.
      launchScreen: normalizeLaunchScreen(savedLaunchScreen),
      // Same reason again: the palette must be right on the FIRST painted frame,
      // or the app flashes light before switching to night.
      themeMode: normalizeThemeMode(savedThemeMode),
      direction: normalizeDirection(savedDirection),
      previewPublic: savedPreviewPublic === 'true',
      adminMode: staffModeEnabled,
      cloudflareAdminAuthenticated,
    });
  },
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    void secureStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },
  setFontScale: (fontScale) => {
    void secureStorage.setItem(FONT_SCALE_KEY, String(fontScale));
    set({ fontScale });
  },
  setLaunchScreen: (launchScreen) => {
    void secureStorage.setItem(LAUNCH_SCREEN_KEY, launchScreen);
    set({ launchScreen });
  },
  setThemeMode: (themeMode) => {
    void secureStorage.setItem(THEME_MODE_KEY, themeMode);
    set({ themeMode });
  },
  setDirection: (direction) => {
    void secureStorage.setItem(DIRECTION_KEY, direction);
    set({ direction });
  },
  setPreviewPublic: (previewPublic) => {
    void secureStorage.setItem(PREVIEW_PUBLIC_KEY, String(previewPublic));
    set({ previewPublic });
  },
  setSelectedDateISO: (selectedDateISO) => set({ selectedDateISO }),
  setAdminMode: (value) => set({ adminMode: value }),
  setCloudflareAdminAuthenticated: (value) => set({ cloudflareAdminAuthenticated: value }),
  setSecretMenuUnlocked: (value) => set({ secretMenuUnlocked: value }),
}));
