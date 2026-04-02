import i18n from 'i18next';
import { create } from 'zustand';

import {
  hasAdminAuthToken,
  loginStaffThroughCloudflare,
  verifyAdminCloudflareSession,
} from '../services/api/adminAuth';
import { canUseEventsApi } from '../services/api/eventsRepository';
import { secureStorage } from '../services/storage/secureStorage';
import type { SupportedLanguage } from '../types/language';

const LANGUAGE_KEY = 'app.language';
const STORED_STUFF_PASSCODE_KEY = 'auth.staffPasscode';

type AppState = {
  isHydrated: boolean;
  language: SupportedLanguage;
  selectedDateISO: string | null;
  adminMode: boolean;
  cloudflareAdminAuthenticated: boolean;
  secretMenuUnlocked: boolean;
  hydratePreferences: () => Promise<void>;
  setLanguage: (language: SupportedLanguage) => void;
  setSelectedDateISO: (dateISO: string | null) => void;
  setAdminMode: (value: boolean) => void;
  setCloudflareAdminAuthenticated: (value: boolean) => void;
  setSecretMenuUnlocked: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  language: (i18n.language as SupportedLanguage) || 'en',
  selectedDateISO: null,
  adminMode: false,
  cloudflareAdminAuthenticated: false,
  secretMenuUnlocked: false,
  hydratePreferences: async () => {
    const [savedLanguage, hadAuthToken, storedStuffPasscode] = await Promise.all([
      secureStorage.getItem(LANGUAGE_KEY),
      hasAdminAuthToken(),
      secureStorage.getItem(STORED_STUFF_PASSCODE_KEY),
    ]);

    let cloudflareAdminAuthenticated = hadAuthToken;
    const hasStoredStuffPasscode = Boolean(storedStuffPasscode?.trim());

    if (savedLanguage === 'en' || savedLanguage === 'ko') {
      await i18n.changeLanguage(savedLanguage);
      set({ language: savedLanguage });
    }

    if (hasStoredStuffPasscode && canUseEventsApi()) {
      try {
        const existingSessionOk = await verifyAdminCloudflareSession();
        if (existingSessionOk) {
          cloudflareAdminAuthenticated = true;
        } else {
          const loginResult = await loginStaffThroughCloudflare(storedStuffPasscode!.trim());
          cloudflareAdminAuthenticated = loginResult.ok;
        }
      } catch (error) {
        console.warn('[App] staff passcode bootstrap failed:', error);
      }
    }

    set({
      isHydrated: true,
      adminMode: hasStoredStuffPasscode,
      cloudflareAdminAuthenticated,
    });
  },
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    void secureStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },
  setSelectedDateISO: (selectedDateISO) => set({ selectedDateISO }),
  setAdminMode: (value) => set({ adminMode: value }),
  setCloudflareAdminAuthenticated: (value) => set({ cloudflareAdminAuthenticated: value }),
  setSecretMenuUnlocked: (value) => set({ secretMenuUnlocked: value }),
}));
