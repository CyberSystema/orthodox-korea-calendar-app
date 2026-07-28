import i18n from 'i18next';
import { create } from 'zustand';

import { hasAdminAuthToken, verifyAdminCloudflareSession } from '../services/api/adminAuth';
import { canUseEventsApi } from '../services/api/eventsRepository';
import { secureStorage } from '../services/storage/secureStorage';
import { DEFAULT_FONT_SCALE, normalizeFontScale, type FontScale } from '../theme/fontScale';
import type { SupportedLanguage } from '../types/language';

const LANGUAGE_KEY = 'app.language';
const FONT_SCALE_KEY = 'app.fontScale';
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
  selectedDateISO: string | null;
  adminMode: boolean;
  cloudflareAdminAuthenticated: boolean;
  secretMenuUnlocked: boolean;
  hydratePreferences: () => Promise<void>;
  setLanguage: (language: SupportedLanguage) => void;
  setFontScale: (fontScale: FontScale) => void;
  setSelectedDateISO: (dateISO: string | null) => void;
  setAdminMode: (value: boolean) => void;
  setCloudflareAdminAuthenticated: (value: boolean) => void;
  setSecretMenuUnlocked: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  language: (i18n.language as SupportedLanguage) || 'en',
  fontScale: DEFAULT_FONT_SCALE,
  selectedDateISO: null,
  adminMode: false,
  cloudflareAdminAuthenticated: false,
  secretMenuUnlocked: false,
  hydratePreferences: async () => {
    const [savedLanguage, savedFontScale, hadAuthToken, staffModeFlag, legacyPasscode] =
      await Promise.all([
        secureStorage.getItem(LANGUAGE_KEY),
        secureStorage.getItem(FONT_SCALE_KEY),
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
  setSelectedDateISO: (selectedDateISO) => set({ selectedDateISO }),
  setAdminMode: (value) => set({ adminMode: value }),
  setCloudflareAdminAuthenticated: (value) => set({ cloudflareAdminAuthenticated: value }),
  setSecretMenuUnlocked: (value) => set({ secretMenuUnlocked: value }),
}));
