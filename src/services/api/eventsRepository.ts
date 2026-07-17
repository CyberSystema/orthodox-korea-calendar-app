import type { CreateOrUpdateEventInput } from '../backend-sdk';
import { BackendApiError } from '../backend-sdk';
import { verifyAdminCloudflareSession } from './adminAuth';
import { backendClient, isApiConfigured } from './backendClient';
import type {
  EventNotificationTarget,
  EventRecurrence,
  LiturgicalEvent,
  LiturgicalRank,
  LocalizedText,
} from '../../features/calendar/types';
import type { ApiEvent } from '../backend-sdk';

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

type SyncBatch = {
  cursor: number;
  hasMore: boolean;
  events: LiturgicalEvent[];
  deletedIds: string[];
  snapshot: boolean;
};

function ensureConfigured() {
  if (!isApiConfigured) {
    throw new Error('Events API is not configured. Set EXPO_PUBLIC_APP_API_BASE_URL for the native app API.');
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof BackendApiError) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Unknown API error';
}

function mapBackendTypeToRank(type: string | undefined): LiturgicalRank {
  switch (type) {
    case 'feast':
      return 'major-feast';
    case 'fast':
      return 'fast-day';
    default:
      return 'commemoration';
  }
}

function fromUnixSeconds(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return new Date(value * 1000).toISOString();
}

function toLiturgicalEvent(remote: ApiEvent): LiturgicalEvent {
  const titleEn = remote.title?.en?.trim() || 'Untitled Event';
  const titleKo = remote.title?.ko?.trim() || titleEn;
  const descriptionEn = remote.description?.en?.trim() || '';
  const descriptionKo = remote.description?.ko?.trim() || descriptionEn;

  return {
    id: remote.id,
    dateISO: remote.date,
    rank: mapBackendTypeToRank(remote.type),
    eventType: remote.type || 'commemoration',
    color: remote.color ?? undefined,
    allDay: remote.allDay ?? true,
    title: {
      en: titleEn,
      ko: titleKo,
    },
    summary: {
      en: descriptionEn || titleEn,
      ko: descriptionKo || titleKo,
    },
    details: {
      en: descriptionEn || titleEn,
      ko: descriptionKo || titleKo,
    },
    // An occurrence returned by a ranged read is already a single concrete date;
    // never treat it as recurring, or the client would re-expand it into duplicates.
    recurrence: remote.isOccurrence ? 'none' : remote.recurrence?.frequency || 'none',
    recurrenceInterval: remote.isOccurrence ? undefined : remote.recurrence?.interval,
    recurrenceUntil: remote.isOccurrence ? undefined : remote.recurrence?.until ?? undefined,
    createdAt: fromUnixSeconds(remote.createdAt),
    updatedAt: fromUnixSeconds(remote.updatedAt),
    isAdminDraft: false,
  };
}

function mapDraftType(draft: EventDraft): CreateOrUpdateEventInput['type'] {
  if (draft.recurrence && draft.recurrence !== 'none') {
    return 'other';
  }
  return 'commemoration';
}

function mapDraftRecurrence(recurrence: EventRecurrence | undefined): CreateOrUpdateEventInput['recurrence'] {
  if (!recurrence || recurrence === 'none') {
    return null;
  }

  return {
    frequency: recurrence,
    interval: 1,
    until: null,
  };
}

function toEventInput(draft: EventDraft): CreateOrUpdateEventInput {
  return {
    title_en: draft.title.en,
    title_ko: draft.title.ko,
    description_en: draft.details.en,
    description_ko: draft.details.ko,
    date: draft.dateISO,
    type: mapDraftType(draft),
    color: '#B8942E',
    all_day: true,
    recurrence: mapDraftRecurrence(draft.recurrence),
  };
}

async function sendEventNotification(event: LiturgicalEvent): Promise<void> {
  try {
    await backendClient.adminNotify({
      target: 'all',
      title_en: event.title.en,
      title_ko: event.title.ko,
      body_en: event.details.en || event.title.en,
      body_ko: event.details.ko || event.title.ko,
      data: {
        eventId: event.id,
        date: event.dateISO,
      },
    });
  } catch (error) {
    console.warn('Backend notification dispatch failed:', getErrorMessage(error));
  }
}

export function canUseEventsApi() {
  return isApiConfigured;
}

export async function verifyEventsAdminPasscode(passcode: string): Promise<boolean> {
  void passcode;
  ensureConfigured();
  return verifyAdminCloudflareSession();
}

export async function fetchSyncBatch(cursor: number, limit = 100): Promise<SyncBatch> {
  ensureConfigured();

  try {
    const payload = await backendClient.sync({ cursor, limit });
    return {
      cursor: payload.cursor ?? cursor,
      hasMore: payload.hasMore ?? false,
      events: (payload.events || []).map((event) => toLiturgicalEvent(event)),
      deletedIds: payload.deletedIds || [],
      snapshot: payload.snapshot ?? false,
    };
  } catch (error) {
    throw new Error(`Failed to sync events: ${getErrorMessage(error)}`);
  }
}

export async function fetchRemoteEventById(eventId: string): Promise<LiturgicalEvent> {
  ensureConfigured();

  try {
    return toLiturgicalEvent(await backendClient.getEvent(eventId));
  } catch (error) {
    throw new Error(`Failed to load event: ${getErrorMessage(error)}`);
  }
}

export async function createRemoteEvent(draft: EventDraft): Promise<LiturgicalEvent> {
  ensureConfigured();

  try {
    const createdEvent = toLiturgicalEvent(await backendClient.createEvent(toEventInput(draft)));
    if (draft.notify) {
      await sendEventNotification(createdEvent);
    }

    return createdEvent;
  } catch (error) {
    throw new Error(`Failed to create event: ${getErrorMessage(error)}`);
  }
}

export async function updateRemoteEvent(draft: EventDraft): Promise<LiturgicalEvent> {
  ensureConfigured();

  if (!draft.id) {
    throw new Error('Cannot update event without id.');
  }

  try {
    const updatedEvent = toLiturgicalEvent(await backendClient.updateEvent(draft.id, toEventInput(draft)));
    if (draft.notify) {
      await sendEventNotification(updatedEvent);
    }

    return updatedEvent;
  } catch (error) {
    throw new Error(`Failed to update event: ${getErrorMessage(error)}`);
  }
}

export async function deleteRemoteEvent(eventId: string, yearHint?: number): Promise<void> {
  void yearHint;
  ensureConfigured();

  try {
    await backendClient.deleteEvent(eventId);
  } catch (error) {
    throw new Error(`Failed to delete event: ${getErrorMessage(error)}`);
  }
}
