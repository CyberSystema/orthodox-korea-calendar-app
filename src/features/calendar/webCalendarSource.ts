import * as FileSystem from 'expo-file-system/legacy';

import { BUNDLED_CALENDAR_YEARS } from './bundledCalendarData.generated';
import type { LiturgicalDay, CelebrationEntry } from './types';

type WebContentFields = {
  title: string;
  high_rank?: boolean;
  celeb?: boolean;
  readings?: string[];
  tone?: string;
  m_gosp?: string;
};

type WebContentItem = {
  id: string;
  fields: WebContentFields;
};

type WebCalendarDay = {
  date: string;
  fast: boolean;
  cheese: boolean;
  fish: boolean;
  pres: boolean;
  saint_basil: boolean;
  dl: boolean;
  readings: string[];
  content: WebContentItem[];
};

type WebLanguage = 'en' | 'kr';

const configuredAppDataBaseUrl = process.env.EXPO_PUBLIC_CALENDAR_DATA_BASE_URL?.trim() || '';
const REMOTE_BASE_GITHUB =
  'https://raw.githubusercontent.com/CyberSystema/orthodox-korea-calendar/refs/heads/main/public/data/';
const GITHUB_CONTENTS_API =
  'https://api.github.com/repos/CyberSystema/orthodox-korea-calendar/contents/public/data';
const STORAGE_DIR = `${FileSystem.documentDirectory || ''}calendar-data`;
const MANIFEST_PATH = `${STORAGE_DIR}/manifest.json`;

const yearCache: Record<number, LiturgicalDay[]> = {};
const yearDateIndex: Record<number, Map<string, LiturgicalDay>> = {};
const unavailableYears = new Set<number>();
const loadingYears = new Map<number, Promise<boolean>>();

function storeYear(year: number, days: LiturgicalDay[]) {
  yearCache[year] = days;
  const index = new Map<string, LiturgicalDay>();
  for (const day of days) {
    index.set(day.dateISO, day);
  }
  yearDateIndex[year] = index;
}

function clearYear(year: number) {
  delete yearCache[year];
  delete yearDateIndex[year];
}

// The calendar JSON lives in a public GitHub repo and is edited outside the app, so the
// app checks the repository for changes on EVERY startup. The check is a single
// Contents-API request comparing each file's sha; a file is downloaded and migrated
// into the local cache only when it actually changed.
//
// These live in module scope, so a cold start (a fresh JS process) always resets them
// and re-checks. They only dedupe repeat calls inside a single session.
let syncInFlight: Promise<void> | null = null;
let checkedThisSession = false;

type GithubDataFile = {
  name: string;
  download_url: string | null;
  sha: string;
  type: string;
};

type LocalManifest = {
  files: Record<string, string>;
  lastSyncedAt?: number;
};

function entriesFromDay(
  day: WebCalendarDay | undefined,
  language: WebLanguage,
  fallbackDate: string,
): CelebrationEntry[] {
  if (!day) return [];

  return (day.content || []).map((item, index) => ({
    id: item.id || `${fallbackDate}_${language}_${index}`,
    title: {
      en: item.fields.title,
      ko: item.fields.title,
    },
    highRank: Boolean(item.fields.high_rank),
    feast: Boolean(item.fields.celeb || item.fields.high_rank),
    celeb: Boolean(item.fields.celeb),
    readings: item.fields.readings || [],
    tone: item.fields.tone,
    matinsGospel: item.fields.m_gosp,
  }));
}

function splitEntries(entries: CelebrationEntry[]) {
  const celebrations = entries.filter((entry) => entry.feast || entry.highRank || entry.celeb);
  const saints = entries.filter((entry) => !celebrations.some((c) => c.id === entry.id));
  return { celebrations, saints };
}

