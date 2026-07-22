import { useSyncExternalStore } from 'react';

import { getCalendarDataVersion, subscribeToCalendarData } from './webCalendarSource';

/**
 * Re-renders the caller whenever calendar data changes — a background GitHub sync
 * downloaded newer JSON, or a liturgical year finished loading.
 *
 * Use the returned counter as a memo dependency so the day/month views repaint with
 * fresh data as soon as it lands, instead of only on the next app launch.
 */
export function useCalendarDataVersion(): number {
  return useSyncExternalStore(
    subscribeToCalendarData,
    getCalendarDataVersion,
    getCalendarDataVersion,
  );
}
