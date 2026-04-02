import type {
  AdminNotifyInput,
  AdminNotifyResponse,
  AdminMeResponse,
  ApiResponse,
  ClientConfigResponse,
  CreateOrUpdateEventInput,
  DeleteEventResponse,
  DeleteSubscriptionResponse,
  HealthResponse,
  ListEventsParams,
  ListEventsResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  StaffLoginRequest,
  NotifyInput,
  NotifyResponse,
  RateLimitedDetails,
  RegisterSubscriptionResponse,
  RegisterSubscriptionInput,
  SyncParams,
  SyncResponse,
  ApiEvent,
} from "./contracts";
import type { AdminTokenStore, SyncCursorStore } from "./stores";

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export interface OrthodoxCalendarApiClientOptions {
  fetchImpl?: typeof fetch;
  tokenStore?: AdminTokenStore;
  defaultHeaders?: Record<string, string>;
}

export interface SyncAllOptions extends SyncParams {
  maxPages?: number;
  onPage?: (data: SyncResponse) => Promise<void> | void;
}

export class OrthodoxCalendarApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly tokenStore: AdminTokenStore | undefined;
  private readonly defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, options: OrthodoxCalendarApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tokenStore = options.tokenStore;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  private static toQuery(params: Record<string, string | number | undefined>): string {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined) continue;
      qs.set(key, String(val));
    }
    const out = qs.toString();
    return out ? `?${out}` : "";
  }

  private static parseRetryAfterHeader(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return undefined;
  }

  private static toBackendError(
    status: number,
    code: string,
    message: string,
    details: unknown,
    retryAfterHeader: string | null
  ): BackendApiError {
    const retryAfter = OrthodoxCalendarApiClient.parseRetryAfterHeader(retryAfterHeader);
    if ((code === "RATE_LIMITED" || status === 429) && retryAfter !== undefined) {
      const mergedDetails: RateLimitedDetails =
        details && typeof details === "object"
          ? { ...(details as Record<string, unknown>), retryAfter }
          : { retryAfter };
      return new BackendApiError(message, code, status, mergedDetails, retryAfter);
    }
    return new BackendApiError(message, code, status, details, retryAfter);
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      auth?: boolean;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers ?? {}),
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.auth) {
      if (!this.tokenStore) {
        throw new Error("tokenStore is required for auth requests");
      }
      const token = await this.tokenStore.getToken();
      if (!token) {
        throw new BackendApiError("Missing admin token", "UNAUTHORIZED", 401);
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const requestInit: RequestInit = {
      method,
      headers,
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, requestInit);
    const retryAfterHeader = res.headers.get("Retry-After");

    let json: ApiResponse<T> | null = null;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      if (!res.ok) {
        throw OrthodoxCalendarApiClient.toBackendError(
          res.status,
          "HTTP_ERROR",
          `HTTP ${res.status} without JSON body`,
          undefined,
          retryAfterHeader
        );
      }
      throw OrthodoxCalendarApiClient.toBackendError(
        res.status,
        "INVALID_RESPONSE",
        "Expected JSON response",
        undefined,
        retryAfterHeader
      );
    }

    if (!json.ok) {
      throw OrthodoxCalendarApiClient.toBackendError(
        res.status,
        json.error.code,
        json.error.message,
        json.error.details,
        retryAfterHeader
      );
    }

    return json.data;
  }

  async health(): Promise<{ ok: true; service: string; ts: number }> {
    const res = await this.fetchImpl(`${this.baseUrl}/health`, { method: "GET" });
    if (!res.ok) {
      throw new BackendApiError(`Health check failed with HTTP ${res.status}`, "HTTP_ERROR", res.status);
    }
    return (await res.json()) as HealthResponse;
  }

  async clientConfig(): Promise<ClientConfigResponse> {
    return this.request<ClientConfigResponse>("GET", "/config/client");
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminLogin(input: LoginRequest): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("POST", "/admin/login", { body: input });
    if (this.tokenStore) {
      await this.tokenStore.setToken(data.token);
    }
    return data;
  }

  async staffLogin(input: StaffLoginRequest): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("POST", "/staff/login", { body: input });
    if (this.tokenStore) {
      await this.tokenStore.setToken(data.token);
    }
    return data;
  }

  async adminLogout(): Promise<LogoutResponse> {
    const data = await this.request<LogoutResponse>("DELETE", "/admin/logout", { auth: true });
    if (this.tokenStore) {
      await this.tokenStore.setToken(null);
    }
    return data;
  }

  async setAdminToken(token: string | null): Promise<void> {
    if (!this.tokenStore) {
      throw new Error("tokenStore is required to persist admin token");
    }
    await this.tokenStore.setToken(token);
  }

  async hasAdminToken(): Promise<boolean> {
    if (!this.tokenStore) {
      return false;
    }
    return !!(await this.tokenStore.getToken());
  }

  async adminMe(): Promise<AdminMeResponse> {
    return this.request<AdminMeResponse>("GET", "/admin/me", { auth: true });
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  async listEvents(params: ListEventsParams = {}): Promise<ListEventsResponse> {
    const query = OrthodoxCalendarApiClient.toQuery({
      from: params.from,
      to: params.to,
      type: params.type,
      limit: params.limit,
      offset: params.offset,
    });
    return this.request<ListEventsResponse>("GET", `/events${query}`);
  }

  async getEvent(id: string): Promise<ApiEvent> {
    return this.request<ApiEvent>("GET", `/events/${encodeURIComponent(id)}`);
  }

  async createEvent(input: CreateOrUpdateEventInput): Promise<ApiEvent> {
    return this.request<ApiEvent>("POST", "/events", { body: input, auth: true });
  }

  async updateEvent(id: string, input: CreateOrUpdateEventInput): Promise<ApiEvent> {
    return this.request<ApiEvent>("PUT", `/events/${encodeURIComponent(id)}`, {
      body: input,
      auth: true,
    });
  }

  async deleteEvent(id: string): Promise<{ id: string; deleted: true }> {
    return this.request<DeleteEventResponse>(
      "DELETE",
      `/events/${encodeURIComponent(id)}`,
      { auth: true }
    );
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  async sync(params: SyncParams = {}): Promise<SyncResponse> {
    const query = OrthodoxCalendarApiClient.toQuery({
      cursor: params.cursor,
      limit: params.limit,
      from: params.from,
      to: params.to,
    });
    return this.request<SyncResponse>("GET", `/sync${query}`);
  }

  async syncAll(options: SyncAllOptions = {}): Promise<SyncResponse[]> {
    const maxPages = options.maxPages ?? 50;
    const pages: SyncResponse[] = [];

    let cursor = options.cursor ?? 0;
    for (let page = 0; page < maxPages; page++) {
      const params: SyncParams = { cursor };
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.from !== undefined) params.from = options.from;
      if (options.to !== undefined) params.to = options.to;

      const data = await this.sync(params);
      pages.push(data);
      await options.onPage?.(data);

      cursor = data.cursor;
      if (!data.hasMore) break;
    }

    return pages;
  }

  async syncAndPersistCursor(
    cursorStore: SyncCursorStore,
    options: Omit<SyncAllOptions, "cursor"> = {}
  ): Promise<SyncResponse[]> {
    const cursor = await cursorStore.getCursor();
    const pages = await this.syncAll({
      ...options,
      cursor,
      onPage: async (page) => {
        await cursorStore.setCursor(page.cursor);
        await options.onPage?.(page);
      },
    });
    return pages;
  }

  // ─── Subscriptions / Notifications ─────────────────────────────────────────

  async registerSubscription(input: RegisterSubscriptionInput): Promise<RegisterSubscriptionResponse> {
    return this.request<RegisterSubscriptionResponse>("POST", "/subscriptions", {
      body: input,
    });
  }

  async deleteSubscription(token: string): Promise<DeleteSubscriptionResponse> {
    return this.request<DeleteSubscriptionResponse>(
      "DELETE",
      `/subscriptions/${encodeURIComponent(token)}`
    );
  }

  async notify(input: NotifyInput): Promise<NotifyResponse> {
    return this.request<NotifyResponse>("POST", "/subscriptions/notify", {
      body: input,
      auth: true,
    });
  }

  // Backward-compatible alias for admin-centric naming.
  async adminNotify(input: AdminNotifyInput): Promise<AdminNotifyResponse> {
    return this.notify(input);
  }
}
