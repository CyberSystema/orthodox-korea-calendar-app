import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IlluminatedGround } from '../../components/common/IlluminatedGround';
import { Text } from '../../components/common/ScaledText';
import { DIAGNOSTICS_ENABLED, SECRET_MENU_ENABLED } from '../../config/features';
import {
  getCalendarDataVersion,
  getLastCalendarSyncAt,
  getLoadedCalendarYears,
} from '../../features/calendar/webCalendarSource';
import {
  useAnnouncementsStore,
  countUnread,
} from '../../features/announcements/useAnnouncementsStore';
import { useEventsStore } from '../../features/events/useEventsStore';
import { configuredBaseUrl, isApiConfigured } from '../../services/api/backendClient';
import { useAppStore } from '../../store/useAppStore';
import { useNetworkStore } from '../../store/useNetworkStore';
import { effectiveFontScale } from '../../theme/fontScale';
import { getAppVersionLabel } from '../../utils/appVersion';
import { USES_NATIVE_HEADER } from '../../navigation/nativeHeader';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * OWNER-ONLY diagnostics — everything the app knows about what it is doing.
 *
 * This is the deliberate opposite of the rest of the UI. Parishioners get a store
 * app with nothing technical in it at all; this screen exists so the owner's
 * sideload can answer "what is it actually doing right now" without a debugger
 * attached. `DIAGNOSTICS_ENABLED` folds to a literal at build time, so in a store
 * build this file's route is never registered and its code is dead.
 *
 * ENGLISH-ONLY on purpose, exactly like the admin console: these are technical
 * terms for one reader, and translating them would add noise to both locales for
 * no benefit.
 *
 * Values are READ-ONLY and computed on demand — nothing here changes app state,
 * so it is safe to open at any time. Pull the refresh button to re-read the
 * values that are not reactive (permissions, calendar cache).
 */
function formatTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * `runtimeVersion` is either a literal string or a policy object. Under the
 * `appVersion` policy the effective value IS the app version — which is what an
 * `eas update` has to match to reach this install, so show both.
 */
function describeRuntimeVersion(runtimeVersion: unknown, version: string | undefined): string {
  if (typeof runtimeVersion === 'string') return runtimeVersion;
  if (runtimeVersion && typeof runtimeVersion === 'object' && 'policy' in runtimeVersion) {
    const policy = String((runtimeVersion as { policy: unknown }).policy);
    return policy === 'appVersion' && version
      ? `${version}  (policy: appVersion)`
      : `policy: ${policy}`;
  }
  return '—';
}

function Row({ label, value }: { label: string; value: string }) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

