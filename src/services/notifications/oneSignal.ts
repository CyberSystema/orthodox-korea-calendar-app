import {
  LogLevel,
  OneSignal,
  type NotificationClickEvent,
  type NotificationWillDisplayEvent,
} from 'react-native-onesignal';

import { secureStorage } from '../storage/secureStorage';
import type { SupportedLanguage } from '../../types/language';
import { getNotificationUrl, normalizeIncomingUrl } from '../deepLinking/notificationUrl';

// PUBLIC value — a OneSignal App ID is a UUID that ships in every client bundle (and
// in the webapp's JS), so committing it is not a secret leak. It is a committed
// fallback rather than env-only for a practical reason: a local sideload would
// otherwise silently have no push whenever `.env.local` wasn't updated, and
// `OneSignal.initialize('')` is a no-op that reports nothing.
//
const FALLBACK_ONESIGNAL_APP_ID = 'b2d652ad-048c-4c4b-b945-fb613406e19d';

export const ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() || FALLBACK_ONESIGNAL_APP_ID;

// SecureStore keys written by the retired expo-notifications registration flow.
// Purged on first launch of an OneSignal build so a stale token can't linger on
// devices upgrading from a build that wrote them. Same precedent as the legacy
// permission-reminder key the old notifications module cleaned up.
const RETIRED_PUSH_KEYS = [
  'app.pushSubscriptionToken',
  'app.pushSubscriptionLanguage',
  'app.pushSubscriptionEnvironment',
];

export interface OneSignalDiagnostics {
  appId: string;
  permission: boolean;
  canRequest: boolean;
  optedIn: boolean;
  subscriptionId: string | null;
  pushToken: string | null;
  onesignalId: string | null;
  externalId: string | null;
}

let initialized = false;

// ─── Cold-start deep-link buffer ──────────────────────────────────────────────
//
// React Navigation asks for the launch URL exactly once, synchronously-ish, when the
// NavigationContainer mounts. OneSignal's click event, by contrast, crosses the bridge
// whenever the native side is ready. A notification tap that cold-launches the app can
// therefore land BEFORE anything is listening.
//
// So the click listener is registered at module load (see initOneSignal, called from
// App.tsx) and parks its URL here. `getInitialURL` drains it synchronously — it never
// waits, because the common launch has no notification and a timeout there would add
// dead time to every cold start. `subscribe` installs the live listener and replays
// anything that arrived in the gap.
let pendingUrl: string | null = null;
let urlListener: ((url: string) => void) | null = null;
let foregroundHandler: (() => void) | null = null;

function deliverUrl(url: string): void {
  if (urlListener) {
    urlListener(url);
    return;
  }
  pendingUrl = url;
}

/** Drain a URL captured before anything was listening. Never blocks. */
export function takePendingNotificationUrl(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

export function setNotificationUrlListener(fn: ((url: string) => void) | null): void {
  urlListener = fn;
  if (!fn || !pendingUrl) {
    return;
  }
  const url = pendingUrl;
  pendingUrl = null;
  // A click that landed between getInitialURL() and subscribe(). Deferred one turn so
  // the navigation container has finished processing its initial state first.
  queueMicrotask(() => fn(url));
}

/** Called when a push arrives while the app is foregrounded (resync hook). */
export function setForegroundNotificationHandler(fn: (() => void) | null): void {
  foregroundHandler = fn;
}

function notificationUrlFromClick(event: NotificationClickEvent): string | null {
  const additional = (event.notification.additionalData ?? {}) as Record<string, unknown>;
  // `result.url` is the click's own destination; `launchURL` is the notification's.
  const launch = event.notification.launchURL ?? event.result?.url;
  // Merge `url` ONLY when a launchURL is actually present. getNotificationUrl is
  // fail-closed on `url`, so injecting an undefined one would take that branch and
  // kill eventId routing outright. The backend sends `web_url` (web-only) and never
  // `url`/`app_url`, so on mobile this is normally absent and routing comes from
  // additionalData — with the allowlist still guarding the launchURL path.
  const data = typeof launch === 'string' && launch ? { ...additional, url: launch } : additional;
  return normalizeIncomingUrl(getNotificationUrl(data));
}

/**
 * Initialise the OneSignal SDK. Idempotent, and safe to call at module load.
 *
 * Called from App.tsx BEFORE React renders — see the buffer note above. It is an
 * explicit call rather than an import side effect on purpose: the i18n module in this
 * repo is initialised by a bare `import '../i18n'` and that has proven to be exactly
 * the kind of load-bearing line someone removes while tidying imports.
 */
export function initOneSignal(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  if (!ONESIGNAL_APP_ID) {
    console.warn('[OneSignal] no app id configured — push notifications are disabled');
    return;
  }

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  }

  OneSignal.initialize(ONESIGNAL_APP_ID);

  // Never collect location. The SDK ships the capability whether or not it is used,
  // and this app has no use for it — it is also an App Store privacy-questionnaire item.
  OneSignal.Location.setShared(false);

  // In-App Messages ship inside the SDK too. This app must never show one: a stray
  // dashboard campaign putting a modal in front of parishioners is precisely what the
  // two-audiences product rule exists to prevent.
  OneSignal.InAppMessages.setPaused(true);

  OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
    const url = notificationUrlFromClick(event);
    if (url) {
      deliverUrl(url);
    }
  });

  OneSignal.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event: NotificationWillDisplayEvent) => {
      // display() IS REQUIRED. Registering this listener is not passive: the SDK's
      // addEventListener('foregroundWillDisplay') calls through to the native
      // `addNotificationForegroundLifecycleListener`, which puts the SDK into
      // lifecycle mode — the notification is HELD pending an explicit decision from
      // JS. A handler that only does side work and returns drops it silently.
      //
      // Verified on device, same sender (the OneSignal dashboard) and same phone:
      //   app foregrounded -> notification never appeared
      //   app backgrounded -> notification appeared normally
      // An earlier version of this comment asserted the opposite ("do NOT call
      // preventDefault, the banner still displays"). That was wrong, and it cost a
      // long debugging session in which the backend was blamed twice.
      foregroundHandler?.();
      event.notification.display();
    },
  );

  for (const key of RETIRED_PUSH_KEYS) {
    void secureStorage.deleteItem(key).catch(() => {});
  }
}

