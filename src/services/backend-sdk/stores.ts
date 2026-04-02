export interface SyncCursorStore {
  getCursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
}

export interface AdminTokenStore {
  getToken(): Promise<string | null>;
  setToken(token: string | null): Promise<void>;
}

export class MemorySyncCursorStore implements SyncCursorStore {
  private cursor = 0;

  async getCursor(): Promise<number> {
    return this.cursor;
  }

  async setCursor(cursor: number): Promise<void> {
    this.cursor = Number.isFinite(cursor) && cursor >= 0 ? Math.floor(cursor) : 0;
  }
}

export class MemoryAdminTokenStore implements AdminTokenStore {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
  }
}

interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getLocalStorageOrThrow(): LocalStorageLike {
  const g = globalThis as unknown as { localStorage?: LocalStorageLike };
  if (!g.localStorage) {
    throw new Error("localStorage is not available in this environment");
  }
  return g.localStorage;
}

export class WebSyncCursorStore implements SyncCursorStore {
  constructor(private readonly key = "okn.sync.cursor") {}

  async getCursor(): Promise<number> {
    const raw = getLocalStorageOrThrow().getItem(this.key);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async setCursor(cursor: number): Promise<void> {
    getLocalStorageOrThrow().setItem(this.key, String(Math.max(0, Math.floor(cursor))));
  }
}

export class WebAdminTokenStore implements AdminTokenStore {
  constructor(private readonly key = "okn.admin.token") {}

  async getToken(): Promise<string | null> {
    return getLocalStorageOrThrow().getItem(this.key);
  }

  async setToken(token: string | null): Promise<void> {
    if (!token) {
      getLocalStorageOrThrow().removeItem(this.key);
      return;
    }
    getLocalStorageOrThrow().setItem(this.key, token);
  }
}

function getSessionStorageOrThrow(): LocalStorageLike {
  const g = globalThis as unknown as { sessionStorage?: LocalStorageLike };
  if (!g.sessionStorage) {
    throw new Error("sessionStorage is not available in this environment");
  }
  return g.sessionStorage;
}

export class WebSessionAdminTokenStore implements AdminTokenStore {
  constructor(private readonly key = "okn.admin.token") {}

  async getToken(): Promise<string | null> {
    return getSessionStorageOrThrow().getItem(this.key);
  }

  async setToken(token: string | null): Promise<void> {
    if (!token) {
      getSessionStorageOrThrow().removeItem(this.key);
      return;
    }
    getSessionStorageOrThrow().setItem(this.key, token);
  }
}

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class NativeSyncCursorStore implements SyncCursorStore {
  constructor(
    private readonly storage: AsyncStorageLike,
    private readonly key = "okn.sync.cursor"
  ) {}

  async getCursor(): Promise<number> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async setCursor(cursor: number): Promise<void> {
    await this.storage.setItem(this.key, String(Math.max(0, Math.floor(cursor))));
  }
}

export class NativeAdminTokenStore implements AdminTokenStore {
  constructor(
    private readonly storage: AsyncStorageLike,
    private readonly key = "okn.admin.token"
  ) {}

  async getToken(): Promise<string | null> {
    return this.storage.getItem(this.key);
  }

  async setToken(token: string | null): Promise<void> {
    if (!token) {
      await this.storage.removeItem(this.key);
      return;
    }
    await this.storage.setItem(this.key, token);
  }
}
