import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from '../../navigation/types';
import { setNotificationUrlListener, takePendingNotificationUrl } from '../notifications/oneSignal';

import { APP_LINK_ORIGINS, normalizeIncomingUrl } from './notificationUrl';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'okncalendar://', ...APP_LINK_ORIGINS],
  async getInitialURL() {
    const appURL = await Linking.getInitialURL();
    if (appURL) {
      return normalizeIncomingUrl(appURL);
    }

    // A notification tap that cold-launched the app. OneSignal's click listener is
    // registered at module load (App.tsx → initOneSignal), so by the time the
    // navigation container mounts — which this app gates behind hydration, fonts and
    // a 1.8s minimum splash — the URL is already buffered. Drained synchronously:
    // a launch with no notification must not pay for a timeout here.
    return takePendingNotificationUrl();
  },
  subscribe(listener) {
    const appSubscription = Linking.addEventListener('url', ({ url }) => {
      const normalizedUrl = normalizeIncomingUrl(url);
      if (normalizedUrl) {
        listener(normalizedUrl);
      }
    });

    // Also replays a click that arrived between getInitialURL() and now.
    setNotificationUrlListener(listener);

    return () => {
      appSubscription.remove();
      setNotificationUrlListener(null);
    };
  },
  config: {
    // REQUIRED for a deep link to be escapable. React Navigation builds the
    // navigation state for an incoming URL with getStateFromPath, which reads THIS
    // config and never consults the navigator's own initialRouteName prop — so
    // without this line a link straight to EventDetail produces a stack containing
    // only EventDetail, with nothing beneath it: no back button, no way out of the
    // screen short of force-quitting. With it, MainTabs is placed underneath first.
    //
    // Found by the first genuine deep-link test. It predates the OneSignal work —
    // the old expo-notifications path built its state the same way — it had simply
    // never been exercised, because a notification without an eventId opens Today
    // and neither the dashboard composer nor the console's plain test pushes carry one.
    initialRouteName: 'MainTabs',
    screens: {
      MainTabs: {
        screens: {
          Today: 'today',
          Month: 'month',
        },
      },
      EventDetail: {
        path: 'event/:eventId',
        parse: {
          eventId: (value: string) => value,
          dateISO: (value: string) => value,
        },
      },
      Settings: 'settings',
    },
  },
};