/**
 * Mirror the in-app language choice onto the OneSignal user, so the backend's
 * `language` filter matches and multi-language `contents` picks the right text.
 *
 * Must run on EVERY launch, not only when the language changes: OneSignal seeds this
 * property from the DEVICE language, so a fresh install on a Japanese-locale phone
 * would sit at `ja` and match neither the `en` nor the `ko` audience.
 */
export function syncOneSignalLanguage(language: SupportedLanguage): void {
  if (!ONESIGNAL_APP_ID) return;
  OneSignal.User.setLanguage(language === 'ko' ? 'ko' : 'en');
}

/**
 * Ask for notification permission once, using the SYSTEM dialog.
 *
 * The Android-13 trap the old expo-notifications flow had to work around cannot recur
 * here: OneSignal's permission API is boolean, so there is no 'undetermined' state to
 * mistakenly gate on. The substance of that rule survives as "gate only on already-
 * granted, never on a state Android cannot report".
 *
 * `fallbackToSettings: false` keeps the deliberate no-nagging behaviour — `true` shows
 * an app-level alert offering to open Settings, which is the extra hop that was
 * removed on purpose.
 */
export async function requestOneSignalPermission(): Promise<boolean> {
  if (!ONESIGNAL_APP_ID) return false;
  if (await OneSignal.Notifications.getPermissionAsync()) {
    return true;
  }
  return OneSignal.Notifications.requestPermission(false);
}

export async function optInToPush(): Promise<boolean> {
  OneSignal.User.pushSubscription.optIn();
  return OneSignal.User.pushSubscription.getOptedInAsync();
}

export async function optOutOfPush(): Promise<void> {
  OneSignal.User.pushSubscription.optOut();
}

export async function getOneSignalDiagnostics(): Promise<OneSignalDiagnostics> {
  if (!ONESIGNAL_APP_ID) {
    return {
      appId: '',
      permission: false,
      canRequest: false,
      optedIn: false,
      subscriptionId: null,
      pushToken: null,
      onesignalId: null,
      externalId: null,
    };
  }

  const [permission, canRequest, optedIn, subscriptionId, pushToken, onesignalId, externalId] =
    await Promise.all([
      OneSignal.Notifications.getPermissionAsync(),
      OneSignal.Notifications.canRequestPermission(),
      OneSignal.User.pushSubscription.getOptedInAsync(),
      OneSignal.User.pushSubscription.getIdAsync(),
      OneSignal.User.pushSubscription.getTokenAsync(),
      OneSignal.User.getOnesignalId(),
      OneSignal.User.getExternalId(),
    ]);

  return {
    appId: ONESIGNAL_APP_ID,
    permission,
    canRequest,
    optedIn,
    subscriptionId: subscriptionId ?? null,
    pushToken: pushToken ?? null,
    onesignalId: onesignalId ?? null,
    externalId: externalId ?? null,
  };
}
