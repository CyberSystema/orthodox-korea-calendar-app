import dayjs from 'dayjs';

import { useEventsStore } from '../events/useEventsStore';
import { seededLiturgicalDays } from './mockLiturgicalDays';
import type { LiturgicalDay, LiturgicalEvent } from './types';
import type { SupportedLanguage } from '../../types/language';
import { localized } from './types';
import {
  ensureCalendarYear,
  getCalendarDayFromCache,
  getCalendarDaysForYearFromCache,
  getLoadedCalendarYears,
} from './webCalendarSource';

function normalizeISODate(value: string): string {
  // Calendar-day and event dates are already `YYYY-MM-DD`; take the date portion
  // directly so a value that ever carries a time/zone suffix is not shifted to an
  // adjacent day by dayjs's local-time parsing. Fall back to dayjs for anything
  // that isn't already an ISO date.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return dayjs(value).format('YYYY-MM-DD');
}

const seededDayIndex = new Map<string, LiturgicalDay>(
  seededLiturgicalDays.map((day) => [normalizeISODate(day.dateISO), day]),
);

type EventIndexes = {
  sourceRef: LiturgicalEvent[] | null;
  focusYear: number | null;
  byId: Map<string, LiturgicalEvent>;
  byDateAll: Map<string, LiturgicalEvent[]>;
  byDatePublic: Map<string, LiturgicalEvent[]>;
  byMonthAll: Map<string, LiturgicalEvent[]>;
  byMonthPublic: Map<string, LiturgicalEvent[]>;
};

const eventIndexes: EventIndexes = {
  sourceRef: null,
  focusYear: null,
  byId: new Map(),
  byDateAll: new Map(),
  byDatePublic: new Map(),
  byMonthAll: new Map(),
  byMonthPublic: new Map(),
};

function sortDayEvents(a: LiturgicalEvent, b: LiturgicalEvent): number {
  return a.title.en.localeCompare(b.title.en);
}

function sortMonthEvents(a: LiturgicalEvent, b: LiturgicalEvent): number {
  return a.dateISO.localeCompare(b.dateISO);
}

function pushToMap(map: Map<string, LiturgicalEvent[]>, key: string, event: LiturgicalEvent) {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(event);
  } else {
    map.set(key, [event]);
  }
}

// Hard cap on generated occurrences per event so a daily-recurring event can
// never blow up memory regardless of window size.
const MAX_OCCURRENCES_PER_EVENT = 1200;

/**
 * Returns the calendar dates a recurring event should appear on within the given
 * window. Honors the recurrence INTERVAL (every N days/weeks/months) and the series
 * end date (`recurrenceUntil`). Each occurrence is computed as start + i*interval
 * units from the ORIGINAL start (never by re-stepping a moving cursor) so month-end
 * dates don't drift: Jan 31 stays Jan 31 → Feb 28 → Mar 31 rather than collapsing to
 * the 28th. Non-recurring events resolve to a single date.
 */
function occurrenceDatesForEvent(
  event: LiturgicalEvent,
  windowStart: dayjs.Dayjs,
  windowEnd: dayjs.Dayjs,
): string[] {
  const recurrence = event.recurrence;
  if (!recurrence || recurrence === 'none') {
    return [normalizeISODate(event.dateISO)];
  }

  const startISO = normalizeISODate(event.seriesStartDate || event.dateISO);
  const start = dayjs(startISO);
  if (!start.isValid()) {
    return [normalizeISODate(event.dateISO)];
  }

  const unit = recurrence === 'daily' ? 'day' : recurrence === 'weekly' ? 'week' : 'month';
  const interval = Math.max(1, Math.floor(event.recurrenceInterval ?? 1));

  // Stop at the earlier of the series end date (recurrenceUntil) and the window end,
  // so a bounded series does not keep generating occurrences past its end.
  const untilISO = event.recurrenceUntil ? normalizeISODate(event.recurrenceUntil) : null;
  const until = untilISO ? dayjs(untilISO) : null;
  const seriesEnd = until && until.isValid() && until.isBefore(windowEnd) ? until : windowEnd;

  // Jump close to the window start. Occurrences before it are skipped precisely by
  // the guard below; the small negative margin absorbs month-clamping slack in the
  // diff estimate so no boundary occurrence is missed.
  let i = 0;
  if (start.isBefore(windowStart)) {
    const rawUnits = windowStart.diff(start, unit);
    i = Math.max(0, Math.floor(rawUnits / interval) - 2);
  }

  const dates: string[] = [];
  while (dates.length < MAX_OCCURRENCES_PER_EVENT) {
    const occurrence = start.add(i * interval, unit);
    if (occurrence.isAfter(seriesEnd)) {
      break;
    }
    if (!occurrence.isBefore(windowStart)) {
      dates.push(occurrence.format('YYYY-MM-DD'));
    }
    i += 1;
  }

  // Guarantee the canonical start date is represented even if it sits outside the
  // window, so the event is never wholly absent.
  return dates.length ? dates : [normalizeISODate(event.dateISO)];
}

