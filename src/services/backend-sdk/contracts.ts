export type EventType = 'feast' | 'fast' | 'commemoration' | 'other';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type Platform = 'ios' | 'android' | 'web';
export type Language = 'en' | 'ko' | 'all';
export type NotificationTarget = 'all' | 'en' | 'ko';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface EventRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  until: string | null;
}

export interface ApiEvent {
  id: string;
  parentEventId?: string;
  isOccurrence?: boolean;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  date: string;
  type: 'feast' | 'fast' | 'commemoration' | 'other';
  color: string | null;
  recurrence?: EventRecurrence;
  allDay: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface StaffLoginRequest {
  passcode: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
}

export interface HealthResponse {
  ok: true;
  service: string;
  ts: number;
}

export interface AdminMeResponse {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

export interface ListEventsParams {
  from?: string;
  to?: string;
  type?: 'feast' | 'fast' | 'commemoration' | 'other';
  limit?: number;
  offset?: number;
}

export interface ListEventsResponse {
  events: ApiEvent[];
  limit: number;
  offset: number;
  count: number;
}

export interface DeleteEventResponse {
  id: string;
  deleted: true;
}

export interface CreateOrUpdateEventInput {
  title_en?: string;
  title_ko?: string;
  description_en?: string;
  description_ko?: string;
  date?: string;
  type?: 'feast' | 'fast' | 'commemoration' | 'other';
  color?: string | null;
  all_day?: boolean;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    until?: string | null;
  } | null;
}

export interface SyncParams {
  cursor?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export interface SyncResponse {
  cursor: number;
  hasMore: boolean;
  events: ApiEvent[];
  deletedIds: string[];
  /**
   * True when `events` is a full snapshot of all live events (not an incremental
   * delta) — returned on an initial sync or when the client's cursor predates the
   * server's change_log prune horizon. Clients must REPLACE their set from a
   * snapshot rather than merge. Absent/false on ordinary incremental responses.
   */
  snapshot?: boolean;
}

export interface ApiAnnouncement {
  id: number;
  target: 'all' | 'en' | 'ko';
  title: { en: string; ko: string };
  body: { en: string; ko: string };
  eventId: string | null;
  sentCount: number;
  /** Unix epoch seconds when the broadcast was sent. */
  sentAt: number;
}

export interface ListAnnouncementsParams {
  limit?: number;
  offset?: number;
}

export interface ListAnnouncementsResponse {
  announcements: ApiAnnouncement[];
  limit: number;
  offset: number;
  count: number;
  hasMore: boolean;
}

export interface DeleteAnnouncementResponse {
  id: number;
  deleted: true;
}

export interface PurgeInput {
  confirm: 'PURGE';
}

export interface PurgeResult {
  eventsDeleted: number;
  notificationsDeleted: number;
  tombstonesWritten: number;
}

export type AnnouncementEventStatus = 'none' | 'live' | 'deleted' | 'missing';
export type AnnouncementLogFilter =
  'all' | 'visible' | 'hidden' | 'deleted' | 'orphaned' | 'standalone';

export interface AdminAnnouncementLogItem {
  id: number;
  target: 'all' | 'en' | 'ko';
  title: { en: string; ko: string };
  body: { en: string; ko: string };
  eventId: string | null;
  sentCount: number;
  sentAt: number;
  deletedAt: number | null;
  visible: boolean;
  eventStatus: AnnouncementEventStatus;
  eventTitle: { en: string; ko: string } | null;
  eventDate: string | null;
}

export interface AdminAnnouncementLogCounts {
  total: number;
  visible: number;
  hidden: number;
  deleted: number;
  orphaned: number;
  standalone: number;
}

export interface AdminAnnouncementLogResponse {
  items: AdminAnnouncementLogItem[];
  limit: number;
  offset: number;
  count: number;
  hasMore: boolean;
  counts: AdminAnnouncementLogCounts;
}

export interface ListAnnouncementLogParams {
  limit?: number;
  offset?: number;
  filter?: AnnouncementLogFilter;
}

export interface RestoreAnnouncementResponse {
  id: number;
  restored: true;
}

export interface HardDeleteAnnouncementResponse {
  id: number;
  purged: true;
}

export interface LogoutResponse {
  message: string;
}

export interface NotifyInput {
  target: 'all' | 'en' | 'ko';
  title_en: string;
  title_ko: string;
  body_en?: string;
  body_ko?: string;
  data?: Record<string, string>;
}

export interface NotifyResponse {
  target: 'all' | 'en' | 'ko';
  /**
   * TRANSITIONAL: the pre-OneSignal Worker returned these instead of the fields
   * below. A new binary can meet an old Worker during the rollout window.
   */
  sent?: number;
  fcmEnabled?: boolean;
  /** OneSignal's `recipients`. 0 means the audience was empty — NOT a failure. */
  recipients: number;
  notificationId: string | null;
  /** False when the Worker has no OneSignal credentials configured. */
  providerEnabled: boolean;
  errors: string[];
  message?: string;
}

export type AdminNotifyInput = NotifyInput;
export type AdminNotifyResponse = NotifyResponse;

export interface RateLimitedDetails {
  retryAfter?: number;
}

export interface OneSignalClientConfig {
  /** PUBLIC OneSignal App ID. */
  appId: string;
}

export interface ClientConfigResponse {
  oneSignal: OneSignalClientConfig;
}
