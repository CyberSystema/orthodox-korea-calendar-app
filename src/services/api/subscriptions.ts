import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { secureStorage } from '../storage/secureStorage';
import { useAppStore } from '../../store/useAppStore';

import { backendClient } from './backendClient';

const PUSH_TOKEN_KEY = 'app.pushSubscriptionToken';
const PUSH_LANGUAGE_KEY = 'app.pushSubscriptionLanguage';
const PUSH_ENV_KEY = 'app.pushSubscriptionEnvironment';

// Register with the user's actual language so the backend can localize push
// content — it only sends Korean text to subscribers stored as 'ko'. Registering
// as 'all' (the previous behavior) meant Korean users always received English.
function getSubscriptionLanguage(): 'en' | 'ko' {
  return useAppStore.getState().language === 'ko' ? 'ko' : 'en';
}

// Match the APNS environment to the actual build type.
// Development builds receive sandbox tokens from iOS; sending a sandbox
// token through the production APNS gateway silently fails.
function getPushEnvironment(): 'sandbox' | 'production' {
  return __DEV__ ? 'sandbox' : 'production';
}

function getPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

async function getCurrentPushToken(): Promise<string> {
  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === 'string' ? token.data : '';
}

export async function registerCurrentPushSubscription(options?: { force?: boolean }): Promise<boolean> {
  // Push tokens are only available on physical devices, not simulators/emulators
  if (!Device.isDevice) {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    return false;
  }

  const token = await getCurrentPushToken().catch((err) => {
    console.warn('[Push] failed to get device push token:', err);
    return '';
  });
  if (!token) {
    return false;
  }

  const language = getSubscriptionLanguage();
  const environment = getPushEnvironment();

  const [storedToken, storedLanguage, storedEnv] = await Promise.all([
    secureStorage.getItem(PUSH_TOKEN_KEY),
    secureStorage.getItem(PUSH_LANGUAGE_KEY),
    secureStorage.getItem(PUSH_ENV_KEY),
  ]);

  // Skip the API call only when nothing has changed AND we're not forcing a fresh
  // check (e.g. token-rotation listener). Registration re-runs when the token, the
  // user's language, or the APNs environment changes.
  const alreadyRegistered =
    storedToken === token &&
    storedLanguage === language &&
    storedEnv === environment;

  if (alreadyRegistered && !options?.force) {
    return true;
  }

  await backendClient.registerSubscription({
    token,
    platform: getPlatform(),
    language,
    environment,
  });
  await Promise.all([
    secureStorage.setItem(PUSH_TOKEN_KEY, token),
    secureStorage.setItem(PUSH_LANGUAGE_KEY, language),
    secureStorage.setItem(PUSH_ENV_KEY, environment),
  ]);
  return true;
}

export async function unregisterCurrentPushSubscription(): Promise<void> {
  const storedToken = await secureStorage.getItem(PUSH_TOKEN_KEY);
  if (!storedToken) {
    return;
  }

  try {
    await backendClient.deleteSubscription(storedToken);
  } finally {
    await Promise.all([
      secureStorage.deleteItem(PUSH_TOKEN_KEY),
      secureStorage.deleteItem(PUSH_LANGUAGE_KEY),
      secureStorage.deleteItem(PUSH_ENV_KEY),
    ]);
  }
}
