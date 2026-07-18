import { BackendApiError } from '../backend-sdk';
import type { ApiAnnouncement } from '../backend-sdk';
import { backendClient, isApiConfigured } from './backendClient';
import type { LocalizedText } from '../../features/calendar/types';

export type AnnouncementTarget = 'all' | 'en' | 'ko';

/** A single admin broadcast as shown in the in-app Announcements feed. */
export type Announcement = {
  id: number;
  target: AnnouncementTarget;
  title: LocalizedText;
  body: LocalizedText;
  /** The event this broadcast is about, for tap-through — or null for a general notice. */
  eventId: string | null;
  /** How many devices the push reached (0 = no subscribers / delivery disabled). */
  sentCount: number;
  /** Unix epoch seconds when the broadcast was sent. */
  sentAt: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof BackendApiError) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Unknown API error';
}

function normalizeTarget(value: unknown): AnnouncementTarget {
  return value === 'en' || value === 'ko' ? value : 'all';
}

function normalizeLocalized(value: { en?: unknown; ko?: unknown } | undefined): LocalizedText {
  const en = typeof value?.en === 'string' ? value.en : '';
  const ko = typeof value?.ko === 'string' ? value.ko : '';
  return { en, ko };
}

function toAnnouncement(remote: ApiAnnouncement): Announcement {
  return {
    id: remote.id,
    target: normalizeTarget(remote.target),
    title: normalizeLocalized(remote.title),
    body: normalizeLocalized(remote.body),
    eventId: typeof remote.eventId === 'string' ? remote.eventId : null,
    sentCount: typeof remote.sentCount === 'number' ? remote.sentCount : 0,
    sentAt: typeof remote.sentAt === 'number' ? remote.sentAt : 0,
  };
}

export function canUseAnnouncementsApi(): boolean {
  return isApiConfigured;
}

export async function deleteAnnouncementRemote(id: number): Promise<void> {
  if (!isApiConfigured) {
    throw new Error('Announcements API is not configured.');
  }
  try {
    await backendClient.deleteAnnouncement(id);
  } catch (error) {
    throw new Error(`Failed to delete announcement: ${getErrorMessage(error)}`);
  }
}

export async function fetchAnnouncements(limit = 30, offset = 0): Promise<Announcement[]> {
  if (!isApiConfigured) {
    return [];
  }

  try {
    const payload = await backendClient.listAnnouncements({ limit, offset });
    return (payload.announcements || [])
      // A broadcast must have a title in at least one language to be meaningful.
      .map((item) => toAnnouncement(item))
      .filter((item) => item.title.en.trim().length > 0 || item.title.ko.trim().length > 0);
  } catch (error) {
    throw new Error(`Failed to load announcements: ${getErrorMessage(error)}`);
  }
}
