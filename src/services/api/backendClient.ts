import {
  NativeAdminTokenStore,
  NativeSyncCursorStore,
  OrthodoxCalendarApiClient,
} from '../backend-sdk';
import { secureStorage } from '../storage/secureStorage';

const PRODUCTION_API_BASE_URL = 'https://orthodox-korea-calendar-backend-production.leontg.workers.dev';
const DEVELOPMENT_API_BASE_URL = 'https://orthodox-korea-calendar-backend.leontg.workers.dev';

const DEFAULT_API_BASE_URL = __DEV__ ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL;

export const configuredBaseUrl =
  process.env.EXPO_PUBLIC_APP_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const isApiConfigured = configuredBaseUrl.length > 0;

const storageAdapter = {
  getItem: (key: string) => secureStorage.getItem(key),
  setItem: (key: string, value: string) => secureStorage.setItem(key, value),
  removeItem: (key: string) => secureStorage.deleteItem(key),
};

export const adminTokenStore = new NativeAdminTokenStore(storageAdapter, 'app.adminToken');
export const syncCursorStore = new NativeSyncCursorStore(storageAdapter, 'events.sync.cursor');

export const backendClient = new OrthodoxCalendarApiClient(configuredBaseUrl, {
  tokenStore: adminTokenStore,
});