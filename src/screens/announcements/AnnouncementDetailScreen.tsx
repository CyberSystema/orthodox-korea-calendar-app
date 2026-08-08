import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IlluminatedGround } from '../../components/common/IlluminatedGround';
import { Text } from '../../components/common/ScaledText';
import {
  ensureLiturgicalYear,
  getEventById,
  getEventsByDate,
} from '../../features/calendar/calendarService';
import { fetchRemoteEventById } from '../../services/api/eventsRepository';
import { useAnnouncementsStore } from '../../features/announcements/useAnnouncementsStore';
import type { LiturgicalEvent, LocalizedText } from '../../features/calendar/types';
import { useAppStore } from '../../store/useAppStore';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatDisplayDate, formatRelativeTime } from '../../utils/date';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AnnouncementDetail'>;

function pickLocalized(text: LocalizedText, language: 'en' | 'ko'): string {
  const primary = language === 'ko' ? text.ko : text.en;
  const fallback = language === 'ko' ? text.en : text.ko;
  return (primary && primary.trim()) || (fallback && fallback.trim()) || '';
}

// event_id may be a bare UUID or an occurrence composite `parent::date`.
function resolveEventRef(eventId: string): { parentId: string; occurrenceDate?: string } {
  const idx = eventId.indexOf('::');
  if (idx === -1) return { parentId: eventId };
  const rest = eventId.slice(idx + 2);
  return {
    parentId: eventId.slice(0, idx),
    occurrenceDate: /^\d{4}-\d{2}-\d{2}$/.test(rest) ? rest : undefined,
  };
}

