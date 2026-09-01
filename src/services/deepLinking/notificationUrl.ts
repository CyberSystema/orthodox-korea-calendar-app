// URL normalization and the notification-payload allowlist, extracted from
// `linking.ts` so BOTH it and `services/notifications/oneSignal.ts` can use them.
// oneSignal.ts turns a OneSignal click into a URL, and linking.ts consumes that URL —
// keeping these here is what stops the two modules importing each other in a cycle.
//
// The logic is unchanged from when it lived in linking.ts. In particular
// `getNotificationUrl` stays FAIL-CLOSED: a payload that carries a `url` which is not
// on the allowlist returns null rather than falling through to eventId routing, so a
// forged or compromised push cannot steer the app to an arbitrary destination.

export const APP_LINK_ORIGINS = ['https://orthodox-korea-calendar.pages.dev'];

export function normalizeIncomingUrl(url: string | null): string | null {
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

export function getNotificationUrl(data: Record<string, unknown> | null): string | null {
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