function rebuildEventIndexes(focusYear: number) {
  const customEvents = useEventsStore.getState().customEvents;
  if (eventIndexes.sourceRef === customEvents && eventIndexes.focusYear === focusYear) {
    return;
  }

  // Expand recurring events within a 3-year window centered on the year being
  // viewed, so navigating to any year shows its occurrences (rather than only
  // currentYear±1, which made recurring events vanish when browsing far ahead/back).
  const windowStart = dayjs(`${focusYear - 1}-01-01`);
  const windowEnd = dayjs(`${focusYear + 1}-12-31`);

  const allEvents = customEvents;
  const byId = new Map<string, LiturgicalEvent>();
  const byDateAll = new Map<string, LiturgicalEvent[]>();
  const byDatePublic = new Map<string, LiturgicalEvent[]>();
  const byMonthAll = new Map<string, LiturgicalEvent[]>();
  const byMonthPublic = new Map<string, LiturgicalEvent[]>();

  for (const event of allEvents) {
    byId.set(event.id, event);
    const isPublic = !event.isAdminDraft;
    const occurrenceDates = occurrenceDatesForEvent(event, windowStart, windowEnd);

    for (const occurrenceDate of occurrenceDates) {
      const monthKey = occurrenceDate.slice(0, 7);

      pushToMap(byDateAll, occurrenceDate, event);
      pushToMap(byMonthAll, monthKey, event);

      if (isPublic) {
        pushToMap(byDatePublic, occurrenceDate, event);
        pushToMap(byMonthPublic, monthKey, event);
      }
    }
  }

  for (const map of [byDateAll, byDatePublic]) {
    for (const [, bucket] of map) {
      bucket.sort(sortDayEvents);
    }
  }

  for (const map of [byMonthAll, byMonthPublic]) {
    for (const [, bucket] of map) {
      bucket.sort(sortMonthEvents);
    }
  }

  eventIndexes.sourceRef = customEvents;
  eventIndexes.focusYear = focusYear;
  eventIndexes.byId = byId;
  eventIndexes.byDateAll = byDateAll;
  eventIndexes.byDatePublic = byDatePublic;
  eventIndexes.byMonthAll = byMonthAll;
  eventIndexes.byMonthPublic = byMonthPublic;
}

export function getEventsByDate(dateISO: string, includeDrafts = false): LiturgicalEvent[] {
  const normalized = normalizeISODate(dateISO);
  rebuildEventIndexes(Number.parseInt(normalized.slice(0, 4), 10) || dayjs().year());
  const source = includeDrafts ? eventIndexes.byDateAll : eventIndexes.byDatePublic;
  const events = source.get(normalized)?.slice() || [];
  return events.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export function getEventsByMonth(
  year: number,
  month1to12: number,
  includeDrafts = false,
): LiturgicalEvent[] {
  const prefix = `${year}-${String(month1to12).padStart(2, '0')}`;
  rebuildEventIndexes(year);
  const source = includeDrafts ? eventIndexes.byMonthAll : eventIndexes.byMonthPublic;
  const bucket = source.get(prefix) || [];
  // A recurring event appears once per occurrence date in the month bucket;
  // dedupe by id so callers see each event a single time.
  const seen = new Set<string>();
  const unique: LiturgicalEvent[] = [];
  for (const event of bucket) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      unique.push(event);
    }
  }
  return unique.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/**
 * Number of event occurrences on each date of a given month, keyed by ISO date.
 * Reflects recurring-event expansion, so the month grid shows a pip on every
 * date an event actually falls on (not only its series start).
 */
