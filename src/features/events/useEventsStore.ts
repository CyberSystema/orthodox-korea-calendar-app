import dayjs from 'dayjs';
import { create } from 'zustand';

import {
  canUseEventsApi,
  createRemoteEvent,
  deleteRemoteEvent,
  fetchSyncBatch,
  updateRemoteEvent,
} from '../../services/api/eventsRepository';
import { syncCursorStore } from '../../services/api/backendClient';
import { hasAdminAuthToken } from '../../services/api/adminAuth';
import { secureStorage } from '../../services/storage/secureStorage';
import type {
  EventNotificationTarget,
  EventRecurrence,
  LiturgicalEvent,
  LocalizedText,
} from '../calendar/types';

const STORAGE_KEY = 'events.cache';
const MAX_SYNC_PAGES = 30;
const SYNC_COOLDOWN_MS = 30_000;
const LEGACY_SEEDED_EVENT_IDS = new Set([
  'annunciation-2026',
  'palm-sunday-2026',
  'pascha-2026',
  'st-george-2026',
  'ascension-2026',
  'admin-draft-sample-2026',
]);

let syncInFlight: Promise<void> | null = null;

type EventDraft = {
  id?: string;
  dateISO: string;
  originalYear?: number;
  title: LocalizedText;
  summary: LocalizedText;
  details: LocalizedText;
  notify?: boolean;
  notificationTarget?: EventNotificationTarget;
  recurrence?: EventRecurrence;
};

type SyncState = 'idle' | 'syncing' | 'error';

type EventsState = {
  isHydrated: boolean;
  customEvents: LiturgicalEvent[];
  syncState: SyncState;
  syncError: string | null;
  lastSyncedYear: number | null;
  lastSyncedAt: number | null;
  hydrateEvents: () => Promise<void>;
  syncYearEvents: (year: number) => Promise<void>;
  addEvent: (draft: EventDraft) => Promise<void>;
  updateEvent: (draft: EventDraft) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
};

function yearFromDateISO(dateISO: string): number {
  const year = Number.parseInt(dateISO.slice(0, 4), 10);
  return Number.isFinite(year) ? year : dayjs().year();
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object') return false;
  const text = value as Record<string, unknown>;
  return typeof text.en === 'string' && typeof text.ko === 'string';
}

function normalizeStoredEvent(raw: unknown): LiturgicalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    typeof value.dateISO !== 'string' ||
    !isLocalizedText(value.title) ||
    !isLocalizedText(value.summary) ||
    !isLocalizedText(value.details)
  ) {
    return null;
  }

  return {
    id: value.id,
    dateISO: value.dateISO,
    seriesStartDate: typeof value.seriesStartDate === 'string' ? value.seriesStartDate : undefined,
    title: value.title,
    summary: value.summary,
    details: value.details,
    rank:
      value.rank === 'great-feast' ||
      value.rank === 'major-feast' ||
      value.rank === 'fast-day' ||
      value.rank === 'commemoration'
        ? value.rank
        : 'commemoration',
    eventType: typeof value.eventType === 'string' ? value.eventType : undefined,
    color: typeof value.color === 'string' ? value.color : undefined,
    allDay: typeof value.allDay === 'boolean' ? value.allDay : undefined,
    notify: typeof value.notify === 'boolean' ? value.notify : undefined,
    notificationTarget:
      value.notificationTarget === 'english' || value.notificationTarget === 'korean' || value.notificationTarget === 'all'
        ? value.notificationTarget
        : undefined,
    recurrence:
      value.recurrence === 'daily' ||
      value.recurrence === 'weekly' ||
      value.recurrence === 'monthly' ||
      value.recurrence === 'none'
        ? value.recurrence
        : 'none',
    recurrenceInterval:
      typeof value.recurrenceInterval === 'number' && Number.isFinite(value.recurrenceInterval)
        ? value.recurrenceInterval
        : undefined,
    recurrenceUntil: typeof value.recurrenceUntil === 'string' ? value.recurrenceUntil : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    isAdminDraft: typeof value.isAdminDraft === 'boolean' ? value.isAdminDraft : false,
  };
}