function mapToLiturgicalDays(enDays: WebCalendarDay[], krDays: WebCalendarDay[]): LiturgicalDay[] {
  const koByDate = new Map<string, WebCalendarDay>(krDays.map((day) => [day.date, day]));

  return enDays.map((enDay) => {
    const koDay = koByDate.get(enDay.date);
    const enEntries = entriesFromDay(enDay, 'en', enDay.date);
    const koEntries = entriesFromDay(koDay, 'kr', enDay.date);

    const { celebrations: enCelebrations, saints: enSaints } = splitEntries(enEntries);
    const { celebrations: koCelebrations, saints: koSaints } = splitEntries(koEntries);

    return {
      dateISO: enDay.date,
      fast: enDay.fast,
      cheese: enDay.cheese,
      fish: enDay.fish,
      presanctified: enDay.pres,
      saintBasil: enDay.saint_basil,
      divineLiturgy: enDay.dl,
      readings: enDay.readings,
      readingsLocalized: {
        en: enDay.readings,
        ko: koDay?.readings || enDay.readings,
      },
      celebrations: enCelebrations,
      saints: enSaints,
      celebrationsLocalized: {
        en: enCelebrations,
        ko: koCelebrations.length ? koCelebrations : enCelebrations,
      },
      saintsLocalized: {
        en: enSaints,
        ko: koSaints.length ? koSaints : enSaints,
      },
    };
  });
}

/**
 * Offline seed for a first launch with no network. The years available here — and the
 * JSON they point at — are generated from the single source of truth (public/data/ in
 * the orthodox-korea-calendar repo) by `npm run sync:calendar-data`; never hand-edit.
 * Returns null for a year that isn't bundled, so the caller falls through to the network.
 */
function loadBundledYear(year: number): LiturgicalDay[] | null {
  const loader = BUNDLED_CALENDAR_YEARS[year];
  if (!loader) return null;

  const { en, kr } = loader();
  const enDays = en as WebCalendarDay[];
  if (!Array.isArray(enDays) || enDays.length === 0) return null;
  return mapToLiturgicalDays(enDays, (kr ?? en) as WebCalendarDay[]);
}

function parseDataFilename(name: string): { year: number; language: WebLanguage } | null {
  const match = name.match(/^(\d{4})_(en|kr)\.json$/);
  if (!match) return null;
  return {
    year: Number.parseInt(match[1], 10),
    language: match[2] as WebLanguage,
  };
}

async function ensureStorageDirectory() {
  if (!FileSystem.documentDirectory) {
    return false;
  }

  const info = await FileSystem.getInfoAsync(STORAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
  }
  return true;
}

async function readManifest(): Promise<LocalManifest> {
  const info = await FileSystem.getInfoAsync(MANIFEST_PATH);
  if (!info.exists) {
    return { files: {} };
  }

  try {
    const raw = await FileSystem.readAsStringAsync(MANIFEST_PATH);
    const parsed = JSON.parse(raw) as LocalManifest;
    if (!parsed || typeof parsed !== 'object' || !parsed.files) {
      return { files: {} };
    }
    return parsed;
  } catch {
    return { files: {} };
  }
}

async function writeManifest(manifest: LocalManifest) {
  await FileSystem.writeAsStringAsync(MANIFEST_PATH, JSON.stringify(manifest));
}

async function fetchGithubDataFiles(): Promise<GithubDataFile[]> {
  const response = await fetch(GITHUB_CONTENTS_API);
  if (!response.ok) {
    return [];
  }

  const items = (await response.json()) as GithubDataFile[];
  return items.filter((item) => item.type === 'file' && Boolean(parseDataFilename(item.name)));
}

