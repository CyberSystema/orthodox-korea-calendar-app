import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ByzantineKnot } from '../../components/common/ByzantineKnot';
import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import { getEventById } from '../../features/calendar/calendarService';
import { localized } from '../../features/calendar/types';
import type { RootStackParamList } from '../../navigation/types';
import { fetchRemoteEventById } from '../../services/api/eventsRepository';
import { useAppStore } from '../../store/useAppStore';
import { colors, shadows } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatDisplayDate } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

export function EventDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { language } = useAppStore();
  const { eventId, dateISO } = route.params;
  const cachedEvent = getEventById(eventId);
  const [remoteEvent, setRemoteEvent] = useState(cachedEvent);
  const [isResolvingEvent, setIsResolvingEvent] = useState(!cachedEvent);

  useEffect(() => {
    let cancelled = false;

    if (cachedEvent) {
      setRemoteEvent(cachedEvent);
      setIsResolvingEvent(false);
      return () => {
        cancelled = true;
      };
    }

    setIsResolvingEvent(true);

    void fetchRemoteEventById(eventId)
      .then((fetchedEvent) => {
        if (!cancelled) {
          setRemoteEvent(fetchedEvent);
        }
      })
      .catch((error) => {
        console.warn('[EventDetail] failed to resolve event from notification:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingEvent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachedEvent, eventId]);

  const event = cachedEvent ?? remoteEvent;

  const eventDateISO = dateISO ?? event?.dateISO ?? '';

  const recurrenceLabel = (() => {
    const recurrence = event?.recurrence || 'none';
    return t(`month.recurrence.${recurrence}`);
  })();

  const recurrenceRule = (() => {
    const recurrence = event?.recurrence || 'none';
    return recurrence === 'none' ? '' : `RRULE:FREQ=${recurrence.toUpperCase()}`;
  })();

  const addDays = (value: string, days: number) => {
    return dayjs(value).add(days, 'day').format('YYYY-MM-DD');
  };

  const calendarDate = (value: string) => value.replaceAll('-', '');

  const openGoogleCalendar = async () => {
    if (!event) return;
    const start = calendarDate(eventDateISO);
    const end = calendarDate(addDays(eventDateISO, 1));
    const text = encodeURIComponent(localized(event.title, language));
    const details = encodeURIComponent(localized(event.details, language));
    const recurrence = recurrenceRule ? `&recur=${encodeURIComponent(recurrenceRule)}` : '';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${start}/${end}${recurrence}`;
    await Linking.openURL(url);
  };

  const openOutlook = async () => {
    if (!event) return;
    const title = encodeURIComponent(localized(event.title, language));
    const body = encodeURIComponent(localized(event.details, language));
    const startdt = encodeURIComponent(`${eventDateISO}T00:00:00Z`);
    const enddt = encodeURIComponent(`${eventDateISO}T23:59:00Z`);
    const recurrence = recurrenceRule ? `&recurrence=${encodeURIComponent(recurrenceRule.replace('RRULE:', ''))}` : '';
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&body=${body}&startdt=${startdt}&enddt=${enddt}${recurrence}`;
    await Linking.openURL(url);
  };

  const openAppleCalendar = async () => {
    if (!event) return;

    const escapeIcs = (value: string) =>
      value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Orthodox Korea//Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@orthodox-korea-calendar`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${calendarDate(eventDateISO)}`,
      `DTEND;VALUE=DATE:${calendarDate(addDays(eventDateISO, 1))}`,
      `SUMMARY:${escapeIcs(localized(event.title, language))}`,
      `DESCRIPTION:${escapeIcs(localized(event.details, language))}`,
      ...(recurrenceRule ? [recurrenceRule] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const uri = `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
    await Linking.openURL(uri);
  };

  if (!event && isResolvingEvent) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color={colors.accentBright} />
          <Text style={styles.emptyTitle}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('event.notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
    >
      <StatusBar style="light" />
      {/* ═══ EVENT HEADER CARD ═══ */}
      <View style={styles.headerCard}>
        <View style={styles.headerStrip}>
          <View style={styles.headerStripInner}>
            <View style={styles.stripLine} />
            <ByzantineKnot size={14} color={colors.accentBright} />
            <Text style={styles.stripLabel}>{t('event.title')}</Text>
            <ByzantineKnot size={14} color={colors.accentBright} />
            <View style={styles.stripLine} />
          </View>
        </View>
        <View style={styles.headerGoldLine} />
        <View style={styles.headerBody}>
          <Text style={styles.eventTitle}>{localized(event.title, language)}</Text>
          <Text style={styles.eventSummary}>{localized(event.summary, language)}</Text>
        </View>
      </View>

      {/* ═══ META INFO ═══ */}
      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('event.date')}</Text>
          <Text style={styles.metaValue}>{formatDisplayDate(dateISO ?? event.dateISO, language)}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('event.recurrence')}</Text>
          <Text style={styles.metaValue}>{recurrenceLabel}</Text>
        </View>
        {event.isAdminDraft ? (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('common.draft')}</Text>
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>{t('common.draft')}</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {/* ═══ DETAILS ═══ */}
      {localized(event.details, language).trim() ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsText}>{localized(event.details, language)}</Text>
        </View>
      ) : null}

      {/* ═══ CALENDAR EXPORT ═══ */}
      <View style={styles.actionsCard}>
        <OrnamentTitle text={t('event.addToCalendar')} />
        <View style={styles.actionsRow}>
          <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={openGoogleCalendar}>
            <Text style={styles.actionButtonText}>{t('event.googleCalendar')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={openAppleCalendar}>
            <Text style={styles.actionButtonText}>{t('event.appleCalendar')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={openOutlook}>
            <Text style={styles.actionButtonText}>{t('event.outlookCalendar')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },

  // ─── Empty state ───────────────────────────────────────────────────────────
  emptyCard: {
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.textSecondary,
  },

  // ─── Header card ───────────────────────────────────────────────────────────
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  headerStrip: {
    backgroundColor: colors.primaryDeep,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stripLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accentLine,
  },
  stripLabel: {
    color: colors.brandText,
    fontFamily: typography.family.heading,
    fontSize: typography.size.xxs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  headerGoldLine: {
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  headerBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eventTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.primary,
    lineHeight: 28,
  },
  eventSummary: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textBody,
    lineHeight: 22,
  },

  // ─── Meta card ─────────────────────────────────────────────────────────────
  metaCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWhite,
    padding: spacing.md,
    ...shadows.warm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  metaLabel: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  metaValue: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  draftBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  draftBadgeText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    color: colors.primaryDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Details card ──────────────────────────────────────────────────────────
  detailsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWhite,
    padding: spacing.lg,
    ...shadows.warm,
  },
  detailsText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textBody,
    lineHeight: 24,
  },

  // ─── Actions card ──────────────────────────────────────────────────────────
  actionsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWhite,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.warm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
});