export function getEventOccurrenceCountsForMonth(
  year: number,
  month1to12: number,
  includeDrafts = false,
): Map<string, number> {
  rebuildEventIndexes(year);
  const prefix = `${year}-${String(month1to12).padStart(2, '0')}`;
  const source = includeDrafts ? eventIndexes.byDateAll : eventIndexes.byDatePublic;
  const counts = new Map<string, number>();
  for (const [dateISO, bucket] of source) {
    if (dateISO.startsWith(prefix)) {
      counts.set(dateISO, bucket.length);
    }
  }
  return counts;
}

export function getEventById(eventId: string): LiturgicalEvent | undefined {
  // byId does not depend on the occurrence window, so reuse the current focus year
  // (or the current year) rather than forcing a rebuild to a different window.
  rebuildEventIndexes(eventIndexes.focusYear ?? dayjs().year());
  return eventIndexes.byId.get(eventId);
}

export function getEventCountByDate(dateISO: string, includeDrafts = false): number {
  return getEventsByDate(dateISO, includeDrafts).length;
}

export function getLiturgicalDayByDate(dateISO: string): LiturgicalDay | null {
  const normalized = normalizeISODate(dateISO);
  return getCalendarDayFromCache(normalized) || seededDayIndex.get(normalized) || null;
}

export type LiturgicalSearchResult = {
  dateISO: string;
  label: string;
  kind: 'celebration' | 'saint' | 'reading';
};

function normalizedSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function buildYearSet(targetYears: number[]): number[] {
  const combined = [...targetYears, ...getLoadedCalendarYears()];
  return Array.from(new Set(combined)).sort((a, b) => a - b);
}

export async function searchLiturgicalContent(
  query: string,
  language: SupportedLanguage,
  targetYears: number[],
): Promise<LiturgicalSearchResult[]> {
  const needle = normalizedSearchText(query);
  if (!needle) return [];

  const years = buildYearSet(targetYears);
  await Promise.all(years.map((year) => ensureCalendarYear(year)));

  const results: LiturgicalSearchResult[] = [];

  for (const year of years) {
    const days = getCalendarDaysForYearFromCache(year);
    for (const day of days) {
      const celebrations =
        language === 'ko'
          ? day.celebrationsLocalized?.ko || day.celebrations
          : day.celebrationsLocalized?.en || day.celebrations;

      const saints =
        language === 'ko'
          ? day.saintsLocalized?.ko || day.saints || []
          : day.saintsLocalized?.en || day.saints || [];

      const readings =
        language === 'ko'
          ? day.readingsLocalized?.ko || day.readings
          : day.readingsLocalized?.en || day.readings;

      for (const entry of celebrations) {
        const label = localized(entry.title, language);
        if (normalizedSearchText(label).includes(needle)) {
          results.push({ dateISO: day.dateISO, label, kind: 'celebration' });
        }
      }

      for (const entry of saints) {
        const label = localized(entry.title, language);
        if (normalizedSearchText(label).includes(needle)) {
          results.push({ dateISO: day.dateISO, label, kind: 'saint' });
        }
      }

      for (const reading of readings) {
        if (normalizedSearchText(reading).includes(needle)) {
          results.push({ dateISO: day.dateISO, label: reading, kind: 'reading' });
        }
      }
    }
  }

  return results
    .sort((a, b) =>
      a.dateISO === b.dateISO ? a.label.localeCompare(b.label) : a.dateISO.localeCompare(b.dateISO),
    )
    .slice(0, 80);
}

export { getCalendarDataVersion } from './webCalendarSource';

export async function ensureLiturgicalYear(year: number): Promise<boolean> {
  return ensureCalendarYear(year);
}