export function DiagnosticsScreen() {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { fontScale: osScale } = useWindowDimensions();

  const appScale = useAppStore((s) => s.fontScale);
  const language = useAppStore((s) => s.language);
  const launchScreen = useAppStore((s) => s.launchScreen);
  const adminMode = useAppStore((s) => s.adminMode);
  const staffAuthed = useAppStore((s) => s.cloudflareAdminAuthenticated);
  const appHydrated = useAppStore((s) => s.isHydrated);

  const isOnline = useNetworkStore((s) => s.isOnline);

  const events = useEventsStore((s) => s.customEvents);
  const syncState = useEventsStore((s) => s.syncState);
  const syncError = useEventsStore((s) => s.syncError);
  const lastSyncedYear = useEventsStore((s) => s.lastSyncedYear);
  const lastSyncedAt = useEventsStore((s) => s.lastSyncedAt);
  const eventsHydrated = useEventsStore((s) => s.isHydrated);

  const announcements = useAnnouncementsStore((s) => s.announcements);
  const lastSeenId = useAnnouncementsStore((s) => s.lastSeenId);
  const unread = useAnnouncementsStore((s) => countUnread(s.announcements, s.lastSeenId));

  // Not reactive — re-read on mount and on demand.
  const [tick, setTick] = useState(0);
  const [permission, setPermission] = useState('…');
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    void Notifications.getPermissionsAsync().then((p) => {
      if (!alive) return;
      setPermission(`${p.status}${p.canAskAgain ? '' : ' (cannot ask again)'}`);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  const cfg = Constants.expoConfig;
  const loadedYears = getLoadedCalendarYears();

  return (
    <>
      {/* The leaf continues onto pushed screens. A Fragment sibling, not a
          child: these roots are ScrollViews, and a ground inside one would
          scroll away. absoluteFill then resolves against the navigator's own
          screen container, which fills the window. */}
      {th.direction === 'gilded' ? <IlluminatedGround crown={false} /> : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
        ]}
      >
        <StatusBar style="light" />

        <Pressable
          onPress={refresh}
          style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.refreshText}>{'Refresh'}</Text>
        </Pressable>

        <Section title={'Build'}>
          <Row label="version" value={getAppVersionLabel()} />
          {/* app.json sets this to a POLICY object ({ policy: 'appVersion' }), not a
              string, so String() alone renders "[object Object]". Show the policy and
              what it currently resolves to, which is the value an OTA must match. */}
          <Row
            label="runtimeVersion"
            value={describeRuntimeVersion(cfg?.runtimeVersion, cfg?.version)}
          />
          <Row label="sdkVersion" value={String(cfg?.sdkVersion ?? '—')} />
          <Row label="channel" value={String((Constants as { channel?: string }).channel ?? '—')} />
          <Row label="__DEV__" value={String(__DEV__)} />
          <Row label="secretMenu" value={String(SECRET_MENU_ENABLED)} />
          <Row label="diagnostics" value={String(DIAGNOSTICS_ENABLED)} />
        </Section>

        <Section title={'Backend'}>
          <Row label="apiConfigured" value={String(isApiConfigured)} />
          <Row label="baseUrl" value={configuredBaseUrl || '—'} />
          <Row label="apnsEnv" value={process.env.EXPO_PUBLIC_APNS_ENV ?? '—'} />
          <Row label="online" value={String(isOnline)} />
        </Section>

        <Section title={'Calendar data'}>
          <Row label="dataVersion" value={String(getCalendarDataVersion())} />
          <Row label="lastSync" value={formatTime(getLastCalendarSyncAt())} />
          <Row label="loadedYears" value={loadedYears.length ? loadedYears.join(', ') : '—'} />
          <Row
            label="sourceOverride"
            value={process.env.EXPO_PUBLIC_CALENDAR_DATA_BASE_URL ?? '(github default)'}
          />
        </Section>

        <Section title={'Events sync'}>
          <Row label="hydrated" value={String(eventsHydrated)} />
          <Row label="count" value={String(events.length)} />
          <Row label="syncState" value={syncState} />
          <Row label="lastSyncedYear" value={String(lastSyncedYear ?? '—')} />
          <Row label="lastSyncedAt" value={formatTime(lastSyncedAt)} />
          <Row label="syncError" value={syncError ?? '—'} />
        </Section>

        <Section title={'Announcements'}>
          <Row label="count" value={String(announcements.length)} />
          <Row label="unread" value={String(unread)} />
          <Row label="lastSeenId" value={String(lastSeenId)} />
        </Section>

        <Section title={'Notifications'}>
          <Row label="permission" value={permission} />
        </Section>

        <Section title={'Device'}>
          <Row label="platform" value={`${Platform.OS} ${String(Platform.Version)}`} />
          <Row label="model" value={Device.modelName ?? '—'} />
          <Row label="isPad" value={String(Platform.OS === 'ios' && Platform.isPad)} />
          <Row label="nativeHeader" value={String(USES_NATIVE_HEADER)} />
          <Row label="appHydrated" value={String(appHydrated)} />
        </Section>

        <Section title={'Preferences'}>
          <Row label="language" value={language} />
          <Row label="launchScreen" value={launchScreen} />
          <Row label="appScale" value={String(appScale)} />
          <Row label="osScale" value={String(osScale)} />
          <Row label="effective" value={effectiveFontScale(appScale, osScale).toFixed(2)} />
          <Row label="staffMode" value={`${adminMode} / authed ${staffAuthed}`} />
        </Section>
      </ScrollView>
    </>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: th.direction === 'gilded' ? 'transparent' : th.background,
      // Transparent under Illuminated: the ground is a sibling BEHIND this
      // scroll view, so an opaque background here would paint over the leaf.
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    pressed: { opacity: 0.7 },
    refresh: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: th.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    refreshText: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: th.accentText,
    },
    card: {
      borderWidth: 1,
      borderColor: th.border,
      backgroundColor: th.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTitle: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: th.accentText,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    rows: { gap: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    rowLabel: {
      flexBasis: '38%',
      flexGrow: 0,
      flexShrink: 0,
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.textSecondary,
    },
    rowValue: {
      flexShrink: 1,
      flexGrow: 1,
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.textBody,
    },
  }) as const;
