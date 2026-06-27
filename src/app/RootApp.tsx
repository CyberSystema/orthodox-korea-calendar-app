import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { Alert, Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../i18n';
import { syncCalendarDataFromGithub } from '../features/calendar/webCalendarSource';
import { RootNavigator } from '../navigation/RootNavigator';
import { useEventsStore } from '../features/events/useEventsStore';
import { registerCurrentPushSubscription } from '../services/api/subscriptions';
import { linking } from '../services/deepLinking/linking';
import {
  initializeNotifications,
  runLaunchNotificationPermissionFlow,
} from '../services/notifications/notifications';
import { useAppStore } from '../store/useAppStore';
import { ByzantineSplashScreen } from '../components/common/ByzantineSplashScreen';
import { navigationTheme } from '../theme/navigationTheme';

export function RootApp() {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydratePreferences = useAppStore((state) => state.hydratePreferences);
  const eventsHydrated = useEventsStore((state) => state.isHydrated);
  const hydrateEvents = useEventsStore((state) => state.hydrateEvents);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let deniedSuggestionTimeout: ReturnType<typeof setTimeout> | null = null;

    const bootstrap = async () => {
      await initializeNotifications().catch((err) =>
        console.warn('[Notifications] init failed:', err),
      );
      await hydratePreferences().catch((err) =>
        console.warn('[App] preference hydration failed:', err),
      );
      await hydrateEvents().catch((err) =>
        console.warn('[App] event hydration failed:', err),
      );

      try {
        const flowResult = await runLaunchNotificationPermissionFlow();
        if (flowResult.shouldSuggestOpeningSettings) {
          deniedSuggestionTimeout = setTimeout(() => {
            if (cancelled) {
              return;
            }

            Alert.alert(
              i18n.t('settings.notificationReminderTitle'),
              i18n.t('settings.notificationReminderBody'),
              [
                { text: i18n.t('settings.notificationReminderLater'), style: 'cancel' },
                {
                  text: i18n.t('settings.notificationReminderOpenSettings'),
                  onPress: () => {
                    void Linking.openSettings().catch((error) => {
                      console.warn('[Notifications] open settings failed:', error);
                    });
                  },
                },
              ],
            );
          }, 12000);
        }

        if (flowResult.status === 'granted') {
          await registerCurrentPushSubscription().catch((err) =>
            console.warn('[Push] registration after permission grant failed:', err),
          );
        }
      } catch (err) {
        console.warn('[Notifications] permission request failed:', err);
      }

      // Background refresh only when cached data is stale (checked inside).
      // Use InteractionManager + setTimeout to avoid contention with UI.
      setTimeout(() => {
        if (!cancelled) {
          void syncCalendarDataFromGithub();
        }
      }, 5000);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (deniedSuggestionTimeout) {
        clearTimeout(deniedSuggestionTimeout);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    // force=true: always hit the backend on every launch so the subscription
    // is guaranteed active even if the backend lost it between launches.
    void registerCurrentPushSubscription({ force: true }).catch((err) =>
      console.warn('[Push] subscription registration failed:', err),
    );
  }, [isHydrated]);

  useEffect(() => {
    // Re-register whenever the OS rotates the push token
    const subscription = Notifications.addPushTokenListener(() => {
      void registerCurrentPushSubscription().catch((err) =>
        console.warn('[Push] token rotation re-registration failed:', err),
      );
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Brief branded splash moment; the screen is dismissed as soon as hydration
    // finishes (typically faster than this), so this only bounds the minimum.
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated || !eventsHydrated || !minSplashElapsed) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="light" />
          <ByzantineSplashScreen />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking} theme={navigationTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
