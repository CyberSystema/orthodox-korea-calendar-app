import { create } from 'zustand';

import {
  canUseAnnouncementsApi,
  deleteAnnouncementRemote,
  fetchAnnouncements,
  type Announcement,
} from '../../services/api/announcementsRepository';
import { secureStorage } from '../../services/storage/secureStorage';

const CACHE_KEY = 'announcements.cache';
const LAST_SEEN_KEY = 'announcements.lastSeenId';
const REFRESH_COOLDOWN_MS = 30_000;
// Keep the persisted feed bounded — the feed shows recent broadcasts, and the
// secure store is not meant to hold an unbounded history.
const MAX_CACHED = 50;
const PAGE_SIZE = 30;

let refreshInFlight: Promise<void> | null = null;

type LoadState = 'idle' | 'loading' | 'error';

type AnnouncementsState = {
  isHydrated: boolean;
  announcements: Announcement[];
  loadState: LoadState;
  loadError: string | null;
  lastFetchedAt: number | null;
  /** Highest announcement id the user has already viewed (drives the unread badge). */
  lastSeenId: number;
  hydrate: () => Promise<void>;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  markAllSeen: () => Promise<void>;
  deleteAnnouncement: (id: number) => Promise<void>;
};

function isAnnouncement(raw: unknown): raw is Announcement {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as Record<string, unknown>;
  const title = value.title as Record<string, unknown> | undefined;
  const body = value.body as Record<string, unknown> | undefined;
  return (
    typeof value.id === 'number' &&
    typeof value.sentAt === 'number' &&
    !!title &&
    typeof title.en === 'string' &&
    typeof title.ko === 'string' &&
    !!body &&
    typeof body.en === 'string' &&
    typeof body.ko === 'string'
  );
}

function sortNewestFirst(items: Announcement[]): Announcement[] {
  return [...items].sort((a, b) => b.sentAt - a.sentAt || b.id - a.id);
}

async function loadCache(): Promise<Announcement[]> {
  const raw = await secureStorage.getItem(CACHE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return sortNewestFirst(parsed.filter(isAnnouncement));
  } catch {
    return [];
  }
}

async function persistCache(items: Announcement[]): Promise<void> {
  await secureStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, MAX_CACHED)));
}

async function loadLastSeenId(): Promise<number> {
  const raw = await secureStorage.getItem(LAST_SEEN_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function countUnread(items: Announcement[], lastSeenId: number): number {
  return items.reduce((count, item) => (item.id > lastSeenId ? count + 1 : count), 0);
}

export const useAnnouncementsStore = create<AnnouncementsState>((set, get) => ({
  isHydrated: false,
  announcements: [],
  loadState: 'idle',
  loadError: null,
  lastFetchedAt: null,
  lastSeenId: 0,
  hydrate: async () => {
    const [cached, lastSeenId] = await Promise.all([loadCache(), loadLastSeenId()]);
    set({ announcements: cached, lastSeenId, isHydrated: true });
    // Fetch fresh in the background; failure keeps the cached list on screen.
    await get()
      .refresh()
      .catch((err) => console.warn('[Announcements] initial refresh failed:', err));
  },
  refresh: async (options) => {
    if (!canUseAnnouncementsApi()) {
      return;
    }

    if (refreshInFlight) {
      await refreshInFlight;
      return;
    }

    const state = get();
    const nowMs = Date.now();
    if (
      !options?.force &&
      state.lastFetchedAt &&
      nowMs - state.lastFetchedAt < REFRESH_COOLDOWN_MS
    ) {
      return;
    }

    refreshInFlight = (async () => {
      set({ loadState: 'loading', loadError: null });
      try {
        const fresh = sortNewestFirst(await fetchAnnouncements(PAGE_SIZE, 0));
        set({
          announcements: fresh,
          loadState: 'idle',
          loadError: null,
          lastFetchedAt: Date.now(),
        });
        await persistCache(fresh);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load announcements.';
        // Keep whatever list we already have; surface the error non-destructively.
        set({ loadState: 'error', loadError: message });
      }
    })();

    try {
      await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  },
  markAllSeen: async () => {
    const { announcements, lastSeenId } = get();
    const maxId = announcements.reduce((max, item) => Math.max(max, item.id), lastSeenId);
    if (maxId <= lastSeenId) {
      return;
    }
    set({ lastSeenId: maxId });
    await secureStorage.setItem(LAST_SEEN_KEY, String(maxId));
  },
  deleteAnnouncement: async (id) => {
    // Optimistically drop it from the list so the UI updates instantly, then confirm
    // with the backend. On failure, restore the previous list and rethrow so the
    // caller can surface the error. A successful delete is server-authoritative, so
    // every other device sees it removed on its next feed refresh.
    const previous = get().announcements;
    const next = previous.filter((item) => item.id !== id);
    set({ announcements: next });
    await persistCache(next);
    try {
      await deleteAnnouncementRemote(id);
    } catch (error) {
      set({ announcements: previous });
      await persistCache(previous);
      throw error;
    }
  },
}));