export function AnnouncementDetailScreen({ route, navigation }: Props) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { announcement } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const isStaff = useAppStore((state) => state.adminMode && state.cloudflareAdminAuthenticated);
  const deleteAnnouncement = useAnnouncementsStore((state) => state.deleteAnnouncement);

  const [resolving, setResolving] = useState<boolean>(!!announcement.eventId);
  const [dayEvents, setDayEvents] = useState<LiturgicalEvent[]>([]);
  const [linkedDateISO, setLinkedDateISO] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const title = pickLocalized(announcement.title, language);
  const body = pickLocalized(announcement.body, language);
  const audience =
    announcement.target === 'en'
      ? t('announcements.audienceEn')
      : announcement.target === 'ko'
        ? t('announcements.audienceKo')
        : null;

  useEffect(() => {
    let mounted = true;
    if (!announcement.eventId) {
      setResolving(false);
      return;
    }
    const { parentId, occurrenceDate } = resolveEventRef(announcement.eventId);

    void (async () => {
      let event = getEventById(announcement.eventId!) ?? getEventById(parentId);
      if (!event) {
        try {
          event = await fetchRemoteEventById(parentId);
        } catch {
          event = undefined;
        }
      }
      if (!mounted) return;

      const dateISO = occurrenceDate ?? event?.dateISO ?? null;
      if (dateISO) {
        await ensureLiturgicalYear(dayjs(dateISO).year());
        if (!mounted) return;
        setDayEvents(getEventsByDate(dateISO, false));
        setLinkedDateISO(dateISO);
      }
      setResolving(false);
    })();

    return () => {
      mounted = false;
    };
  }, [announcement.eventId]);

  const openEvent = useCallback(
    (event: LiturgicalEvent) => {
      navigation.navigate('EventDetail', { eventId: event.id, dateISO: event.dateISO });
    },
    [navigation],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert(t('announcements.deleteTitle'), t('announcements.deleteConfirm'), [
      { text: t('today.cancel'), style: 'cancel' },
      {
        text: t('announcements.deleteAction'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void deleteAnnouncement(announcement.id)
            .then(() => navigation.goBack())
            .catch((error) => {
              setDeleting(false);
              Alert.alert(t('announcements.deleteFailedTitle'), String(error?.message ?? error));
            });
        },
      },
    ]);
  }, [announcement.id, deleteAnnouncement, navigation, t]);

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
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
        ]}
      >
        {/* ═══ ANNOUNCEMENT CARD ═══ */}
        <View style={styles.card}>
          <View style={styles.topRow}>
            {audience ? (
              <View style={styles.audienceChip}>
                <Text style={styles.audienceChipText}>{audience}</Text>
              </View>
            ) : (
              <View style={styles.noticeChip}>
                <Text style={styles.noticeChipText}>{t('announcements.noticeLabel')}</Text>
              </View>
            )}
            <Text style={styles.timeText}>{formatRelativeTime(announcement.sentAt, language)}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.dateText}>
            {formatDisplayDate(dayjs(announcement.sentAt * 1000).format('YYYY-MM-DD'), language)}
          </Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>

        {/* ═══ LINKED DAY EVENTS ═══ */}
        {announcement.eventId ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('announcements.linkedEvents')}</Text>
            {resolving ? (
              <Text style={styles.mutedText}>{t('common.loading')}</Text>
            ) : dayEvents.length > 0 ? (
              <>
                {linkedDateISO ? (
                  <Text style={styles.linkedDate}>
                    {formatDisplayDate(linkedDateISO, language)}
                  </Text>
                ) : null}
                {dayEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
                    onPress={() => openEvent(event)}
                    accessibilityRole="button"
                    accessibilityLabel={pickLocalized(event.title, language)}
                  >
                    <Text style={styles.eventTitle}>{pickLocalized(event.title, language)}</Text>
                    <Text style={styles.eventOpen}>{t('announcements.viewEvent')} ›</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <Text style={styles.mutedText}>{t('announcements.eventUnavailable')}</Text>
            )}
          </View>
        ) : null}

        {/* ═══ STAFF DELETE ═══ */}
        {isStaff ? (
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
              deleting && styles.deleteButtonDisabled,
            ]}
            onPress={confirmDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={t('announcements.deleteAction')}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? t('common.loading') : t('announcements.deleteAction')}
            </Text>
          </Pressable>
        ) : null}
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
    pressed: {
      opacity: 0.7,
    },

    card: {
      borderWidth: 1,
      borderColor: th.borderLight,
      borderRadius: radii.lg,
      backgroundColor: th.surfaceWhite,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    audienceChip: {
      borderWidth: 1,
      borderColor: th.accentDim,
      borderRadius: th.design.controlRadius,
      backgroundColor: th.accentGlow,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    audienceChipText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xxs,
      color: th.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    noticeChip: {
      borderWidth: 1,
      borderColor: th.borderLight,
      borderRadius: th.design.controlRadius,
      backgroundColor: th.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    noticeChipText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xxs,
      color: th.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    timeText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.textSecondary,
    },
    title: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xl,
      color: th.textPrimary,
      lineHeight: typography.size.xl * 1.3,
    },
    dateText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.textFaint,
    },
    body: {
      fontFamily: typography.family.body,
      fontSize: typography.size.md,
      color: th.textBody,
      lineHeight: typography.size.md * 1.55,
      marginTop: spacing.xs,
    },

    section: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xxs,
      color: th.accentText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginLeft: spacing.xs,
    },
    linkedDate: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: th.textSoft,
      marginLeft: spacing.xs,
    },
    eventCard: {
      borderWidth: 1,
      borderColor: th.borderLight,
      borderRadius: radii.md,
      backgroundColor: th.surfaceWhite,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    eventTitle: {
      flex: 1,
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: th.textPrimary,
    },
    eventOpen: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.primary,
      fontWeight: typography.weight.semibold,
    },
    mutedText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textFaint,
      marginLeft: spacing.xs,
    },

    deleteButton: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: th.danger,
      borderRadius: th.design.controlRadius,
      backgroundColor: th.crimsonTint,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.danger,
      fontWeight: typography.weight.bold,
    },
  }) as const;
