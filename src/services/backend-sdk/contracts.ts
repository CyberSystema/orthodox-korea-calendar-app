export type EventType = "feast" | "fast" | "commemoration" | "other";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";
export type Platform = "ios" | "android" | "web";
export type Language = "en" | "ko" | "all";
export type NotificationTarget = "all" | "en" | "ko";

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
  frequency: "daily" | "weekly" | "monthly";
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
  type: "feast" | "fast" | "commemoration" | "other";
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
  type?: "feast" | "fast" | "commemoration" | "other";
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
  type?: "feast" | "fast" | "commemoration" | "other";
  color?: string | null;
  all_day?: boolean;
  recurrence?:
    | {
        frequency: "daily" | "weekly" | "monthly";
        interval?: number;
        until?: string | null;
      }
    | null;
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
}

export interface RegisterSubscriptionInput {
  token: string;
  platform: "ios" | "android" | "web";
  language?: "en" | "ko" | "all";
  environment?: "sandbox" | "production";
}

export interface RegisterSubscriptionResponse {
  id: string;
  created?: true;
  updated?: true;
}

export interface DeleteSubscriptionResponse {
  deleted: true;
}

export interface LogoutResponse {
  message: string;
}

export interface NotifyInput {
  target: "all" | "en" | "ko";
  title_en: string;
  title_ko: string;
  body_en?: string;
  body_ko?: string;
  data?: Record<string, string>;
}

export interface NotifyResponse {
  sent: number;
  failed: number;
  total: number;
  target: "all" | "en" | "ko";
  fcmEnabled: boolean;
  fcmMode: "v1" | "legacy" | "disabled";
  apnsEnabled: boolean;
  message?: string;
}

export type AdminNotifyInput = NotifyInput;
export type AdminNotifyResponse = NotifyResponse;

export interface RateLimitedDetails {
  retryAfter?: number;
}

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidPublicKey: string;
}

export interface ClientConfigResponse {
  firebase: FirebaseClientConfig;
}
