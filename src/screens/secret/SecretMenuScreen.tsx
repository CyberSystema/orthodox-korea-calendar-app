import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import * as Device from 'expo-device';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeView } from '../../components/common/KeyboardSafeView';
import { AnnouncementLogViewer } from './AnnouncementLogViewer';
import { getAppVersionLabel } from '../../utils/appVersion';
import type { RootStackParamList } from '../../navigation/types';
import {
  backendClient,
  configuredBaseUrl,
  syncCursorStore,
  adminTokenStore,
} from '../../services/api/backendClient';
import { logoutAdminThroughCloudflare } from '../../services/api/adminAuth';
import {
  ONESIGNAL_APP_ID,
  getOneSignalDiagnostics,
  optInToPush,
  optOutOfPush,
} from '../../services/notifications/oneSignal';
import {
  getCalendarDataVersion,
  getLastCalendarSyncAt,
  syncCalendarDataFromGithub,
} from '../../features/calendar/webCalendarSource';
import { secureStorage } from '../../services/storage/secureStorage';
import { useAppStore } from '../../store/useAppStore';
import { useEventsStore } from '../../features/events/useEventsStore';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'SecretMenu'>;

type LogEntry = { ts: string; msg: string; type: 'info' | 'ok' | 'err' | 'data' };

type TermLine = { text: string; type: 'cmd' | 'ok' | 'err' | 'info' | 'data' };
type TermEnv = 'dev' | 'staging' | 'prod';

const BACKEND_URLS: Record<TermEnv, string> = {
  dev: 'https://orthodox-korea-calendar-backend.leontg.workers.dev',
  staging: 'https://orthodox-korea-calendar-backend-staging.leontg.workers.dev',
  prod: 'https://orthodox-korea-calendar-backend-production.leontg.workers.dev',
};