async function readOfflineFile(name: string): Promise<WebCalendarDay[] | null> {
  const path = `${STORAGE_DIR}/${name}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return null;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as WebCalendarDay[];
  } catch {
    return null;
  }
}

async function writeOfflineFile(name: string, text: string) {
  const path = `${STORAGE_DIR}/${name}`;
  await FileSystem.writeAsStringAsync(path, text);
}

/** Monotonically increasing counter bumped whenever calendar data changes in cache. */
let _calendarDataVersion = 0;
let _lastSyncedAt: number | null = null;
const dataListeners = new Set<() => void>();

export function getCalendarDataVersion(): number {
  return _calendarDataVersion;
}

/** Epoch ms of the last completed GitHub sync (null if never synced this install). */
export function getLastCalendarSyncAt(): number | null {
  return _lastSyncedAt;
}

/**
 * Subscribe to calendar-data changes (fresh remote data downloaded, a year loaded).
 * Lets screens repaint the moment new data lands instead of waiting for a relaunch.
 */
export function subscribeToCalendarData(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

function bumpCalendarDataVersion() {
  _calendarDataVersion += 1;
  for (const listener of dataListeners) {
    try {
      listener();
    } catch {
      // A misbehaving listener must never break syncing.
    }
  }
}

/**
 * Check the calendar-data repository for changes and migrate any into the local copy.
 *
 * Runs on EVERY app start — there is no time-based throttle, so editing a JSON file and
 * relaunching immediately picks the change up. Concurrent callers share one in-flight
 * request, and repeat calls within the same session are skipped unless `force` is set.
 * `checkedThisSession` is only set once GitHub was actually reached, so a launch that
 * began offline still checks when connectivity returns.
 */
export async function syncCalendarDataFromGithub(options?: { force?: boolean }) {
  if (syncInFlight) {
    await syncInFlight;
    return;
  }
  if (checkedThisSession && !options?.force) {
    return;
  }

  syncInFlight = runCalendarSync();
  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

async function runCalendarSync(): Promise<void> {
  const storageReady = await ensureStorageDirectory();
  if (!storageReady) {
    console.warn('Calendar sync skipped: local storage is unavailable.');
    return;
  }

  const existingManifest = await readManifest();
  if (existingManifest.lastSyncedAt) {
    _lastSyncedAt = existingManifest.lastSyncedAt;
  }

  const remoteFiles = await fetchGithubDataFiles();
  if (remoteFiles.length === 0) {
    console.warn('Calendar sync skipped: no remote data files discovered.');
    return;
  }

  // Repository reached — this launch has had its check.
  checkedThisSession = true;

  const nextManifest: LocalManifest = { files: {}, lastSyncedAt: Date.now() };
  const discoveredYears = new Set<number>();
  const currentYear = new Date().getFullYear();
  const preferredYears = new Set([currentYear - 1, currentYear, currentYear + 1, 2026]);
  const refreshedYears = new Set<number>();
  let dataChanged = false;

  for (const file of remoteFiles) {
    const parsed = parseDataFilename(file.name);
    if (!parsed || !file.download_url) {
      continue;
    }

    if (!preferredYears.has(parsed.year) && !existingManifest.files[file.name]) {
      continue;
    }

    discoveredYears.add(parsed.year);
    nextManifest.files[file.name] = file.sha;

    const hasChanged = existingManifest.files[file.name] !== file.sha;
    if (!hasChanged) {
      continue;
    }

    try {
      const response = await fetch(file.download_url);
      if (!response.ok) {
        continue;
      }

      const jsonText = await response.text();
      await writeOfflineFile(file.name, jsonText);
      if (!loadingYears.has(parsed.year)) {
        clearYear(parsed.year);
        refreshedYears.add(parsed.year);
      }
      unavailableYears.delete(parsed.year);
      dataChanged = true;
    } catch {
      // Keep existing offline copy when download fails.
    }
  }

  const staleFiles = Object.keys(existingManifest.files).filter(
    (name) => !nextManifest.files[name],
  );
  for (const staleName of staleFiles) {
    try {
      await FileSystem.deleteAsync(`${STORAGE_DIR}/${staleName}`, { idempotent: true });
      const parsed = parseDataFilename(staleName);
      if (parsed) {
        if (!loadingYears.has(parsed.year)) {
          clearYear(parsed.year);
        }
        dataChanged = true;
      }
    } catch {
      // Ignore stale-file cleanup errors.
    }
  }

  discoveredYears.forEach((year) => unavailableYears.delete(year));
  await writeManifest(nextManifest);
  _lastSyncedAt = nextManifest.lastSyncedAt ?? Date.now();

  // Re-populate the in-memory cache for years we just replaced. Downloading clears the
  // year, so without this a live screen would repaint against an empty cache and show
  // "no data for this day" until the next navigation. ensureCalendarYear reads the
  // freshly written files and notifies subscribers itself.
  for (const year of refreshedYears) {
    await ensureCalendarYear(year);
  }

  if (dataChanged) {
    bumpCalendarDataVersion();
  }
}

async function fetchYearFrom(
  baseUrl: string,
  year: number,
  language: WebLanguage,
): Promise<WebCalendarDay[] | null> {
  const file = `${year}_${language}.json`;
  try {
    const response = await fetch(`${baseUrl}${file}`);
    if (!response.ok) return null;
    return (await response.json()) as WebCalendarDay[];
  } catch {
    return null;
  }
}

async function fetchYearData(
  year: number,
  language: WebLanguage,
): Promise<WebCalendarDay[] | null> {
  if (configuredAppDataBaseUrl) {
    const fromAppInfra = await fetchYearFrom(configuredAppDataBaseUrl, year, language);
    if (fromAppInfra && fromAppInfra.length > 0) {
      return fromAppInfra;
    }
  }

  const fromGithub = await fetchYearFrom(REMOTE_BASE_GITHUB, year, language);
  if (fromGithub && fromGithub.length > 0) {
    return fromGithub;
  }

  return null;
}

async function loadYearFromOfflineStorage(
  year: number,
): Promise<{ en: WebCalendarDay[]; kr: WebCalendarDay[] } | null> {
  const [en, kr] = await Promise.all([
    readOfflineFile(`${year}_en.json`),
    readOfflineFile(`${year}_kr.json`),
  ]);

  if (en && en.length > 0) {
    return { en, kr: kr && kr.length > 0 ? kr : en };
  }

  return null;
}

export async function ensureCalendarYear(year: number): Promise<boolean> {
  if (yearCache[year]) return true;
  if (unavailableYears.has(year)) return false;

  const activeLoad = loadingYears.get(year);
  if (activeLoad) return activeLoad;

  const loadPromise = (async () => {
    const fromOffline = await loadYearFromOfflineStorage(year);
    if (fromOffline) {
      storeYear(year, mapToLiturgicalDays(fromOffline.en, fromOffline.kr));
      unavailableYears.delete(year);
      bumpCalendarDataVersion();
      return true;
    }

    const bundled = loadBundledYear(year);
    if (bundled) {
      storeYear(year, bundled);
      bumpCalendarDataVersion();
      return true;
    }

    const [enDays, krDays] = await Promise.all([
      fetchYearData(year, 'en'),
      fetchYearData(year, 'kr'),
    ]);
    if (enDays && enDays.length > 0) {
      const storageReady = await ensureStorageDirectory();
      if (storageReady) {
        try {
          await writeOfflineFile(`${year}_en.json`, JSON.stringify(enDays));
          await writeOfflineFile(`${year}_kr.json`, JSON.stringify(krDays || enDays));
        } catch {
          // Ignore write errors and still return in-memory result.
        }
      }
      storeYear(year, mapToLiturgicalDays(enDays, krDays || enDays));
      unavailableYears.delete(year);
      bumpCalendarDataVersion();
      return true;
    }

    unavailableYears.add(year);
    return false;
  })();

  loadingYears.set(year, loadPromise);

  try {
    return await loadPromise;
  } finally {
    loadingYears.delete(year);
  }
}

export function isCalendarYearUnavailable(year: number): boolean {
  return unavailableYears.has(year);
}

export function getCalendarDayFromCache(dateISO: string): LiturgicalDay | null {
  const year = Number.parseInt(dateISO.slice(0, 4), 10);
  return yearDateIndex[year]?.get(dateISO) ?? null;
}

export function getCalendarDaysForYearFromCache(year: number): LiturgicalDay[] {
  return yearCache[year] || [];
}

export function getLoadedCalendarYears(): number[] {
  return Object.keys(yearCache)
    .map((key) => Number.parseInt(key, 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
}

export function preloadCalendarYears(years: number[]) {
  years.forEach((year) => {
    void ensureCalendarYear(year);
  });
}
