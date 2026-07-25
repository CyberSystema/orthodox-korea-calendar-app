import { BackendApiError } from '../backend-sdk';

import { adminTokenStore, backendClient, configuredBaseUrl } from './backendClient';

const DEFAULT_ADMIN_USERNAME = 'okn_admin';
const adminUsername = process.env.EXPO_PUBLIC_ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;

export type AdminLoginResult =
  | { ok: true }
  | {
      ok: false;
      code?: string;
      message?: string;
      retryAfter?: number;
    };

function ensureConfigured() {
  if (!configuredBaseUrl) {
    throw new Error(
      'Events API is not configured. Set EXPO_PUBLIC_APP_API_BASE_URL for Cloudflare auth.',
    );
  }
}

export async function getAdminAuthToken(): Promise<string> {
  return (await adminTokenStore.getToken()) || '';
}

export async function hasAdminAuthToken(): Promise<boolean> {
  const token = await getAdminAuthToken();
  return token.length > 0;
}

export async function clearAdminAuthToken(): Promise<void> {
  await adminTokenStore.setToken(null);
}

export async function loginStaffThroughCloudflare(passcode: string): Promise<AdminLoginResult> {
  ensureConfigured();

  try {
    const payload = await backendClient.staffLogin({ passcode });
    if (!payload.token) {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Login succeeded without a token.',
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      };
    }

    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Login failed.',
    };
  }
}

export async function loginAdminThroughCloudflare(password: string): Promise<AdminLoginResult> {
  ensureConfigured();

  try {
    const payload = await backendClient.adminLogin({ username: adminUsername, password });
    if (!payload.token) {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Login succeeded without a token.',
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      };
    }

    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Login failed.',
    };
  }
}

export async function verifyAdminCloudflareSession(): Promise<boolean> {
  ensureConfigured();

  if (!(await backendClient.hasAdminToken())) {
    return false;
  }

  try {
    await backendClient.adminMe();
    return true;
  } catch {
    return false;
  }
}

export async function logoutAdminThroughCloudflare(): Promise<void> {
  ensureConfigured();

  try {
    if (await backendClient.hasAdminToken()) {
      await backendClient.adminLogout();
    }
  } finally {
    await clearAdminAuthToken();
  }
}
