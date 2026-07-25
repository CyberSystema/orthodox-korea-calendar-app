import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { secureStorage } from '../storage/secureStorage';
import type { SupportedLanguage } from '../../types/language';

const NOTIFICATION_DENIED_SUGGESTION_AT_KEY = 'notifications.deniedSuggestionAt';
const DENIED_SUGGESTION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

type LaunchPermissionFlowResult = {
  status: Notifications.PermissionStatus;
  shouldSuggestOpeningSettings: boolean;
};

export async function initializeNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calendar-reminders', {
      name: 'Calendar Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function requestNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return current.status;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return requested.status;
}

export async function runLaunchNotificationPermissionFlow(): Promise<LaunchPermissionFlowResult> {
  const now = Date.now();
  const current = await Notifications.getPermissionsAsync();

  if (current.status === 'granted') {
    await secureStorage.deleteItem(NOTIFICATION_DENIED_SUGGESTION_AT_KEY);
    return { status: current.status, shouldSuggestOpeningSettings: false };
  }

  if (current.status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (requested.status === 'granted') {
      await secureStorage.deleteItem(NOTIFICATION_DENIED_SUGGESTION_AT_KEY);
      return { status: requested.status, shouldSuggestOpeningSettings: false };
    }

    if (requested.status === 'denied') {
      await secureStorage.setItem(NOTIFICATION_DENIED_SUGGESTION_AT_KEY, String(now));
      return { status: requested.status, shouldSuggestOpeningSettings: true };
    }

    return { status: requested.status, shouldSuggestOpeningSettings: false };
  }

  const lastSuggestionAtRaw = await secureStorage.getItem(NOTIFICATION_DENIED_SUGGESTION_AT_KEY);
  const lastSuggestionAt = Number(lastSuggestionAtRaw);
  const hasValidTimestamp = Number.isFinite(lastSuggestionAt) && lastSuggestionAt > 0;
  const shouldSuggest =
    !hasValidTimestamp || now - lastSuggestionAt >= DENIED_SUGGESTION_COOLDOWN_MS;

  if (shouldSuggest) {
    await secureStorage.setItem(NOTIFICATION_DENIED_SUGGESTION_AT_KEY, String(now));
  }

  return { status: current.status, shouldSuggestOpeningSettings: shouldSuggest };
}

export async function scheduleLanguageTargetedLocalNotification(
  language: SupportedLanguage,
  targetLanguage: SupportedLanguage,
  title: string,
  body: string,
  secondsFromNow = 3,
) {
  if (language !== targetLanguage) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        language,
        url: 'okncalendar://today',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      channelId: 'calendar-reminders',
    },
  });
}

export async function scheduleImmediateLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  secondsFromNow = 2,
) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      channelId: 'calendar-reminders',
    },
  });
}
