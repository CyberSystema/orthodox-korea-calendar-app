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
  return dayjs(value).format('YYYY-MM-DD');
}

const seededDayIndex = new Map<string, LiturgicalDay>(
  seededLiturgicalDays.map((day) => [normalizeISODate(day.dateISO), day]),
);

type EventIndexes = {
  sourceRef: LiturgicalEvent[] | null;
  byId: Map<string, LiturgicalEvent>;
  byDateAll: Map<string, LiturgicalEvent[]>;
  byDatePublic: Map<string, LiturgicalEvent[]>;
  byMonthAll: Map<string, LiturgicalEvent[]>;
  byMonthPublic: Map<string, LiturgicalEvent[]>;
};

const eventIndexes: EventIndexes = {
  sourceRef: null,
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

function rebuildEventIndexes() {
  const customEvents = useEventsStore.getState().customEvents;
  if (eventIndexes.sourceRef === customEvents) {
    return;
  }

  const allEvents = customEvents;
  const byId = new Map<string, LiturgicalEvent>();
  const byDateAll = new Map<string, LiturgicalEvent[]>();
  const byDatePublic = new Map<string, LiturgicalEvent[]>();
  const byMonthAll = new Map<string, LiturgicalEvent[]>();
  const byMonthPublic = new Map<string, LiturgicalEvent[]>();

  for (const event of allEvents) {
    byId.set(event.id, event);
    const normalizedDate = normalizeISODate(event.dateISO);
    const monthKey = normalizedDate.slice(0, 7);
    const isPublic = !event.isAdminDraft;

    pushToMap(byDateAll, normalizedDate, event);
    pushToMap(byMonthAll, monthKey, event);

    if (isPublic) {
      pushToMap(byDatePublic, normalizedDate, event);
      pushToMap(byMonthPublic, monthKey, event);
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
  eventIndexes.byId = byId;
  eventIndexes.byDateAll = byDateAll;
  eventIndexes.byDatePublic = byDatePublic;
  eventIndexes.byMonthAll = byMonthAll;
  eventIndexes.byMonthPublic = byMonthPublic;
}

export function getEventsByDate(dateISO: string, includeDrafts = false): LiturgicalEvent[] {
  const normalized = normalizeISODate(dateISO);
  rebuildEventIndexes();
  const source = includeDrafts ? eventIndexes.byDateAll : eventIndexes.byDatePublic;
  const events = source.get(normalized)?.slice() || [];
  return events.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export function getEventsByMonth(year: number, month1to12: number, includeDrafts = false): LiturgicalEvent[] {
  const prefix = dayjs(`${year}-${month1to12}-01`).format('YYYY-MM');
  rebuildEventIndexes();
  const source = includeDrafts ? eventIndexes.byMonthAll : eventIndexes.byMonthPublic;
  const events = source.get(prefix)?.slice() || [];
  return events.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export function getEventById(eventId: string): LiturgicalEvent | undefined {
  rebuildEventIndexes();
  return eventIndexes.byId.get(eventId);
}

export function getEventCountByDate(dateISO: string, includeDrafts = false): number {
  return getEventsByDate(dateISO, includeDrafts).length;
}

export function getLiturgicalDayByDate(dateISO: string): LiturgicalDay | null {
  const normalized = normalizeISODate(dateISO);
  return (
    getCalendarDayFromCache(normalized) ||
    seededDayIndex.get(normalized) ||
    null
  );
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
  targetYears: number[]
): Promise<LiturgicalSearchResult[]> {
  const needle = normalizedSearchText(query);
  if (!needle) return [];

  const years = buildYearSet(targetYears);
  await Promise.all(years.map((year) => ensureCalendarYear(year)));

  const results: LiturgicalSearchResult[] = [];

  for (const year of years) {
    const days = getCalendarDaysForYearFromCache(year);
    for (const day of days) {
      const celebrations = language === 'ko'
        ? day.celebrationsLocalized?.ko || day.celebrations
        : day.celebrationsLocalized?.en || day.celebrations;

      const saints = language === 'ko'
        ? day.saintsLocalized?.ko || day.saints || []
        : day.saintsLocalized?.en || day.saints || [];

      const readings = language === 'ko'
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
    .sort((a, b) => (a.dateISO === b.dateISO ? a.label.localeCompare(b.label) : a.dateISO.localeCompare(b.dateISO)))
    .slice(0, 80);
}

export { getCalendarDataVersion } from './webCalendarSource';

export async function ensureLiturgicalYear(year: number): Promise<boolean> {
  return ensureCalendarYear(year);
}
