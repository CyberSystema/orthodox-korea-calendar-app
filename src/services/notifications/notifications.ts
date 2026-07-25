import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { secureStorage } from '../storage/secureStorage';
import type { SupportedLanguage } from '../../types/language';

// Storage key from the old "remind me to open Settings" flow. Purged on launch so a
// stale value can't linger on devices upgrading from a build that wrote it.
const LEGACY_DENIED_SUGGESTION_AT_KEY = 'notifications.deniedSuggestionAt';

type LaunchPermissionFlowResult = {
  status: Notifications.PermissionStatus;
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

/**
 * Ask for notification permission once, using the SYSTEM dialog — the user grants or
 * denies right there and we accept the answer.
 *
 * Deliberately no follow-up nagging: an earlier flow popped a custom "open Settings"
 * alert after a denial, which is an extra hop the user never asked for. If permission
 * was already denied, the OS will not present the dialog again (Android blocks the
 * re-ask, iOS allows it only once), so there is nothing to do — the app simply works
 * without notifications until the user enables them in system settings themselves.
 */
export async function runLaunchNotificationPermissionFlow(): Promise<LaunchPermissionFlowResult> {
  // One-time cleanup of the retired reminder timestamp.
  void secureStorage.deleteItem(LEGACY_DENIED_SUGGESTION_AT_KEY).catch(() => {});

  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return { status: current.status };
  }

  // Ask whenever the OS still allows a prompt — do NOT gate on 'undetermined'.
  // On Android 13+ POST_NOTIFICATIONS reports 'denied' (not 'undetermined') before
  // the user has ever chosen, because areNotificationsEnabled() is simply false, so
  // an 'undetermined' check would skip the request and no dialog would ever appear.
  // `canAskAgain` is the reliable signal: false means Android/iOS will no longer
  // present the dialog, and calling request would be a silent no-op.
  if (!current.canAskAgain) {
    return { status: current.status };
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return { status: requested.status };
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