function upsertEvent(events: LiturgicalEvent[], nextEvent: LiturgicalEvent): LiturgicalEvent[] {
  const existingIndex = events.findIndex((event) => event.id === nextEvent.id);
  if (existingIndex === -1) {
    return [...events, nextEvent];
  }

  const copy = [...events];
  copy[existingIndex] = nextEvent;
  return copy;
}

async function persist(events: LiturgicalEvent[]) {
  await secureStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

async function loadCachedEvents(): Promise<LiturgicalEvent[]> {
  const raw = await secureStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeStoredEvent(item))
      .filter((item): item is LiturgicalEvent => Boolean(item))
      .filter((item) => !LEGACY_SEEDED_EVENT_IDS.has(item.id));
  } catch {
    return [];
  }
}

async function loadSyncCursor(): Promise<number> {
  return syncCursorStore.getCursor();
}

async function persistSyncCursor(cursor: number) {
  await syncCursorStore.setCursor(cursor);
}

function applySyncBatch(
  existingEvents: LiturgicalEvent[],
  incomingEvents: LiturgicalEvent[],
  deletedIds: string[],
): LiturgicalEvent[] {
  const deletedIdSet = new Set(deletedIds);
  const merged = existingEvents.filter((event) => !deletedIdSet.has(event.id));

  for (const event of incomingEvents) {
    const existingIndex = merged.findIndex((candidate) => candidate.id === event.id);
    if (existingIndex === -1) {
      merged.push(event);
    } else {
      merged[existingIndex] = event;
    }
  }

  return merged
    .filter((event) => !LEGACY_SEEDED_EVENT_IDS.has(event.id))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.title.en.localeCompare(b.title.en));
}

// A snapshot response is the authoritative, complete set of live events (returned
// on an initial sync or when the cursor predates the server's prune horizon).
// REPLACE the local set from it rather than merge, so an event deleted while this
// client was away is dropped instead of lingering as a ghost. Locally-authored
// events are pushed to the backend before this runs, so they are already in the
// snapshot and are not lost.
function applySnapshotBatch(incomingEvents: LiturgicalEvent[]): LiturgicalEvent[] {
  return incomingEvents
    .filter((event) => !LEGACY_SEEDED_EVENT_IDS.has(event.id))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.title.en.localeCompare(b.title.en));
}

