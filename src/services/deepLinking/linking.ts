import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import type { RootStackParamList } from '../../navigation/types';

const prefix = Linking.createURL('/');

function extractData(
  response: Notifications.NotificationResponse,
): Record<string, unknown> | null {
  // For Expo push notifications, data lives in content.data
  const contentData = response.notification.request.content.data;
  if (contentData && typeof contentData === 'object' && Object.keys(contentData).length > 0) {
    return contentData;
  }

  // For native APNs push notifications, data lives in trigger.payload
  const trigger = response.notification.request.trigger;
  if (trigger && typeof trigger === 'object' && 'payload' in trigger) {
    const payload = (trigger as { payload?: unknown }).payload;
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }
  }

  return null;
}

function getNotificationUrl(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  if (typeof data.url === 'string' && data.url) return data.url;
  const eventId = data.eventId ?? data.event_id;
  if (typeof eventId === 'string' && eventId) return `orthodoxkorea://event/${eventId}`;
  return null;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'orthodoxkorea://'],
  async getInitialURL() {
    const appURL = await Linking.getInitialURL();
    if (appURL) {
      return appURL;
    }

    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return getNotificationUrl(extractData(response));
  },
  subscribe(listener) {
    const appSubscription = Linking.addEventListener('url', ({ url }) => listener(url));

    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const notificationURL = getNotificationUrl(extractData(response));
      if (notificationURL) {
        listener(notificationURL);
      }
    });

    return () => {
      appSubscription.remove();
      notificationSubscription.remove();
    };
  },
  config: {
    screens: {
      MainTabs: {
        screens: {
          Today: 'today',
          Month: 'month',
        },
      },
      EventDetail: 'event/:eventId',
      Settings: 'settings',
    },
  },
};