// ─── Collapsible Section ─────────────────────────────────────────────
function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.sectionChevron}>{open ? '▼' : '▶'}</Text>
        <Text style={styles.sectionLabel}>{title}</Text>
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────
export function SecretMenuScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const setSecretMenuUnlocked = useAppStore((s) => s.setSecretMenuUnlocked);
  const setCloudflareAdminAuthenticated = useAppStore((s) => s.setCloudflareAdminAuthenticated);
  const syncYearEvents = useEventsStore((s) => s.syncYearEvents);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const logScrollRef = useRef<ScrollView>(null);

  // ── Announcement log viewer ──
  const [logViewerVisible, setLogViewerVisible] = useState(false);

  // ── Raw HTTP modal state ──
  const [rawModalVisible, setRawModalVisible] = useState(false);
  const [rawMethod, setRawMethod] = useState('GET');
  const [rawPath, setRawPath] = useState('/health');
  const [rawBody, setRawBody] = useState('');

  // ── Terminal state ──
  // Default OFF production so a stray `push test all` / `raw` cannot hit real
  // users' devices without an explicit env switch.
  const [termVisible, setTermVisible] = useState(false);
  const [termEnv, setTermEnv] = useState<TermEnv>('staging');
  const [termInput, setTermInput] = useState('');
  const [termLines, setTermLines] = useState<TermLine[]>([
    { text: 'Orthodox Korea Backend Terminal v1.0', type: 'info' },
    { text: 'Type "help" for available commands.', type: 'info' },
  ]);
  const [termBusy, setTermBusy] = useState(false);
  const [termHistory, setTermHistory] = useState<string[]>([]);
  const termScrollRef = useRef<ScrollView>(null);

  // ─── Logging ───────────────────────────────────────────────────
  const log = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { ts, msg, type }]);
    setTimeout(() => logScrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const copyLogs = useCallback(() => {
    const text = logs.map((l) => `[${l.ts}] ${l.msg}`).join('\n');
    Clipboard.setString(text);
    log('📋 Logs copied to clipboard', 'info');
  }, [logs, log]);

  const runAction = useCallback(
    async (label: string, action: () => Promise<string>) => {
      if (busy) return;
      setBusy(true);
      log(`⏳ ${label}...`);
      try {
        const result = await action();
        log(`✅ ${label}: ${result}`, 'ok');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`❌ ${label}: ${msg}`, 'err');
      } finally {
        setBusy(false);
      }
    },
    [busy, log],
  );

  // Destructive server-side wipe of ALL events + announcements (subscribers kept).
  // Two-step confirmation; the backend also requires an explicit { confirm: 'PURGE' }.
  const handlePurgeData = () => {
    Alert.alert(
      '☠️ Purge ALL event & notification data',
      `This permanently deletes EVERY event and EVERY announcement on:\n${configuredBaseUrl}\n\n` +
        `Push subscribers are KEPT. Synced devices will drop their events on next sync. ` +
        `Staging and production share one database, so this affects both. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue…',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Final confirmation', 'Wipe all events + announcements now?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'PURGE',
                style: 'destructive',
                onPress: () =>
                  void runAction('Purge Event & Notification Data', async () => {
                    const res = await backendClient.purgeData({ confirm: 'PURGE' });
                    log(`  events deleted: ${res.eventsDeleted}`, 'data');
                    log(`  announcements deleted: ${res.notificationsDeleted}`, 'data');
                    log(`  delete-tombstones written: ${res.tombstonesWritten}`, 'data');
                    return `events=${res.eventsDeleted}, announcements=${res.notificationsDeleted}`;
                  }),
              },
            ]),
        },
      ],
    );
  };

  // ═══════════════════════════════════════════════════════════════
  //  1.  DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════
  const handleHealthCheck = () =>
    runAction('Health Check', async () => {
      const start = Date.now();
      const data = await backendClient.health();
      const latency = Date.now() - start;
      return `ok=${data.ok}, service=${data.service}, latency=${latency}ms`;
    });

  const handleAdminMe = () =>
    runAction('Admin Session', async () => {
      const data = await backendClient.adminMe();
      const expires = new Date(data.expiresAt * 1000).toLocaleString();
      return `session=${data.sessionId.slice(0, 8)}…, expires=${expires}`;
    });

  const handleClientConfig = () =>
    runAction('Client Config', async () => {
      const data = await backendClient.clientConfig();
      return JSON.stringify(data, null, 2);
    });

  const handleShowEndpoint = () => {
    log(`🌐 Backend URL: ${configuredBaseUrl}`, 'data');
  };

  const handleCheckToken = () =>
    runAction('Check Admin Token', async () => {
      const token = await adminTokenStore.getToken();
      if (!token) return 'No admin token stored';
      return `Token present (${token.length} chars), starts with ${token.slice(0, 12)}…`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  2.  EVENTS / DATA
  // ═══════════════════════════════════════════════════════════════
  const handleListAllEvents = () =>
    runAction('List All Events', async () => {
      const data = await backendClient.listEvents({ limit: 500 });
      log(`📦 ${data.count} events total (fetched ${data.events.length})`, 'data');
      for (const ev of data.events.slice(0, 20)) {
        log(`  • [${ev.date}] ${ev.title.en || ev.title.ko} (id: ${ev.id.slice(0, 8)})`, 'data');
      }
      if (data.events.length > 20) log(`  … and ${data.events.length - 20} more`, 'data');
      return `${data.count} events`;
    });

  const handleListByType = (type: 'feast' | 'fast' | 'commemoration' | 'other') =>
    runAction(`List ${type} events`, async () => {
      const data = await backendClient.listEvents({ type, limit: 200 });
      for (const ev of data.events.slice(0, 10)) {
        log(`  • [${ev.date}] ${ev.title.en} (${ev.type})`, 'data');
      }
      return `${data.count} ${type} events`;
    });

  const handleGetEventById = () => {
    Alert.prompt('Get Event', 'Enter event ID:', async (id) => {
      if (!id?.trim()) return;
      await runAction(`Get Event ${id.slice(0, 8)}…`, async () => {
        const ev = await backendClient.getEvent(id.trim());
        log(JSON.stringify(ev, null, 2), 'data');
        return `${ev.title.en} on ${ev.date}`;
      });
    });
  };

  const handleDumpAllEventsJSON = () =>
    runAction('Dump All Events (JSON)', async () => {
      const data = await backendClient.listEvents({ limit: 1000 });
      const json = JSON.stringify(data.events, null, 2);
      Clipboard.setString(json);
      log('📋 Full event dump copied to clipboard', 'data');
      return `${data.events.length} events → clipboard (${(json.length / 1024).toFixed(1)} KB)`;
    });

  const handleDeleteEvent = () => {
    Alert.prompt('Delete Event', 'Enter event ID to delete:', (id) => {
      if (!id?.trim()) return;
      Alert.alert('Confirm Delete', `Are you sure you want to delete event ${id.trim()}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runAction(`Delete ${id.slice(0, 8)}…`, async () => {
              const res = await backendClient.deleteEvent(id.trim());
              return `deleted=${res.deleted}, id=${res.id}`;
            });
          },
        },
      ]);
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  3.  SYNC ENGINE
  // ═══════════════════════════════════════════════════════════════
  const handleSyncAll = () =>
    runAction('Sync All Pages', async () => {
      const pages = await backendClient.syncAll({
        onPage: (page) => {
          log(
            `  📄 page: ${page.events.length} events, ${page.deletedIds.length} deleted, cursor=${page.cursor}, more=${page.hasMore}`,
            'data',
          );
        },
      });
      const totalEvents = pages.reduce((s, p) => s + p.events.length, 0);
      const totalDeleted = pages.reduce((s, p) => s + p.deletedIds.length, 0);
      const lastCursor = pages.length > 0 ? pages[pages.length - 1].cursor : 0;
      return `${totalEvents} events, ${totalDeleted} deleted across ${pages.length} pages, cursor=${lastCursor}`;
    });

  const handleReadSyncCursor = () =>
    runAction('Read Sync Cursor', async () => {
      const cursor = await syncCursorStore.getCursor();
      return `cursor = ${cursor}`;
    });

  const handleResetSyncCursor = () => {
    Alert.alert('Reset Sync Cursor', 'Set cursor to 0? Next sync will re-fetch everything.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void runAction('Reset Sync Cursor', async () => {
            await syncCursorStore.setCursor(0);
            return 'cursor set to 0';
          });
        },
      },
    ]);
  };

  const handleSetSyncCursor = () => {
    Alert.prompt('Set Sync Cursor', 'Enter new cursor value:', async (val) => {
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0) {
        log('❌ Invalid cursor value', 'err');
        return;
      }
      await runAction(`Set cursor → ${num}`, async () => {
        await syncCursorStore.setCursor(num);
        return `cursor set to ${num}`;
      });
    });
  };

  const handleSyncSinglePage = () =>
    runAction('Sync Single Page (from cursor)', async () => {
      const cursor = await syncCursorStore.getCursor();
      const page = await backendClient.sync({ cursor, limit: 50 });
      log(
        `  events=${page.events.length}, deleted=${page.deletedIds.length}, cursor=${page.cursor}, more=${page.hasMore}`,
        'data',
      );
      return `fetched from cursor ${cursor}, new cursor=${page.cursor}`;
    });

  const handleForceSyncStore = () =>
    runAction('Force Store Sync (current year)', async () => {
      const year = dayjs().year();
      await syncYearEvents(year);
      return `store sync triggered for ${year}`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  4.  NOTIFICATIONS / SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════

  // OneSignal's create-message API returns no recipient count, so `recipients` is
  // null for a normal send. Reporting that as "0" (as this console first did) reads
  // as "reached nobody" while the dashboard shows the message delivered.
  const describeNotifyResult = (res: {
    recipients: number | null;
    notificationId: string | null;
  }): string =>
    res.recipients === null
      ? `queued, id=${res.notificationId ?? '—'} (count: see OneSignal → Delivery)`
      : `recipients=${res.recipients}`;

  // Real pushes go to real user devices. Require an explicit confirmation that
  // names the live environment before any broadcast leaves the console.
  const confirmBroadcast = (targetLabel: string, run: () => void) => {
    Alert.alert(
      'Send real push notification',
      `This sends a push to ${targetLabel} live subscribers on:\n${configuredBaseUrl}\n\nThese are real devices. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: run },
      ],
    );
  };

  const handleNotifyAll = () =>
    confirmBroadcast(
      'ALL',
      () =>
        void runAction('Notify All', async () => {
          const res = await backendClient.adminNotify({
            target: 'all',
            title_en: '[System Test] Push Check',
            title_ko: '[시스템] 푸시 확인',
            body_en: 'Test push from system console.',
            body_ko: '시스템 콘솔 테스트 푸시.',
          });
          log(`  provider=onesignal enabled=${res.providerEnabled}`, 'data');
          log(`  notificationId=${res.notificationId ?? '—'}`, 'data');
          for (const e of res.errors) log(`  ⚠︎ ${e}`, 'err');
          if (res.message) log(`  message: ${res.message}`, 'data');
          return describeNotifyResult(res);
        }),
    );

  const handleNotifyEnglish = () =>
    confirmBroadcast(
      'English',
      () =>
        void runAction('Notify English', async () => {
          const res = await backendClient.adminNotify({
            target: 'en',
            title_en: '[Test] English Push',
            title_ko: '[테스트] 영어 푸시',
            body_en: 'English-only test notification.',
            body_ko: '',
          });
          log(`  provider=onesignal enabled=${res.providerEnabled}`, 'data');
          for (const e of res.errors) log(`  ⚠︎ ${e}`, 'err');
          return `${describeNotifyResult(res)}, target=en`;
        }),
    );

  const handleNotifyKorean = () =>
    confirmBroadcast(
      'Korean',
      () =>
        void runAction('Notify Korean', async () => {
          const res = await backendClient.adminNotify({
            target: 'ko',
            title_en: '[Test] Korean Push',
            title_ko: '[테스트] 한국어 푸시',
            body_en: '',
            body_ko: '한국어 전용 테스트 알림.',
          });
          log(`  provider=onesignal enabled=${res.providerEnabled}`, 'data');
          for (const e of res.errors) log(`  ⚠︎ ${e}`, 'err');
          return `${describeNotifyResult(res)}, target=ko`;
        }),
    );

  /**
   * The plain "Send Test Push" buttons carry NO data, so tapping one can only ever
   * open Today — they cannot exercise the deep link at all. Only a real event notify
   * carries { eventId, date }, which is the payload the cold-start tap path consumes.
   *
   * That path is the highest-risk piece of the OneSignal migration (a notification
   * click racing React Navigation's getInitialURL, under an injected SceneDelegate
   * OneSignal has never documented support for), so it needs a repeatable way to fire
   * a genuine deep-link push without hand-creating an event each time.
   */
  const handleDeepLinkTestPush = () =>
    confirmBroadcast(
      'ALL (deep link)',
      () =>
        void runAction('Send Deep-Link Test Push', async () => {
          // Reuse a real event when one exists — creating one every run would litter
          // the calendar. Fall back to creating a test event only when there is none.
          let target = useEventsStore.getState().customEvents[0];
          if (!target) {
            const today = dayjs().format('YYYY-MM-DD');
            const created = await backendClient.createEvent({
              title_en: '[Test] Deep Link Target',
              title_ko: '[테스트] 딥링크 대상',
              description_en: 'Created by the console to test notification tap-through.',
              description_ko: '알림 탭 연결을 테스트하기 위해 콘솔에서 생성했습니다.',
              date: today,
              type: 'other',
              color: '#B8942E',
              all_day: true,
            });
            target = { id: created.id, dateISO: created.date } as typeof target;
            log(`  created target event ${created.id.slice(0, 8)}…`, 'info');
          }

          log(`  eventId=${target.id}`, 'data');
          log(`  date=${target.dateISO}`, 'data');
          log('  force-quit the app, then tap the notification from the lock screen', 'info');

          const res = await backendClient.adminNotify({
            target: 'all',
            title_en: '[Deep link] Tap to open the event',
            title_ko: '[딥링크] 일정을 열려면 탭하세요',
            body_en: 'This push carries an eventId — tapping it must open Event detail.',
            body_ko: '이 알림에는 eventId가 있습니다. 탭하면 일정 화면이 열려야 합니다.',
            data: { eventId: target.id, date: target.dateISO },
          });
          return describeNotifyResult(res);
        }),
    );

  const handlePushDiagnostic = () =>
    runAction('Push Subscription Diagnostic', async () => {
      // Still guarded: a simulator/emulator never gets an APNs/FCM token, so a null
      // subscription id there is expected rather than a fault.
      if (!Device.isDevice) return 'Not a physical device — push unavailable';

      const d = await getOneSignalDiagnostics();
      log(`  app id: ${d.appId || '(none configured)'}`, d.appId ? 'data' : 'err');
      log(`  permission: ${d.permission}`, 'data');
      log(`  can request: ${d.canRequest}`, 'data');
      log(`  opted in: ${d.optedIn}`, 'data');
      log(`  subscription id: ${d.subscriptionId ?? '(none)'}`, 'data');
      log(`  push token: ${d.pushToken ? `${d.pushToken.length} chars` : '(none)'}`, 'data');
      log(`  onesignal id: ${d.onesignalId ?? '(none)'}`, 'data');

      if (!d.permission) return 'Notification permission not granted';
      if (!d.subscriptionId) return 'No OneSignal subscription yet — try Opt In';
      return `subscribed (${d.subscriptionId.slice(0, 8)}…)`;
    });

  // A mismatch between the app's App ID and the Worker's is otherwise COMPLETELY
  // silent: the send succeeds, OneSignal reports recipients: 0, and no device ever
  // hears anything. Worth one button.
  const handleCompareAppId = () =>
    runAction('Compare App ID with Backend', async () => {
      const config = await backendClient.clientConfig();
      const backendAppId = config.oneSignal?.appId ?? '';
      log(`  app:     ${ONESIGNAL_APP_ID || '(none)'}`, 'data');
      log(`  backend: ${backendAppId || '(none)'}`, 'data');
      if (!ONESIGNAL_APP_ID || !backendAppId) {
        return 'MISSING — one side has no OneSignal App ID configured';
      }
      if (ONESIGNAL_APP_ID !== backendAppId) {
        return 'MISMATCH — this app and the backend target different OneSignal apps';
      }
      return 'match';
    });

  const handleNotifyCustom = () => {
    Alert.prompt('Custom Notification', 'Enter title (EN):', (titleEn) => {
      if (!titleEn?.trim()) return;
      Alert.prompt('Custom Notification', 'Enter body (EN):', (bodyEn) => {
        void runAction('Send Custom Notification', async () => {
          const res = await backendClient.adminNotify({
            target: 'all',
            title_en: titleEn.trim(),
            title_ko: titleEn.trim(),
            body_en: bodyEn?.trim() || '',
            body_ko: bodyEn?.trim() || '',
          });
          return describeNotifyResult(res);
        });
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  5.  LOCAL STORAGE / CACHE
  // ═══════════════════════════════════════════════════════════════
  const handleDumpLocalEvents = () =>
    runAction('Dump Local Event Cache', async () => {
      const raw = await secureStorage.getItem('events.cache');
      if (!raw) return 'No cached events';
      try {
        const parsed = JSON.parse(raw) as unknown[];
        log(`📦 ${parsed.length} cached events`, 'data');
        Clipboard.setString(raw);
        log('📋 Copied to clipboard', 'info');
        return `${parsed.length} events (${(raw.length / 1024).toFixed(1)} KB) → clipboard`;
      } catch {
        return `raw cache size = ${raw.length} chars (parse failed)`;
      }
    });

  const handleClearLocalEvents = () => {
    Alert.alert(
      'Clear Local Event Cache',
      'This removes all cached events. Next sync will re-fetch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void runAction('Clear Event Cache', async () => {
              await secureStorage.deleteItem('events.cache');
              return 'events.cache deleted';
            });
          },
        },
      ],
    );
  };

  const handleDumpAdminToken = () =>
    runAction('Dump Admin Token', async () => {
      const token = await adminTokenStore.getToken();
      if (!token) return 'No token';
      // Copy only a non-usable fingerprint — never the full bearer credential —
      // so the live admin token isn't left on the system clipboard (readable by
      // other apps / clipboard history).
      const fingerprint = `${token.slice(0, 12)}… (${token.length} chars)`;
      Clipboard.setString(fingerprint);
      log(`  fingerprint: ${fingerprint}`, 'data');
      return 'Token fingerprint copied (full token withheld for safety)';
    });

  const handleClearAdminToken = () => {
    Alert.alert('Clear Admin Token', 'You will need to re-authenticate.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void runAction('Clear Admin Token', async () => {
            await adminTokenStore.setToken(null);
            setCloudflareAdminAuthenticated(false);
            return 'admin token cleared';
          });
        },
      },
    ]);
  };

  const handleReadSecureKey = () => {
    Alert.prompt('Read Secure Key', 'Enter key name:', async (key) => {
      if (!key?.trim()) return;
      await runAction(`Read "${key}"`, async () => {
        const val = await secureStorage.getItem(key.trim());
        if (val === null) return 'null (not found)';
        log(val.length > 200 ? val.slice(0, 200) + '…' : val, 'data');
        return `${val.length} chars`;
      });
    });
  };

  const handleDeleteSecureKey = () => {
    Alert.prompt('Delete Secure Key', 'Enter key name to delete:', (key) => {
      if (!key?.trim()) return;
      Alert.alert('Confirm', `Delete secure key "${key.trim()}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runAction(`Delete "${key.trim()}"`, async () => {
              await secureStorage.deleteItem(key.trim());
              return 'deleted';
            });
          },
        },
      ]);
    });
  };

  const handleWriteSecureKey = () => {
    Alert.prompt('Write Secure Key', 'Enter key name:', (key) => {
      if (!key?.trim()) return;
      Alert.prompt('Value', `Enter value for "${key.trim()}":`, async (val) => {
        if (val === null || val === undefined) return;
        await runAction(`Write "${key.trim()}"`, async () => {
          await secureStorage.setItem(key.trim(), val);
          return `saved (${val.length} chars)`;
        });
      });
    });
  };

  const handleNukeAllStorage = () => {
    Alert.alert(
      '☢️ NUKE ALL LOCAL DATA',
      'This will clear: events cache, sync cursor, admin token, language preference. The app will behave as freshly installed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'NUKE',
          style: 'destructive',
          onPress: () => {
            void runAction('Nuke All Local Data', async () => {
              const keys = [
                'events.cache',
                'events.sync.cursor',
                'app.adminToken',
                'app.language',
                'app.pushSubscriptionToken',
                'app.pushSubscriptionEnvironment',
                'auth.staffModeEnabled',
              ];
              for (const k of keys) {
                try {
                  await secureStorage.deleteItem(k);
                  log(`  🗑 ${k} deleted`, 'info');
                } catch {
                  log(`  ⚠️ ${k} failed to delete`, 'err');
                }
              }
              await syncCursorStore.setCursor(0);
              setCloudflareAdminAuthenticated(false);
              return `${keys.length} keys cleared`;
            });
          },
        },
      ],
    );
  };

  // ═══════════════════════════════════════════════════════════════
  //  6.  REPAIR / RECONSTRUCT
  // ═══════════════════════════════════════════════════════════════
  const handleFullResync = () => {
    Alert.alert(
      'Full Resync',
      'Clear local cache + reset cursor, then sync everything from backend. This rebuilds the local database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resync',
          onPress: () => {
            void runAction('Full Resync', async () => {
              log('  1/4 Clearing event cache…', 'info');
              await secureStorage.deleteItem('events.cache');
              log('  2/4 Resetting sync cursor…', 'info');
              await syncCursorStore.setCursor(0);
              log('  3/4 Syncing all pages from backend…', 'info');
              const pages = await backendClient.syncAll();
              const allEvents = pages.flatMap((p) => p.events);
              log(`  4/4 Persisting ${allEvents.length} events…`, 'info');
              await secureStorage.setItem('events.cache', JSON.stringify(allEvents));
              const lastCursor = pages.length > 0 ? pages[pages.length - 1].cursor : 0;
              await syncCursorStore.setCursor(lastCursor);
              return `Rebuilt with ${allEvents.length} events, cursor=${lastCursor}`;
            });
          },
        },
      ],
    );
  };

  const handleVerifyIntegrity = () =>
    runAction('Verify Data Integrity', async () => {
      const issues: string[] = [];

      // Check admin token
      const token = await adminTokenStore.getToken();
      if (!token) issues.push('No admin token');

      // Check sync cursor
      const cursor = await syncCursorStore.getCursor();
      log(`  sync cursor = ${cursor}`, 'data');

      // Check local cache
      const raw = await secureStorage.getItem('events.cache');
      if (!raw) {
        issues.push('No event cache');
      } else {
        try {
          const parsed = JSON.parse(raw) as unknown[];
          log(`  local events = ${parsed.length}`, 'data');
        } catch {
          issues.push('Event cache is corrupt JSON');
        }
      }

      // Check backend health
      try {
        const health = await backendClient.health();
        log(`  backend health = ${health.ok}`, 'data');
      } catch (e) {
        issues.push(`Backend unreachable: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      // Check session validity
      if (token) {
        try {
          await backendClient.adminMe();
          log('  admin session = valid', 'data');
        } catch {
          issues.push('Admin session expired/invalid');
        }
      }

      // Compare local vs remote count
      try {
        const remote = await backendClient.listEvents({ limit: 1 });
        log(`  remote event count = ${remote.count}`, 'data');
        if (raw) {
          const local = JSON.parse(raw) as unknown[];
          const diff = remote.count - local.length;
          if (diff !== 0) {
            issues.push(
              `Count mismatch: remote=${remote.count}, local=${local.length} (diff=${diff})`,
            );
          }
        }
      } catch {
        issues.push('Could not fetch remote event count');
      }

      if (issues.length === 0) return '✨ All checks passed';
      for (const issue of issues) log(`  ⚠️ ${issue}`, 'err');
      return `${issues.length} issue(s) found`;
    });

  const handleReconcile = () =>
    runAction('Reconcile Local ↔ Remote', async () => {
      // Fetch all remote events
      const remote = await backendClient.listEvents({ limit: 1000 });
      const remoteIds = new Set(remote.events.map((e) => e.id));

      // Load local cache
      const raw = await secureStorage.getItem('events.cache');
      const local = raw ? (JSON.parse(raw) as Array<{ id: string }>) : [];
      const localIds = new Set(local.map((e) => e.id));

      const onlyRemote = remote.events.filter((e) => !localIds.has(e.id));
      const onlyLocal = local.filter((e) => !remoteIds.has(e.id));

      log(`  Remote-only: ${onlyRemote.length}`, 'data');
      for (const e of onlyRemote.slice(0, 5)) {
        log(`    + ${e.id.slice(0, 8)} [${e.date}] ${e.title.en}`, 'data');
      }
      log(`  Local-only: ${onlyLocal.length}`, 'data');
      for (const e of onlyLocal.slice(0, 5)) {
        log(`    - ${e.id.slice(0, 8)}`, 'data');
      }

      return `remote=${remote.events.length}, local=${local.length}, remoteOnly=${onlyRemote.length}, localOnly=${onlyLocal.length}`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  7.  DEVICE & APP INFO
  // ═══════════════════════════════════════════════════════════════
  const handleDeviceInfo = () => {
    log('📱 Device Information', 'info');
    log(`  Brand: ${Device.brand ?? 'unknown'}`, 'data');
    log(`  Model: ${Device.modelName ?? 'unknown'}`, 'data');
    log(`  Device Name: ${Device.deviceName ?? 'unknown'}`, 'data');
    log(`  OS: ${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`, 'data');
    log(`  Platform: ${Platform.OS} (v${Platform.Version})`, 'data');
    log(`  Is Physical Device: ${Device.isDevice}`, 'data');
    log(`  Device Type: ${Device.deviceType ?? 'unknown'}`, 'data');
    log(
      `  Total Memory: ${Device.totalMemory ? `${(Device.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB` : 'unknown'}`,
      'data',
    );
    log(`  Manufacturer: ${Device.manufacturer ?? 'unknown'}`, 'data');
  };

  const handleAppInfo = () => {
    log('📋 App Information', 'info');
    log(`  App Version: ${getAppVersionLabel()}`, 'data');
    log(`  Backend URL: ${configuredBaseUrl}`, 'data');
    log(`  __DEV__: ${__DEV__}`, 'data');
    log(`  OneSignal App ID: ${ONESIGNAL_APP_ID || '(none configured)'}`, 'data');
    log(`  Platform: ${Platform.OS}`, 'data');
    log(
      `  React Native: ${Platform.constants?.reactNativeVersion ? `${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}.${Platform.constants.reactNativeVersion.patch}` : 'unknown'}`,
      'data',
    );
  };

  const handleListAllSecureKeys = () =>
    runAction('List All Known Secure Keys', async () => {
      const knownKeys = [
        'events.cache',
        'events.sync.cursor',
        'app.adminToken',
        'app.language',
        'auth.staffModeEnabled',
      ];
      let found = 0;
      for (const key of knownKeys) {
        const val = await secureStorage.getItem(key);
        if (val !== null) {
          found++;
          log(`  ✓ ${key} (${val.length} chars)`, 'data');
        } else {
          log(`  ✗ ${key} — empty`, 'info');
        }
      }
      return `${found}/${knownKeys.length} keys have values`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  8.  EVENT MANAGEMENT (Create / Update / Clone)
  // ═══════════════════════════════════════════════════════════════
  const handleQuickCreateTestEvent = () =>
    runAction('Quick Create Test Event', async () => {
      const today = dayjs().format('YYYY-MM-DD');
      const ev = await backendClient.createEvent({
        title_en: `[Test] Admin Console Event`,
        title_ko: `[테스트] 관리 콘솔 이벤트`,
        description_en: `Test event created via admin console on ${today}`,
        description_ko: `${today}에 관리 콘솔을 통해 생성된 테스트 이벤트`,
        date: today,
        type: 'other',
        color: '#FF6B6B',
        all_day: true,
      });
      return `created id=${ev.id.slice(0, 8)}… on ${ev.date}`;
    });

  const handleCreateCustomEvent = () => {
    Alert.prompt('Create Event', 'Enter title (EN):', (titleEn) => {
      if (!titleEn?.trim()) return;
      Alert.prompt('Korean Title', 'Enter title (KO):', (titleKo) => {
        Alert.prompt('Date', 'Enter date (YYYY-MM-DD):', (date) => {
          if (!date?.trim()) return;
          Alert.prompt('Type', 'feast / fast / commemoration / other:', (type) => {
            void runAction('Create Event', async () => {
              const ev = await backendClient.createEvent({
                title_en: titleEn.trim(),
                title_ko: titleKo?.trim() || titleEn.trim(),
                date: date.trim(),
                type: (type?.trim() as 'feast' | 'fast' | 'commemoration' | 'other') || 'other',
                all_day: true,
              });
              return `created id=${ev.id.slice(0, 8)}… "${ev.title.en}" on ${ev.date}`;
            });
          });
        });
      });
    });
  };

  const handleUpdateEvent = () => {
    Alert.prompt('Update Event', 'Enter event ID:', (id) => {
      if (!id?.trim()) return;
      Alert.prompt('Field', 'title_en / title_ko / date / type / color:', (field) => {
        if (!field?.trim()) return;
        Alert.prompt('New Value', `Enter new value for ${field.trim()}:`, (value) => {
          if (value === null || value === undefined) return;
          void runAction(`Update ${id.slice(0, 8)}…`, async () => {
            const input: Record<string, unknown> = {};
            input[field.trim()] = value.trim();
            const ev = await backendClient.updateEvent(id.trim(), input);
            return `updated "${ev.title.en}" (${ev.date})`;
          });
        });
      });
    });
  };

  const handleCloneEvent = () => {
    Alert.prompt('Clone Event', 'Enter source event ID:', (id) => {
      if (!id?.trim()) return;
      Alert.prompt('New Date', 'Enter new date (YYYY-MM-DD):', (newDate) => {
        if (!newDate?.trim()) return;
        void runAction(`Clone ${id.slice(0, 8)}…`, async () => {
          const source = await backendClient.getEvent(id.trim());
          const clone = await backendClient.createEvent({
            title_en: source.title.en,
            title_ko: source.title.ko,
            description_en: source.description.en,
            description_ko: source.description.ko,
            date: newDate.trim(),
            type: source.type,
            color: source.color,
            all_day: source.allDay,
          });
          return `cloned → id=${clone.id.slice(0, 8)}… on ${clone.date}`;
        });
      });
    });
  };

  const handleBatchDeleteRange = () => {
    Alert.prompt('Batch Delete', 'Enter start date (YYYY-MM-DD):', (from) => {
      if (!from?.trim()) return;
      Alert.prompt('Batch Delete', 'Enter end date (YYYY-MM-DD):', (to) => {
        if (!to?.trim()) return;
        void runAction('Fetch events in range', async () => {
          const data = await backendClient.listEvents({
            from: from.trim(),
            to: to.trim(),
            limit: 500,
          });
          if (data.events.length === 0) return 'No events in range';

          for (const ev of data.events) {
            log(`  • [${ev.date}] ${ev.title.en} (${ev.id.slice(0, 8)})`, 'data');
          }

          return new Promise<string>((resolve) => {
            Alert.alert(
              'Confirm Batch Delete',
              `Delete ${data.events.length} events from ${from.trim()} to ${to.trim()}?`,
              [
                { text: 'Cancel', onPress: () => resolve('cancelled') },
                {
                  text: `Delete ${data.events.length}`,
                  style: 'destructive',
                  onPress: async () => {
                    let deleted = 0;
                    let failed = 0;
                    for (const ev of data.events) {
                      try {
                        await backendClient.deleteEvent(ev.id);
                        deleted++;
                        log(`  🗑 ${ev.id.slice(0, 8)} deleted`, 'info');
                      } catch {
                        failed++;
                        log(`  ⚠️ ${ev.id.slice(0, 8)} failed`, 'err');
                      }
                    }
                    resolve(`deleted=${deleted}, failed=${failed}`);
                  },
                },
              ],
            );
          });
        });
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  9.  SUBSCRIPTION & NETWORK
  // ═══════════════════════════════════════════════════════════════
  const handleShowSubscriptionId = () =>
    runAction('OneSignal Subscription ID + Token', async () => {
      if (!Device.isDevice) return 'Not a physical device';

      const d = await getOneSignalDiagnostics();
      if (!d.subscriptionId) return 'No OneSignal subscription on this device yet';

      log(`  Subscription ID: ${d.subscriptionId}`, 'data');
      log(`  OneSignal ID:    ${d.onesignalId ?? '(none)'}`, 'data');
      if (d.pushToken) {
        log(`  Push token (${d.pushToken.length} chars):`, 'data');
        log(`  ${d.pushToken}`, 'data');
      }
      // The SUBSCRIPTION ID is the value you search on in OneSignal → Audience,
      // so that is what goes to the clipboard rather than the raw device token.
      Clipboard.setString(d.subscriptionId);
      log('  📋 Subscription ID copied to clipboard', 'info');
      return `subscription ${d.subscriptionId.slice(0, 8)}…`;
    });

  const handleOptInPush = () =>
    runAction('Opt In to Push', async () => {
      const optedIn = await optInToPush();
      return optedIn ? 'Opted in' : 'Opt-in did not take (check permission)';
    });

  const handleOptOutPush = () => {
    Alert.alert(
      'Opt Out of Push',
      'Stop receiving push notifications on this device? This is device-local and you can opt back in from here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Opt Out',
          style: 'destructive',
          onPress: () => {
            void runAction('Opt Out of Push', async () => {
              await optOutOfPush();
              return 'Opted out on this device';
            });
          },
        },
      ],
    );
  };

  const handleTestAllBackends = () =>
    runAction('Test All Backend Endpoints', async () => {
      const endpoints = [
        { name: 'Development', url: 'https://orthodox-korea-calendar-backend.leontg.workers.dev' },
        {
          name: 'Staging',
          url: 'https://orthodox-korea-calendar-backend-staging.leontg.workers.dev',
        },
        {
          name: 'Production',
          url: 'https://orthodox-korea-calendar-backend-production.leontg.workers.dev',
        },
      ];
      const results: string[] = [];
      for (const ep of endpoints) {
        const start = Date.now();
        try {
          const res = await fetch(`${ep.url}/health`, { method: 'GET' });
          const latency = Date.now() - start;
          const data = (await res.json()) as { ok: boolean; service?: string };
          const status = data.ok ? '✅' : '⚠️';
          log(`  ${status} ${ep.name}: ${latency}ms (${res.status})`, data.ok ? 'ok' : 'err');
          results.push(`${ep.name}=${latency}ms`);
        } catch (e) {
          const latency = Date.now() - start;
          log(
            `  ❌ ${ep.name}: ${e instanceof Error ? e.message : 'failed'} (${latency}ms)`,
            'err',
          );
          results.push(`${ep.name}=FAIL`);
        }
      }
      return results.join(', ');
    });

  const handleBenchmarkBackend = () =>
    runAction('Benchmark Backend (10 pings)', async () => {
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await backendClient.health();
        times.push(Date.now() - start);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      log(`  Pings: ${times.map((t) => `${t}ms`).join(', ')}`, 'data');
      return `avg=${avg.toFixed(0)}ms, min=${min}ms, max=${max}ms`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  TERMINAL COMMAND PROCESSOR
  // ═══════════════════════════════════════════════════════════════
  const termLog = useCallback((text: string, type: TermLine['type'] = 'info') => {
    setTermLines((prev) => [...prev, { text, type }]);
    setTimeout(() => termScrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const processTermCommand = useCallback(
    async (raw: string) => {
      const input = raw.trim();
      if (!input) return;

      setTermHistory((prev) => [...prev, input]);
      termLog(`$ ${input}`, 'cmd');

      const [cmd, ...args] = input.split(/\s+/);
      const baseUrl = BACKEND_URLS[termEnv];

      // Destructive terminal commands hit real user devices/data when run against
      // production. Require an explicit confirmation naming the live URL before
      // letting any such command through; non-prod envs run unprompted.
      const confirmIfProd = (label: string): Promise<boolean> =>
        new Promise((resolve) => {
          if (termEnv !== 'prod') {
            resolve(true);
            return;
          }
          Alert.alert(
            'Production target',
            `Run "${label}" against PRODUCTION?\n${baseUrl}\n\nThis affects real users. Continue?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Run', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });

      const termFetch = async (path: string, init?: RequestInit) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = await adminTokenStore.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}${path}`, {
          ...init,
          headers: { ...headers, ...init?.headers },
        });
        return res;
      };

      try {
        switch (cmd) {
          case 'help':
            termLog('Available commands:', 'info');
            termLog('  help                    Show this help', 'info');
            termLog('  clear                   Clear terminal', 'info');
            termLog('  env                     Show current environment', 'info');
            termLog('  env <dev|staging|prod>  Switch environment', 'info');
            termLog('  health                  Health check', 'info');
            termLog('  me                      Admin session info', 'info');
            termLog('  config                  Client config', 'info');
            termLog('  token                   Admin token info', 'info');
            termLog('  events list [limit]     List events', 'info');
            termLog('  events get <id>         Get event by ID', 'info');
            termLog('  events count            Event count by type', 'info');
            termLog('  sync status             Sync cursor status', 'info');
            termLog('  sync run                Run full sync', 'info');
            termLog('  sync reset              Reset sync cursor to 0', 'info');
            termLog('  push status             Push subscription info', 'info');
            termLog('  push test [all|en|ko]   Send test notification', 'info');
            termLog('  ping [N]                Benchmark (N pings, default 5)', 'info');
            termLog('  raw <METHOD> <PATH>     Raw HTTP request', 'info');
            termLog('  history                 Show command history', 'info');
            break;

          case 'clear':
            setTermLines([{ text: 'Terminal cleared.', type: 'info' }]);
            break;

          case 'env':
            if (args.length === 0) {
              termLog(`Current environment: ${termEnv}`, 'ok');
              termLog(`URL: ${baseUrl}`, 'data');
            } else {
              const target = args[0] as TermEnv;
              if (target in BACKEND_URLS) {
                setTermEnv(target);
                termLog(`Switched to ${target}`, 'ok');
                termLog(`URL: ${BACKEND_URLS[target]}`, 'data');
              } else {
                termLog(`Unknown env "${args[0]}". Use: dev, staging, prod`, 'err');
              }
            }
            break;

          case 'health': {
            const start = Date.now();
            const res = await termFetch('/health');
            const data = (await res.json()) as { ok: boolean; service?: string };
            const latency = Date.now() - start;
            termLog(
              `ok=${data.ok}, service=${data.service ?? 'n/a'}, latency=${latency}ms`,
              data.ok ? 'ok' : 'err',
            );
            break;
          }

          case 'me': {
            const res = await termFetch('/admin/me');
            if (!res.ok) {
              termLog(`HTTP ${res.status}: ${res.statusText}`, 'err');
              break;
            }
            const data = (await res.json()) as { sessionId: string; expiresAt: number };
            termLog(`session: ${data.sessionId.slice(0, 12)}…`, 'data');
            termLog(`expires: ${new Date(data.expiresAt * 1000).toLocaleString()}`, 'data');
            break;
          }

          case 'config': {
            const res = await termFetch('/client-config');
            const data = await res.json();
            termLog(JSON.stringify(data, null, 2), 'data');
            break;
          }

          case 'token': {
            const token = await adminTokenStore.getToken();
            if (!token) {
              termLog('No admin token stored', 'err');
              break;
            }
            termLog(`Token: ${token.slice(0, 16)}…  (${token.length} chars)`, 'data');
            break;
          }

          case 'events': {
            const sub = args[0] ?? 'list';
            if (sub === 'list') {
              const limit = Number(args[1]) || 20;
              const res = await termFetch(`/events?limit=${limit}`);
              const data = (await res.json()) as {
                count: number;
                events: Array<{ id: string; date: string; title: { en: string }; type: string }>;
              };
              termLog(`Total: ${data.count} events (showing ${data.events.length})`, 'ok');
              for (const ev of data.events) {
                termLog(`  [${ev.date}] ${ev.title.en} (${ev.type}, ${ev.id.slice(0, 8)})`, 'data');
              }
            } else if (sub === 'get') {
              if (!args[1]) {
                termLog('Usage: events get <id>', 'err');
                break;
              }
              const res = await termFetch(`/events/${args[1]}`);
              if (!res.ok) {
                termLog(`HTTP ${res.status}: ${res.statusText}`, 'err');
                break;
              }
              const data = await res.json();
              termLog(JSON.stringify(data, null, 2), 'data');
            } else if (sub === 'count') {
              const res = await termFetch('/events?limit=1');
              const data = (await res.json()) as { count: number };
              termLog(`Total events: ${data.count}`, 'ok');
              for (const type of ['feast', 'fast', 'commemoration', 'other']) {
                const r = await termFetch(`/events?type=${type}&limit=1`);
                const d = (await r.json()) as { count: number };
                termLog(`  ${type}: ${d.count}`, 'data');
              }
            } else {
              termLog(`Unknown subcommand: events ${sub}`, 'err');
              termLog('Usage: events list [limit] | events get <id> | events count', 'info');
            }
            break;
          }

          case 'sync': {
            const sub = args[0] ?? 'status';
            if (sub === 'status') {
              const cursor = await syncCursorStore.getCursor();
              const res = await termFetch(`/sync?cursor=${cursor}&limit=1`);
              const data = (await res.json()) as {
                cursor: number;
                hasMore: boolean;
                events: unknown[];
                deletedIds: unknown[];
              };
              termLog(`Local cursor: ${cursor}`, 'data');
              termLog(`Has more: ${data.hasMore}`, 'data');
              termLog(`Next cursor: ${data.cursor}`, 'data');
              termLog(
                cursor === data.cursor && !data.hasMore ? 'Fully synced' : 'Out of sync',
                data.hasMore ? 'err' : 'ok',
              );
            } else if (sub === 'run') {
              termLog('Running full sync…', 'info');
              const pages = await backendClient.syncAll({
                onPage: (page) => {
                  termLog(
                    `  page: ${page.events.length} events, ${page.deletedIds.length} deleted, cursor=${page.cursor}`,
                    'data',
                  );
                },
              });
              const total = pages.reduce((s, p) => s + p.events.length, 0);
              termLog(`Done: ${total} events across ${pages.length} page(s)`, 'ok');
            } else if (sub === 'reset') {
              await syncCursorStore.setCursor(0);
              termLog('Sync cursor reset to 0', 'ok');
            } else {
              termLog(`Unknown: sync ${sub}. Use: status, run, reset`, 'err');
            }
            break;
          }

          case 'push': {
            const sub = args[0] ?? 'status';
            if (sub === 'status') {
              if (!Device.isDevice) {
                termLog('Not a physical device', 'err');
                break;
              }
              const d = await getOneSignalDiagnostics();
              termLog(`App ID: ${d.appId || '(none configured)'}`, d.appId ? 'data' : 'err');
              termLog(`Permission: ${d.permission}`, 'data');
              termLog(`Opted in: ${d.optedIn}`, 'data');
              termLog(`Subscription: ${d.subscriptionId ?? '(none)'}`, 'data');
              if (d.pushToken) {
                termLog(
                  `Token: ${d.pushToken.slice(0, 32)}… (${d.pushToken.length} chars)`,
                  'data',
                );
              }
            } else if (sub === 'test') {
              const target = args[1] ?? 'all';
              if (!['all', 'en', 'ko'].includes(target)) {
                termLog('Usage: push test [all|en|ko]', 'err');
                break;
              }
              if (!(await confirmIfProd(`push test ${target}`))) {
                termLog('Cancelled.', 'info');
                break;
              }
              const res = await termFetch('/notifications', {
                method: 'POST',
                body: JSON.stringify({
                  target,
                  title_en: `[Terminal Test] ${target}`,
                  title_ko: `[터미널 테스트] ${target}`,
                  body_en: 'Test push from terminal.',
                  body_ko: '터미널 테스트 푸시.',
                }),
              });
              const json = (await res.json()) as {
                ok: boolean;
                data?: {
                  recipients: number | null;
                  notificationId: string | null;
                  providerEnabled: boolean;
                  errors: string[];
                  message?: string;
                };
                error?: { message?: string };
              };
              if (!res.ok || !json.ok || !json.data) {
                termLog(`push test failed: ${json.error?.message ?? `HTTP ${res.status}`}`, 'err');
                break;
              }
              const d = json.data;
              for (const e of d.errors) termLog(`  ⚠︎ ${e}`, 'err');
              if (d.message) termLog(`  ${d.message}`, 'data');
              termLog(
                `${d.recipients === null ? 'queued' : `recipients=${d.recipients}`}, ` +
                  `id=${d.notificationId ?? '—'}, provider=${d.providerEnabled}`,
                d.errors.length === 0 ? 'ok' : 'err',
              );
            } else {
              termLog(`Unknown: push ${sub}. Use: status, test`, 'err');
            }
            break;
          }

          case 'ping': {
            const count = Math.min(Number(args[0]) || 5, 20);
            const times: number[] = [];
            for (let i = 0; i < count; i++) {
              const start = Date.now();
              await termFetch('/health');
              const ms = Date.now() - start;
              times.push(ms);
              termLog(`  ping ${i + 1}: ${ms}ms`, 'data');
            }
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            termLog(
              `avg=${avg.toFixed(0)}ms, min=${Math.min(...times)}ms, max=${Math.max(...times)}ms`,
              'ok',
            );
            break;
          }

          case 'raw': {
            if (args.length < 2) {
              termLog('Usage: raw <METHOD> <PATH> [JSON_BODY]', 'err');
              break;
            }
            const method = args[0].toUpperCase();
            const path = args[1];
            const body = args.slice(2).join(' ') || undefined;
            const init: RequestInit = { method };
            if (body && !['GET', 'HEAD'].includes(method)) init.body = body;
            if (
              !['GET', 'HEAD'].includes(method) &&
              !(await confirmIfProd(`raw ${method} ${path}`))
            ) {
              termLog('Cancelled.', 'info');
              break;
            }
            const start = Date.now();
            const res = await termFetch(path, init);
            const latency = Date.now() - start;
            const text = await res.text();
            termLog(`${res.status} ${res.statusText} (${latency}ms)`, res.ok ? 'ok' : 'err');
            try {
              termLog(JSON.stringify(JSON.parse(text), null, 2), 'data');
            } catch {
              termLog(text.slice(0, 2000), 'data');
            }
            break;
          }

          case 'history':
            if (termHistory.length === 0) {
              termLog('No history yet', 'info');
              break;
            }
            for (let i = 0; i < termHistory.length; i++) {
              termLog(`  ${i + 1}. ${termHistory[i]}`, 'data');
            }
            break;

          default:
            termLog(`Unknown command: ${cmd}. Type "help" for available commands.`, 'err');
        }
      } catch (e: unknown) {
        termLog(`Error: ${e instanceof Error ? e.message : String(e)}`, 'err');
      }
    },
    [termEnv, termHistory, termLog],
  );

  const handleTermSubmit = useCallback(async () => {
    if (termBusy || !termInput.trim()) return;
    setTermBusy(true);
    const cmd = termInput;
    setTermInput('');
    Keyboard.dismiss();
    try {
      await processTermCommand(cmd);
    } finally {
      setTermBusy(false);
    }
  }, [termBusy, termInput, processTermCommand]);

  // ═══════════════════════════════════════════════════════════════
  //  10. CALENDAR DATA (GitHub Sync)
  // ═══════════════════════════════════════════════════════════════
  const handleForceCalendarSync = () =>
    runAction('Force Calendar Data Sync (GitHub)', async () => {
      // force: bypass the short duplicate-call floor so this always hits GitHub.
      await syncCalendarDataFromGithub({ force: true });
      const syncedAt = getLastCalendarSyncAt();
      log(`  Last synced: ${syncedAt ? new Date(syncedAt).toLocaleString() : 'never'}`, 'data');
      log(`  Data version: ${getCalendarDataVersion()}`, 'data');
      return 'Calendar data checked against GitHub';
    });

  const handleForceSyncYear = () => {
    Alert.prompt('Sync Year', 'Enter year to sync (e.g. 2026):', async (val) => {
      const year = Number(val);
      if (!Number.isFinite(year) || year < 2020 || year > 2100) {
        log('❌ Invalid year', 'err');
        return;
      }
      await runAction(`Force Store Sync (${year})`, async () => {
        await syncYearEvents(year);
        return `store sync triggered for ${year}`;
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  11. ANALYTICS & STATS
  // ═══════════════════════════════════════════════════════════════
  const handleEventStats = () =>
    runAction('Event Statistics', async () => {
      const types = ['feast', 'fast', 'commemoration', 'other'] as const;
      let total = 0;
      for (const type of types) {
        const data = await backendClient.listEvents({ type, limit: 1 });
        log(`  ${type}: ${data.count}`, 'data');
        total += data.count;
      }
      return `Total: ${total} events across ${types.length} types`;
    });

  const handleEventsPerMonth = () => {
    const year = dayjs().year();
    void runAction(`Events per Month (${year})`, async () => {
      const months: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const from = `${year}-${String(m).padStart(2, '0')}-01`;
        const lastDay = dayjs(from).endOf('month').format('YYYY-MM-DD');
        const data = await backendClient.listEvents({ from, to: lastDay, limit: 1 });
        const bar = '█'.repeat(Math.min(data.count, 30));
        log(`  ${dayjs(from).format('MMM')}: ${data.count} ${bar}`, 'data');
        months.push(`${dayjs(from).format('MMM')}=${data.count}`);
      }
      return months.join(', ');
    });
  };

  const handleSyncCursorDelta = () =>
    runAction('Sync Cursor Delta (local vs remote)', async () => {
      const localCursor = await syncCursorStore.getCursor();
      const page = await backendClient.sync({ cursor: localCursor, limit: 1 });
      log(`  Local cursor: ${localCursor}`, 'data');
      log(`  Remote has more: ${page.hasMore}`, 'data');
      log(`  Next cursor: ${page.cursor}`, 'data');
      log(`  Pending events: ${page.events.length}`, 'data');
      log(`  Pending deletes: ${page.deletedIds.length}`, 'data');
      if (page.hasMore) {
        // Fetch all remaining to count
        let remaining = page.events.length;
        let cursor = page.cursor;
        let pages = 1;
        while (true) {
          const next = await backendClient.sync({ cursor, limit: 100 });
          remaining += next.events.length;
          cursor = next.cursor;
          pages++;
          if (!next.hasMore) break;
          if (pages > 50) break;
        }
        return `${remaining} unsynced events behind (${pages} pages)`;
      }
      return localCursor === page.cursor
        ? 'Fully synced ✨'
        : `${page.events.length} pending change(s)`;
    });

  // ═══════════════════════════════════════════════════════════════
  //  12. RAW HTTP EXECUTOR
  // ═══════════════════════════════════════════════════════════════
  const handleRawRequest = async () => {
    if (busy) return;
    setBusy(true);
    Keyboard.dismiss();
    setRawModalVisible(false);
    const url = `${configuredBaseUrl}${rawPath}`;
    log(`⏳ ${rawMethod} ${rawPath}…`);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await adminTokenStore.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const init: RequestInit = { method: rawMethod, headers };
      if (rawBody.trim() && rawMethod !== 'GET' && rawMethod !== 'HEAD') {
        init.body = rawBody.trim();
      }

      const start = Date.now();
      const response = await fetch(url, init);
      const latency = Date.now() - start;
      const text = await response.text();

      log(
        `✅ ${response.status} ${response.statusText} (${latency}ms)`,
        response.ok ? 'ok' : 'err',
      );

      // Try to pretty-print JSON
      try {
        const json = JSON.parse(text);
        const pretty = JSON.stringify(json, null, 2);
        log(pretty, 'data');
        Clipboard.setString(pretty);
        log('📋 Response copied to clipboard', 'info');
      } catch {
        log(text.slice(0, 2000), 'data');
        if (text.length > 2000) log(`… (${text.length} total chars)`, 'data');
      }
    } catch (e: unknown) {
      log(`❌ ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  8.  LOCK & HIDE
  // ═══════════════════════════════════════════════════════════════
  const handleLockAndHide = () => {
    Alert.alert('Lock Secret Menu', 'Logout admin session and hide menu?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutAdminThroughCloudflare();
          } catch {
            // ignore
          }
          setCloudflareAdminAuthenticated(false);
          setSecretMenuUnlocked(false);
          navigation.goBack();
        },
      },
    ]);
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {/* ── Title Bar ── */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>🔧 System Console</Text>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainContent}>
        {/* ═══ DIAGNOSTICS ═══ */}
        <Section title="⚡ Diagnostics" defaultOpen>
          <ActionButton
            label="Health Check (with latency)"
            onPress={handleHealthCheck}
            disabled={busy}
          />
          <ActionButton label="Admin Session Info" onPress={handleAdminMe} disabled={busy} />
          <ActionButton
            label="Client Config (OneSignal)"
            onPress={handleClientConfig}
            disabled={busy}
          />
          <ActionButton label="Show Backend URL" onPress={handleShowEndpoint} disabled={busy} />
          <ActionButton label="Check Admin Token" onPress={handleCheckToken} disabled={busy} />
        </Section>

        {/* ═══ EVENTS / DATA ═══ */}
        <Section title="📦 Events & Data">
          <ActionButton label="List All Events" onPress={handleListAllEvents} disabled={busy} />
          <ActionButton
            label="List Feasts"
            onPress={() => handleListByType('feast')}
            disabled={busy}
          />
          <ActionButton
            label="List Fasts"
            onPress={() => handleListByType('fast')}
            disabled={busy}
          />
          <ActionButton
            label="List Commemorations"
            onPress={() => handleListByType('commemoration')}
            disabled={busy}
          />
          <ActionButton
            label="List Other"
            onPress={() => handleListByType('other')}
            disabled={busy}
          />
          <ActionButton label="Get Event by ID" onPress={handleGetEventById} disabled={busy} />
          <ActionButton
            label="Dump All Events → Clipboard (JSON)"
            onPress={handleDumpAllEventsJSON}
            disabled={busy}
          />
          <ActionButton
            label="Delete Event by ID"
            onPress={handleDeleteEvent}
            disabled={busy}
            danger
          />
        </Section>

        {/* ═══ SYNC ENGINE ═══ */}
        <Section title="🔄 Sync Engine">
          <ActionButton label="Sync All Pages (full)" onPress={handleSyncAll} disabled={busy} />
          <ActionButton
            label="Sync Single Page (from cursor)"
            onPress={handleSyncSinglePage}
            disabled={busy}
          />
          <ActionButton label="Read Sync Cursor" onPress={handleReadSyncCursor} disabled={busy} />
          <ActionButton label="Set Sync Cursor" onPress={handleSetSyncCursor} disabled={busy} />
          <ActionButton
            label="Reset Sync Cursor → 0"
            onPress={handleResetSyncCursor}
            disabled={busy}
            danger
          />
          <ActionButton
            label="Force Store Sync (current year)"
            onPress={handleForceSyncStore}
            disabled={busy}
          />
        </Section>

        {/* ═══ NOTIFICATIONS ═══ */}
        <Section title="🔔 Notifications">
          <ActionButton
            label="Push Subscription Diagnostic"
            onPress={handlePushDiagnostic}
            disabled={busy}
          />
          <ActionButton
            label="Compare App ID with Backend"
            onPress={handleCompareAppId}
            disabled={busy}
          />
          <ActionButton label="Send Test Push → All" onPress={handleNotifyAll} disabled={busy} />
          <ActionButton
            label="Send Deep-Link Test Push (opens Event detail)"
            onPress={handleDeepLinkTestPush}
            disabled={busy}
          />
          <ActionButton
            label="Send Test Push → English"
            onPress={handleNotifyEnglish}
            disabled={busy}
          />
          <ActionButton
            label="Send Test Push → Korean"
            onPress={handleNotifyKorean}
            disabled={busy}
          />
          <ActionButton
            label="Send Custom Notification"
            onPress={handleNotifyCustom}
            disabled={busy}
          />
        </Section>

        {/* ═══ ANNOUNCEMENT LOG ═══ */}
        <Section title="📜 Announcement Log">
          <ActionButton
            label="Open Full Log (every broadcast, incl. hidden)"
            onPress={() => setLogViewerVisible(true)}
            disabled={busy}
          />
        </Section>

        {/* ═══ LOCAL STORAGE ═══ */}
        <Section title="💾 Local Storage & Cache">
          <ActionButton
            label="Dump Local Event Cache → Clipboard"
            onPress={handleDumpLocalEvents}
            disabled={busy}
          />
          <ActionButton
            label="Clear Local Event Cache"
            onPress={handleClearLocalEvents}
            disabled={busy}
            danger
          />
          <ActionButton
            label="Dump Admin Token → Clipboard"
            onPress={handleDumpAdminToken}
            disabled={busy}
          />
          <ActionButton
            label="Clear Admin Token"
            onPress={handleClearAdminToken}
            disabled={busy}
            danger
          />
          <ActionButton label="Read Secure Key" onPress={handleReadSecureKey} disabled={busy} />
          <ActionButton label="Write Secure Key" onPress={handleWriteSecureKey} disabled={busy} />
          <ActionButton
            label="Delete Secure Key"
            onPress={handleDeleteSecureKey}
            disabled={busy}
            danger
          />
          <ActionButton
            label="☢️ NUKE ALL LOCAL DATA"
            onPress={handleNukeAllStorage}
            disabled={busy}
            danger
          />
        </Section>

        {/* ═══ REPAIR / RECONSTRUCT ═══ */}
        <Section title="🛠 Repair & Reconstruct">
          <ActionButton
            label="Verify Data Integrity"
            onPress={handleVerifyIntegrity}
            disabled={busy}
          />
          <ActionButton
            label="Reconcile Local ↔ Remote"
            onPress={handleReconcile}
            disabled={busy}
          />
          <ActionButton
            label="Full Resync (rebuild local DB)"
            onPress={handleFullResync}
            disabled={busy}
            danger
          />
        </Section>

        {/* ═══ SERVER DANGER ZONE ═══ */}
        <Section title="☠️ Server Danger Zone">
          <ActionButton
            label="Purge ALL Events & Announcements (server)"
            onPress={handlePurgeData}
            disabled={busy}
            danger
          />
        </Section>

        {/* ═══ DEVICE & APP INFO ═══ */}
        <Section title="📱 Device & App Info">
          <ActionButton label="Show Device Info" onPress={handleDeviceInfo} disabled={busy} />
          <ActionButton label="Show App Info" onPress={handleAppInfo} disabled={busy} />
          <ActionButton
            label="List All Secure Storage Keys"
            onPress={handleListAllSecureKeys}
            disabled={busy}
          />
        </Section>

        {/* ═══ EVENT MANAGEMENT ═══ */}
        <Section title="✏️ Event Management">
          <ActionButton
            label="Quick Create Test Event (today)"
            onPress={handleQuickCreateTestEvent}
            disabled={busy}
          />
          <ActionButton
            label="Create Custom Event"
            onPress={handleCreateCustomEvent}
            disabled={busy}
          />
          <ActionButton label="Update Event Field" onPress={handleUpdateEvent} disabled={busy} />
          <ActionButton
            label="Clone Event to New Date"
            onPress={handleCloneEvent}
            disabled={busy}
          />
          <ActionButton
            label="Batch Delete by Date Range"
            onPress={handleBatchDeleteRange}
            disabled={busy}
            danger
          />
        </Section>

        {/* ═══ SUBSCRIPTION & NETWORK ═══ */}
        <Section title="📡 Subscription & Network">
          <ActionButton
            label="Show OneSignal Subscription ID"
            onPress={handleShowSubscriptionId}
            disabled={busy}
          />
          <ActionButton label="Opt In to Push" onPress={handleOptInPush} disabled={busy} />
          <ActionButton
            label="Opt Out of Push (this device)"
            onPress={handleOptOutPush}
            disabled={busy}
            danger
          />
          <ActionButton
            label="Test All 3 Backends (latency)"
            onPress={handleTestAllBackends}
            disabled={busy}
          />
          <ActionButton
            label="Benchmark Backend (10 pings)"
            onPress={handleBenchmarkBackend}
            disabled={busy}
          />
        </Section>

        {/* ═══ CALENDAR DATA ═══ */}
        <Section title="📅 Calendar Data (GitHub)">
          <ActionButton
            label="Force Calendar Sync (GitHub)"
            onPress={handleForceCalendarSync}
            disabled={busy}
          />
          <ActionButton
            label="Force Store Sync (custom year)"
            onPress={handleForceSyncYear}
            disabled={busy}
          />
        </Section>

        {/* ═══ ANALYTICS ═══ */}
        <Section title="📊 Analytics & Stats">
          <ActionButton label="Event Count by Type" onPress={handleEventStats} disabled={busy} />
          <ActionButton
            label="Events per Month (current year)"
            onPress={handleEventsPerMonth}
            disabled={busy}
          />
          <ActionButton
            label="Sync Cursor Delta (local vs remote)"
            onPress={handleSyncCursorDelta}
            disabled={busy}
          />
        </Section>

        {/* ═══ RAW HTTP ═══ */}
        <Section title="🌐 Raw HTTP (Backend API)">
          <ActionButton
            label="Open Raw Request Editor"
            onPress={() => setRawModalVisible(true)}
            disabled={busy}
          />
        </Section>

        {/* ═══ TERMINAL ═══ */}
        <Section title="💻 Terminal">
          <ActionButton
            label="Open Backend Terminal"
            onPress={() => setTermVisible(true)}
            disabled={false}
          />
        </Section>

        {/* ═══ CONSOLE OUTPUT ═══ */}
        <View style={styles.divider} />
        <View style={styles.consoleHeaderRow}>
          <Text style={styles.consoleSectionLabel}>Console Output</Text>
          <View style={styles.consoleActions}>
            <Pressable onPress={copyLogs} style={styles.consoleMiniBtn}>
              <Text style={styles.consoleMiniBtnText}>Copy</Text>
            </Pressable>
            <Pressable onPress={clearLogs} style={styles.consoleMiniBtn}>
              <Text style={styles.consoleMiniBtnText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={logScrollRef}
          style={styles.logBox}
          nestedScrollEnabled
          contentContainerStyle={styles.logBoxContent}
        >
          {logs.length === 0 && (
            <Text style={styles.logEmpty}>No output yet. Tap an action above.</Text>
          )}
          {logs.map((entry, i) => (
            <Text
              key={`${entry.ts}-${i}`}
              style={[
                styles.logLine,
                entry.type === 'ok' && styles.logOk,
                entry.type === 'err' && styles.logErr,
                entry.type === 'data' && styles.logData,
              ]}
            >
              <Text style={styles.logTs}>[{entry.ts}] </Text>
              {entry.msg}
            </Text>
          ))}
        </ScrollView>
      </ScrollView>

      {/* ── Bottom: Lock button ── */}
      <View style={[styles.lockRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable
          style={({ pressed }) => [styles.lockBtn, pressed && styles.pressed]}
          onPress={handleLockAndHide}
        >
          <Text style={styles.lockBtnText}>🔒 Lock & Hide</Text>
        </Pressable>
      </View>

      {/* ═══ RAW HTTP MODAL ═══ */}
      <Modal visible={rawModalVisible} transparent statusBarTranslucent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setRawModalVisible(false)}>
          <KeyboardSafeView keyboardVerticalOffset={insets.top}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Raw HTTP Request</Text>
              <Text style={styles.modalSubtitle}>{configuredBaseUrl}</Text>

              <Text style={styles.modalFieldLabel}>Method</Text>
              <View style={styles.methodRow}>
                {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.methodChip, rawMethod === m && styles.methodChipActive]}
                    onPress={() => setRawMethod(m)}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        rawMethod === m && styles.methodChipTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.modalFieldLabel}>Path</Text>
              <TextInput
                style={styles.modalInput}
                value={rawPath}
                onChangeText={setRawPath}
                placeholder="/health"
                placeholderTextColor="#484f58"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.modalFieldLabel}>Body (JSON, for POST/PUT/PATCH)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMulti]}
                value={rawBody}
                onChangeText={setRawBody}
                placeholder='{"key": "value"}'
                placeholderTextColor="#484f58"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalButtonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnCancel,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setRawModalVisible(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnSend,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleRawRequest}
                >
                  <Text style={styles.modalBtnTextSend}>Send Request</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardSafeView>
        </Pressable>
      </Modal>

      {/* ═══ TERMINAL MODAL ═══ */}
      <Modal visible={termVisible} animationType="slide">
        <KeyboardSafeView
          style={[styles.termContainer, { paddingTop: insets.top }]}
          keyboardVerticalOffset={insets.top}
        >
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.termHeader}>
              <View style={styles.termHeaderLeft}>
                <Text style={styles.termTitle}>Terminal</Text>
                <View style={[styles.termEnvBadge, termEnv === 'prod' && styles.termEnvBadgeProd]}>
                  <Text style={styles.termEnvBadgeText}>{termEnv}</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.termCloseBtn, pressed && styles.pressed]}
                onPress={() => setTermVisible(false)}
              >
                <Text style={styles.termCloseBtnText}>✕ Close</Text>
              </Pressable>
            </View>

            {/* Env Switcher */}
            <View style={styles.termEnvRow}>
              {(['dev', 'staging', 'prod'] as const).map((env) => (
                <Pressable
                  key={env}
                  style={[styles.termEnvChip, termEnv === env && styles.termEnvChipActive]}
                  onPress={() => {
                    setTermEnv(env);
                    termLog(`Switched to ${env}: ${BACKEND_URLS[env]}`, 'ok');
                  }}
                >
                  <Text
                    style={[
                      styles.termEnvChipText,
                      termEnv === env && styles.termEnvChipTextActive,
                    ]}
                  >
                    {env}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Output */}
            <ScrollView
              ref={termScrollRef}
              style={styles.termOutput}
              contentContainerStyle={styles.termOutputContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {termLines.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.termLine,
                    line.type === 'cmd' && styles.termLineCmd,
                    line.type === 'ok' && styles.termLineOk,
                    line.type === 'err' && styles.termLineErr,
                    line.type === 'data' && styles.termLineData,
                  ]}
                >
                  {line.text}
                </Text>
              ))}
              {termBusy && <Text style={styles.termLineBusy}>Running…</Text>}
            </ScrollView>

            {/* Input */}
            <View
              style={[styles.termInputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
            >
              <Text style={styles.termPrompt}>$</Text>
              <TextInput
                style={styles.termInput}
                value={termInput}
                onChangeText={setTermInput}
                placeholder="Type a command…"
                placeholderTextColor="#484f58"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                editable={!termBusy}
                onSubmitEditing={handleTermSubmit}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.termSendBtn,
                  termBusy && styles.termSendBtnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleTermSubmit}
                disabled={termBusy}
              >
                <Text style={styles.termSendBtnText}>Run</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>

      <AnnouncementLogViewer
        visible={logViewerVisible}
        onClose={() => setLogViewerVisible(false)}
      />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════
//  ActionButton
// ═════════════════════════════════════════════════════════════════
function ActionButton({
  label,
  onPress,
  disabled,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        disabled && styles.actionBtnDisabled,
        danger && styles.actionBtnDanger,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.actionBtnText,
          disabled && styles.actionBtnTextDisabled,
          danger && styles.actionBtnTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ═════════════════════════════════════════════════════════════════
//  Styles
// ═════════════════════════════════════════════════════════════════
const makeStyles = (th: ResolvedTheme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: '#0d1117',
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    title: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xl,
      color: '#58a6ff',
    },
    backBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    backBtnText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: '#8b949e',
    },
    pressed: { opacity: 0.6 },

    // ── Main scroll ──
    mainScroll: { flex: 1 },
    mainContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

    // ── Sections ──
    section: { marginTop: spacing.sm },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    sectionChevron: {
      fontSize: 10,
      color: '#484f58',
      width: 18,
    },
    sectionLabel: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: '#8b949e',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionBody: { paddingLeft: 4, paddingTop: 2 },

    // ── Action buttons ──
    actionBtn: {
      backgroundColor: '#161b22',
      borderWidth: 1,
      borderColor: '#30363d',
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: 4,
    },
    actionBtnDisabled: { opacity: 0.35 },
    actionBtnDanger: { borderColor: '#da3633' },
    actionBtnText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: '#c9d1d9',
    },
    actionBtnTextDisabled: { color: '#484f58' },
    actionBtnTextDanger: { color: '#f85149' },

    // ── Divider ──
    divider: { height: 1, backgroundColor: '#21262d', marginVertical: spacing.md },

    // ── Console ──
    consoleHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    consoleSectionLabel: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xs,
      color: '#8b949e',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    consoleActions: { flexDirection: 'row', gap: spacing.xs },
    consoleMiniBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#30363d',
    },
    consoleMiniBtnText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: '#8b949e',
    },

    logBox: {
      maxHeight: 300,
      backgroundColor: '#010409',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: '#21262d',
    },
    logBoxContent: { padding: spacing.sm },
    logEmpty: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: '#484f58',
      fontStyle: 'italic',
    },
    logLine: {
      fontFamily: typography.family.body,
      fontSize: 11,
      color: '#c9d1d9',
      marginBottom: 1,
      lineHeight: 16,
    },
    logTs: { color: '#484f58' },
    logOk: { color: '#3fb950' },
    logErr: { color: '#f85149' },
    logData: { color: '#79c0ff' },

    // ── Lock row ──
    lockRow: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#21262d',
      backgroundColor: '#0d1117',
    },
    lockBtn: {
      backgroundColor: th.primaryDeep,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    lockBtnText: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: th.brandText,
    },

    // ── Raw HTTP modal ──
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: '#161b22',
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    modalTitle: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      color: '#c9d1d9',
      marginBottom: 2,
    },
    modalSubtitle: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: '#484f58',
      marginBottom: spacing.md,
    },
    modalFieldLabel: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xs,
      color: '#8b949e',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
      marginTop: spacing.sm,
    },
    methodRow: {
      flexDirection: 'row',
      gap: 6,
    },
    methodChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#30363d',
      backgroundColor: '#0d1117',
    },
    methodChipActive: {
      borderColor: '#58a6ff',
      backgroundColor: '#1f2937',
    },
    methodChipText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: '#8b949e',
    },
    methodChipTextActive: {
      color: '#58a6ff',
    },
    modalInput: {
      backgroundColor: '#0d1117',
      borderWidth: 1,
      borderColor: '#30363d',
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: '#c9d1d9',
    },
    modalInputMulti: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.md,
      alignItems: 'center',
    },
    modalBtnCancel: {
      borderWidth: 1,
      borderColor: '#30363d',
    },
    modalBtnSend: {
      backgroundColor: '#238636',
    },
    modalBtnText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.md,
      color: '#8b949e',
    },
    modalBtnTextSend: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: '#ffffff',
    },

    // ── Terminal ──
    termContainer: {
      flex: 1,
      backgroundColor: '#0d1117',
    },
    termHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#21262d',
    },
    termHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    termTitle: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      color: '#58a6ff',
    },
    termEnvBadge: {
      backgroundColor: '#1f6feb33',
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    termEnvBadgeProd: {
      backgroundColor: '#da363333',
    },
    termEnvBadgeText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: '#58a6ff',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    termCloseBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    termCloseBtnText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: '#8b949e',
    },
    termEnvRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: '#21262d',
    },
    termEnvChip: {
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#30363d',
    },
    termEnvChipActive: {
      borderColor: '#58a6ff',
      backgroundColor: '#1f2937',
    },
    termEnvChipText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: '#8b949e',
    },
    termEnvChipTextActive: {
      color: '#58a6ff',
    },
    termOutput: {
      flex: 1,
      backgroundColor: '#010409',
    },
    termOutputContent: {
      padding: spacing.sm,
    },
    termLine: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      color: '#c9d1d9',
      lineHeight: 18,
    },
    termLineCmd: {
      color: '#d2a8ff',
      fontWeight: '600' as const,
    },
    termLineOk: { color: '#3fb950' },
    termLineErr: { color: '#f85149' },
    termLineData: { color: '#79c0ff' },
    termLineBusy: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      color: '#e3b341',
      fontStyle: 'italic',
    },
    termInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#21262d',
      backgroundColor: '#0d1117',
      gap: 6,
    },
    termPrompt: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      color: '#3fb950',
      fontWeight: '700' as const,
    },
    termInput: {
      flex: 1,
      backgroundColor: '#010409',
      borderWidth: 1,
      borderColor: '#30363d',
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      color: '#c9d1d9',
    },
    termSendBtn: {
      backgroundColor: '#238636',
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    termSendBtnDisabled: {
      opacity: 0.4,
    },
    termSendBtnText: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: '#ffffff',
    },
  }) as const;