export const useEventsStore = create<EventsState>((set, get) => ({
  isHydrated: false,
  customEvents: [],
  syncState: 'idle',
  syncError: null,
  lastSyncedYear: null,
  lastSyncedAt: null,
  hydrateEvents: async () => {
    const cached = await loadCachedEvents();
    set({ customEvents: cached, isHydrated: true });
    await get().syncYearEvents(dayjs().year());
  },
  syncYearEvents: async (year) => {
    void year;
    if (!canUseEventsApi()) {
      return;
    }

    if (syncInFlight) {
      await syncInFlight;
      return;
    }

    const state = get();
    const nowMs = Date.now();
    if (state.lastSyncedYear === year && state.lastSyncedAt && nowMs - state.lastSyncedAt < SYNC_COOLDOWN_MS) {
      return;
    }

    syncInFlight = (async () => {
      set({ syncState: 'syncing', syncError: null });

      try {
        let cursor = await loadSyncCursor();
        let hasMore = true;
        let pagesFetched = 0;
        const seenCursors = new Set<number>();
        const pages: { events: LiturgicalEvent[]; deletedIds: string[]; snapshot: boolean }[] = [];

        while (hasMore) {
          if (seenCursors.has(cursor)) {
            throw new Error('Sync cursor stalled. Stopping sync to avoid a runaway loop.');
          }
          if (pagesFetched >= MAX_SYNC_PAGES) {
            throw new Error(`Sync exceeded ${MAX_SYNC_PAGES} pages. Stopping to protect device performance.`);
          }

          seenCursors.add(cursor);
          const batch = await fetchSyncBatch(cursor);
          pages.push({ events: batch.events, deletedIds: batch.deletedIds, snapshot: batch.snapshot });

          if (batch.hasMore && batch.cursor === cursor) {
            throw new Error('Sync cursor did not advance while hasMore=true. Stopping sync to avoid infinite requests.');
          }

          cursor = batch.cursor;
          hasMore = batch.hasMore;
          pagesFetched += 1;
        }

        // Fold pages IN ORDER, starting from the freshest store state rather than
        // a snapshot taken before the network round-trips. Ordering matters: an
        // event created on an early page and deleted on a later one must end up
        // deleted, so we cannot flatten all events/deletes and apply once.
        // Re-basing on the latest state also prevents clobbering events that were
        // added or edited locally while this sync was in flight.
        let merged = get().customEvents;
        for (const page of pages) {
          merged = page.snapshot
            ? applySnapshotBatch(page.events)
            : applySyncBatch(merged, page.events, page.deletedIds);
        }

        set({
          customEvents: merged,
          syncState: 'idle',
          lastSyncedYear: year,
          lastSyncedAt: Date.now(),
        });
        // Persist events FIRST, then advance the cursor. These must be sequential
        // (not Promise.all): if the events write fails, the cursor must NOT move
        // past data that was never saved, otherwise those events are lost on the
        // next sync.
        await persist(merged);
        await persistSyncCursor(cursor);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to sync events.';
        set({ syncState: 'error', syncError: message });
      }
    })();

    try {
      await syncInFlight;
    } finally {
      syncInFlight = null;
    }
  },
  addEvent: async (draft) => {
    if (!canUseEventsApi()) {
      set({ syncState: 'error', syncError: 'Events API is unavailable. Cannot sync event changes.' });
      return;
    }

    if (!(await hasAdminAuthToken())) {
      set({ syncState: 'error', syncError: 'Cloudflare admin session is required for synchronized event changes.' });
      return;
    }

    try {
      set({ syncState: 'syncing', syncError: null });
      const created = await createRemoteEvent(draft);
      const merged = upsertEvent(get().customEvents, created);
      set({ customEvents: merged, syncState: 'idle', syncError: null });
      await persist(merged);
      await get().syncYearEvents(yearFromDateISO(created.dateISO));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote create failed.';
      set({ syncState: 'error', syncError: message });
    }
  },
  updateEvent: async (draft) => {
    if (!draft.id) return;

    if (!canUseEventsApi()) {
      set({ syncState: 'error', syncError: 'Events API is unavailable. Cannot sync event changes.' });
      return;
    }

    if (!(await hasAdminAuthToken())) {
      set({ syncState: 'error', syncError: 'Cloudflare admin session is required for synchronized event changes.' });
      return;
    }

    if (draft.id.startsWith('local-')) {
      set({ syncState: 'error', syncError: 'Local draft events are not supported for synchronized mode. Create a new remote event.' });
      return;
    }

    try {
      set({ syncState: 'syncing', syncError: null });
      const updated = await updateRemoteEvent(draft);
      const merged = upsertEvent(get().customEvents, updated);
      set({ customEvents: merged, syncState: 'idle', syncError: null });
      await persist(merged);
      await get().syncYearEvents(yearFromDateISO(updated.dateISO));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote update failed.';
      set({ syncState: 'error', syncError: message });
    }
  },
  deleteEvent: async (eventId) => {
    if (!canUseEventsApi()) {
      set({ syncState: 'error', syncError: 'Events API is unavailable. Cannot sync event changes.' });
      return;
    }

    if (!(await hasAdminAuthToken())) {
      set({ syncState: 'error', syncError: 'Cloudflare admin session is required for synchronized event changes.' });
      return;
    }

    if (eventId.startsWith('local-')) {
      set({ syncState: 'error', syncError: 'Local draft events are not supported for synchronized mode.' });
      return;
    }

    try {
      set({ syncState: 'syncing', syncError: null });
      const target = get().customEvents.find((event) => event.id === eventId);
      const yearHint = target ? yearFromDateISO(target.dateISO) : dayjs().year();
      await deleteRemoteEvent(eventId, yearHint);
      const merged = get().customEvents.filter((event) => event.id !== eventId);
      set({ customEvents: merged, syncState: 'idle', syncError: null });
      await persist(merged);
      await get().syncYearEvents(yearHint);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote delete failed.';
      set({ syncState: 'error', syncError: message });
    }
  },
}));
