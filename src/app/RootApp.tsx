import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { Alert, Animated, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

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
import { initNetworkMonitor, useNetworkStore } from '../store/useNetworkStore';
import { verifyAdminCloudflareSession } from '../services/api/adminAuth';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { ByzantineSplashScreen } from '../components/common/ByzantineSplashScreen';
import { colors } from '../theme/colors';
import { navigationTheme } from '../theme/navigationTheme';

export function RootApp() {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydratePreferences = useAppStore((state) => state.hydratePreferences);
  const eventsHydrated = useEventsStore((state) => state.isHydrated);
  const hydrateEvents = useEventsStore((state) => state.hydrateEvents);
  const adminMode = useAppStore((state) => state.adminMode);
  const setCloudflareAdminAuthenticated = useAppStore((state) => state.setCloudflareAdminAuthenticated);
  const language = useAppStore((state) => state.language);
  const isOnline = useNetworkStore((state) => state.isOnline);
  const wasOnlineRef = useRef(true);
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

    // force=true: always hit the backend on every launch so the subscription is
    // guaranteed active even if the backend lost it between launches. Also re-runs
    // when the user changes language, so push content is localized to their choice.
    void registerCurrentPushSubscription({ force: true }).catch((err) =>
      console.warn('[Push] subscription registration failed:', err),
    );
  }, [isHydrated, language]);

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
    // When a push arrives while the app is foregrounded (e.g. an admin just created
    // an event), force a resync so the new event appears in the list/grid promptly
    // instead of waiting for the next periodic sync.
    const received = Notifications.addNotificationReceivedListener(() => {
      void useEventsStore
        .getState()
        .syncYearEvents(new Date().getFullYear(), { force: true })
        .catch((err) => console.warn('[Push] foreground refresh failed:', err));
    });
    return () => received.remove();
  }, []);

  useEffect(() => {
    // Monitor connectivity so the app can show the offline banner and gate
    // online-only features (event sync, Staff Mode).
    let cleanup: (() => void) | undefined;
    void initNetworkMonitor().then((unsubscribe) => {
      cleanup = unsubscribe;
    });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    // Act only on a genuine offline -> online transition, after hydration.
    if (!isHydrated || !isOnline || wasOnline) {
      return;
    }
    // Reconnected: recall the staff session token (NEVER re-prompt for the passcode)
    // and resume the things that need the network.
    if (adminMode) {
      void verifyAdminCloudflareSession()
        .then(setCloudflareAdminAuthenticated)
        .catch((err) => console.warn('[App] staff session re-verify on reconnect failed:', err));
    }
    void registerCurrentPushSubscription({ force: true }).catch((err) =>
      console.warn('[Push] reconnect re-registration failed:', err),
    );
    void syncCalendarDataFromGithub();
  }, [isOnline, isHydrated, adminMode, setCloudflareAdminAuthenticated]);

  useEffect(() => {
    // Brief branded splash moment; the screen is dismissed as soon as hydration
    // finishes (typically faster than this), so this only bounds the minimum.
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const appReady = isHydrated && eventsHydrated && minSplashElapsed;
  const [splashMounted, setSplashMounted] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Crossfade the splash out once the app is ready, revealing the (already
  // mounted) main app underneath. Rendering both inside one persistent
  // brand-colored container — instead of a hard if/else swap — removes the white
  // flash between the splash and the main screen.
  useEffect(() => {
    if (!appReady) {
      return;
    }
    const animation = Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setSplashMounted(false);
      }
    });
    return () => animation.stop();
  }, [appReady, splashOpacity]);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={styles.root}>
        <StatusBar style="light" />
        {appReady ? (
          <View style={styles.appHost}>
            <View style={styles.navHost}>
              <NavigationContainer linking={linking} theme={navigationTheme}>
                <RootNavigator />
              </NavigationContainer>
            </View>
            <OfflineBanner />
          </View>
        ) : null}
        {splashMounted ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
          >
            <ByzantineSplashScreen />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Brand background behind everything, so any frame where neither the splash
    // nor a screen has painted shows the brand color instead of white.
    backgroundColor: colors.primaryDeep,
  },
  // Column: the navigator fills, and the offline banner (when visible) takes its
  // height at the bottom, lifting the content above it.
  appHost: {
    flex: 1,
  },
  navHost: {
    flex: 1,
  },
});
