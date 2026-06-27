import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import type { RootStackParamList } from '../../navigation/types';

const prefix = Linking.createURL('/');
const APP_LINK_ORIGINS = ['https://orthodox-korea-calendar.pages.dev'];

function normalizeIncomingUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith('okncalendar://')) {
    return url;
  }

  if (!APP_LINK_ORIGINS.some((origin) => url.startsWith(origin))) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const eventId = parsed.searchParams.get('event');
    const dateISO = parsed.searchParams.get('date') || parsed.searchParams.get('dateISO');
    const view = parsed.searchParams.get('view');

    if (eventId) {
      const encodedId = encodeURIComponent(eventId);
      if (dateISO) {
        return `okncalendar://event/${encodedId}?dateISO=${encodeURIComponent(dateISO)}`;
      }
      return `okncalendar://event/${encodedId}`;
    }

    if (view === 'today') {
      return 'okncalendar://today';
    }
  } catch {
    return url;
  }

  return url;
}

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
  // Only honour an explicit `url` if it targets our own scheme or an allowlisted
  // app-link origin. Push payloads come from our backend, but validating here
  // keeps a forged/compromised push from steering the app to an arbitrary URL.
  if (typeof data.url === 'string' && data.url) {
    const candidateUrl = data.url;
    if (
      candidateUrl.startsWith('okncalendar://') ||
      APP_LINK_ORIGINS.some((origin) => candidateUrl.startsWith(origin))
    ) {
      return candidateUrl;
    }
    return null;
  }
  const eventId = data.eventId ?? data.event_id;
  const eventDate = data.dateISO ?? data.date ?? data.eventDate ?? data.event_date;
  if (typeof eventId === 'string' && eventId) {
    const encodedId = encodeURIComponent(eventId);
    if (typeof eventDate === 'string' && eventDate) {
      const encodedDate = encodeURIComponent(eventDate);
      return `okncalendar://event/${encodedId}?dateISO=${encodedDate}`;
    }

    return `okncalendar://event/${encodedId}`;
  }
  return null;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'okncalendar://', ...APP_LINK_ORIGINS],
  async getInitialURL() {
    const appURL = await Linking.getInitialURL();
    if (appURL) {
      return normalizeIncomingUrl(appURL);
    }

    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return normalizeIncomingUrl(getNotificationUrl(extractData(response)));
  },
  subscribe(listener) {
    const appSubscription = Linking.addEventListener('url', ({ url }) => {
      const normalizedUrl = normalizeIncomingUrl(url);
      if (normalizedUrl) {
        listener(normalizedUrl);
      }
    });

    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const notificationURL = normalizeIncomingUrl(getNotificationUrl(extractData(response)));
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
