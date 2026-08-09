import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabContentBottomPadding } from '../../hooks/useTabContentBottomPadding';
import { USES_NATIVE_HEADER } from '../../navigation/nativeHeader';
import Svg, { Path } from 'react-native-svg';

import { IlluminatedGround } from '../../components/common/IlluminatedGround';
import { ByzantineKnot } from '../../components/common/ByzantineKnot';
import { IlluminatedHeader } from '../../components/common/IlluminatedHeader';
import { Text } from '../../components/common/ScaledText';
import { useAnnouncementsStore } from '../../features/announcements/useAnnouncementsStore';
import type { Announcement } from '../../services/api/announcementsRepository';
import type { LocalizedText } from '../../features/calendar/types';
import { useAppStore } from '../../store/useAppStore';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatRelativeTime } from '../../utils/date';
import type { MainTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Announcements'>,
  NativeStackScreenProps<RootStackParamList>
>;

function BellIcon({ size = 20, color }: { size?: number; color?: string }) {
  const th = useTheme();
  color = color ?? th.brandText;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c-3.31 0-6 2.69-6 6v3.5l-1.5 3h15l-1.5-3V9c0-3.31-2.69-6-6-6z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function pickLocalized(text: LocalizedText, language: 'en' | 'ko'): string {
  const primary = language === 'ko' ? text.ko : text.en;
  const fallback = language === 'ko' ? text.en : text.ko;
  return (primary && primary.trim()) || (fallback && fallback.trim()) || '';
}

export function AnnouncementsScreen({ navigation }: Props) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = useTabContentBottomPadding();
  const language = useAppStore((state) => state.language);
  const isStaff = useAppStore((state) => state.adminMode && state.cloudflareAdminAuthenticated);

  const announcements = useAnnouncementsStore((state) => state.announcements);
  const loadState = useAnnouncementsStore((state) => state.loadState);
  const loadError = useAnnouncementsStore((state) => state.loadError);
  const refresh = useAnnouncementsStore((state) => state.refresh);
  const markAllSeen = useAnnouncementsStore((state) => state.markAllSeen);
  const deleteAnnouncement = useAnnouncementsStore((state) => state.deleteAnnouncement);

  const [refreshing, setRefreshing] = useState(false);
  // Snapshot of what counted as "seen" when this screen was focused, so items that
  // are new THIS visit keep their unread accent while the tab badge clears.
  const [viewedThreshold, setViewedThreshold] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setViewedThreshold(useAnnouncementsStore.getState().lastSeenId);
      void refresh();
      // Clear the unread badge once the user has actually dwelled on the feed.
      const timer = setTimeout(() => {
        void markAllSeen();
      }, 1500);
      return () => clearTimeout(timer);
    }, [refresh, markAllSeen]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const audienceLabel = (target: Announcement['target']): string | null => {
    if (target === 'en') return t('announcements.audienceEn');
    if (target === 'ko') return t('announcements.audienceKo');
    return null;
  };

  const confirmDelete = useCallback(
    (item: Announcement, swipeable?: SwipeableMethods) => {
      Alert.alert(t('announcements.deleteTitle'), t('announcements.deleteConfirm'), [
        { text: t('today.cancel'), style: 'cancel', onPress: () => swipeable?.close() },
        {
          text: t('announcements.deleteAction'),
          style: 'destructive',
          onPress: () => {
            void deleteAnnouncement(item.id).catch((error) => {
              swipeable?.close();
              Alert.alert(t('announcements.deleteFailedTitle'), String(error?.message ?? error));
            });
          },
        },
      ]);
    },
    [deleteAnnouncement, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: Announcement }) => {
      const title = pickLocalized(item.title, language);
      const body = pickLocalized(item.body, language);
      const isUnread = item.id > viewedThreshold;
      const audience = audienceLabel(item.target);
      const hasEvent = !!item.eventId;

      const card = (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            isUnread && styles.cardUnread,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.navigate('AnnouncementDetail', { announcement: item })}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${t('announcements.viewDetails')}`}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardTopLeft}>
              {isUnread ? <View style={styles.unreadDot} /> : null}
              {audience ? (
                <View style={styles.audienceChip}>
                  <Text style={styles.audienceChipText}>{audience}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timeText}>{formatRelativeTime(item.sentAt, language)}</Text>
          </View>

          <Text style={styles.cardTitle}>{title}</Text>
          {body ? (
            <Text style={styles.cardBody} numberOfLines={3}>
              {body}
            </Text>
          ) : null}

          <View style={styles.cardFooter}>
            <Text style={styles.viewEventText}>
              {hasEvent ? t('announcements.viewEvent') : t('announcements.viewDetails')}
            </Text>
            <Text style={styles.viewEventArrow}>›</Text>
          </View>
        </Pressable>
      );

      // Staff can swipe a row left to reveal a Delete action (with confirmation).
      if (!isStaff) {
        return card;
      }
      return (
        <ReanimatedSwipeable
          friction={2}
          rightThreshold={40}
          renderRightActions={(_progress, _translation, swipeable) => (
            <Pressable
              style={styles.swipeDelete}
              onPress={() => confirmDelete(item, swipeable)}
              accessibilityRole="button"
              accessibilityLabel={t('announcements.deleteAction')}
            >
              <Text style={styles.swipeDeleteText}>{t('announcements.deleteAction')}</Text>
            </Pressable>
          )}
        >
          {card}
        </ReanimatedSwipeable>
      );
    },
    [language, viewedThreshold, navigation, t, isStaff, confirmDelete],
  );

  const showEmpty = announcements.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* ONE ground for the whole screen — see IlluminatedGround. Must come
          first so the headpiece and the page both sit on it. */}
      {th.direction === 'gilded' ? <IlluminatedGround crown={!USES_NATIVE_HEADER} /> : null}
      {/* ═══ BRANDED HEADER ═══
          Skipped on iPad, where the platform's header shows this same title. */}
      {USES_NATIVE_HEADER ? null : th.direction === 'gilded' ? (
        /* No brand tap and no buttons here — this screen's title is the section
           name, not the brand, so the secret-menu counter does not belong. */
        <IlluminatedHeader title={t('announcements.title')} topInset={insets.top} />
      ) : (
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerLine} />
            <ByzantineKnot size={14} color={th.accentBright} />
            <Text style={styles.headerBrand}>{t('announcements.title')}</Text>
            <ByzantineKnot size={14} color={th.accentBright} />
            <View style={styles.headerLine} />
          </View>
          <View style={styles.headerGoldLine} />
        </View>
      )}

      <FlatList
        showsVerticalScrollIndicator={false}
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        // See TodayScreen: the native toolbar does not take layout space, so
        // this screen reserves it itself. See useTabContentBottomPadding.
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBottomPadding },
          showEmpty && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={th.accent}
            colors={[th.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <BellIcon size={40} color={th.textGhost} />
            {loadState === 'loading' ? (
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            ) : loadState === 'error' ? (
              <>
                <Text style={styles.emptyText}>{t('announcements.loadError')}</Text>
                {loadError ? <Text style={styles.emptyHint}>{loadError}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                  onPress={() => void onRefresh()}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryButtonText}>{t('announcements.retry')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>{t('announcements.empty')}</Text>
                <Text style={styles.emptyHint}>{t('announcements.emptyHint')}</Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: th.background,
    },
    pressed: {
      opacity: 0.7,
    },

    // ─── Branded header ────────────────────────────────────────────────────────
    header: {
      backgroundColor: th.primaryDeep,
      paddingBottom: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    headerLine: {
      flex: 1,
      height: 1,
      backgroundColor: th.accentLine,
    },
    headerBrand: {
      color: th.brandText,
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      letterSpacing: 0.8,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
      // Sits between two fixed ornaments — wrap rather than push them off-row.
      flexShrink: 1,
    },
    headerGoldLine: {
      height: 2,
      backgroundColor: th.accent,
      opacity: 0.7,
    },

    // ─── List ──────────────────────────────────────────────────────────────────
    listContent: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },

    // ─── Card ──────────────────────────────────────────────────────────────────
    card: {
      borderWidth: 1,
      borderColor: th.borderLight,
      borderRadius: radii.lg,
      backgroundColor: th.surfaceWhite,
      padding: spacing.md,
      gap: spacing.xs,
    },
    cardUnread: {
      borderColor: th.accent,
      backgroundColor: th.surface,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardTopLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 1,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: radii.full,
      backgroundColor: th.accent,
    },
    audienceChip: {
      borderWidth: 1,
      borderColor: th.accentDim,
      borderRadius: radii.full,
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
    timeText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.textSecondary,
    },
    cardTitle: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      color: th.textPrimary,
      lineHeight: typography.size.lg * 1.35,
    },
    cardBody: {
      fontFamily: typography.family.body,
      fontSize: typography.size.md,
      color: th.textBody,
      lineHeight: typography.size.md * 1.5,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    viewEventText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.primary,
      fontWeight: typography.weight.semibold,
    },
    viewEventArrow: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      color: th.accentText,
      marginTop: -2,
    },

    // ─── Swipe-to-delete (staff) ───────────────────────────────────────────────
    swipeDelete: {
      backgroundColor: th.danger,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radii.lg,
      marginLeft: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    swipeDeleteText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      color: th.surfaceWhite,
    },

    // ─── Empty / loading / error ───────────────────────────────────────────────
    emptyWrap: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.lg,
      color: th.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    emptyHint: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textFaint,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: th.accent,
      borderRadius: radii.full,
      backgroundColor: th.accentGlow,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    retryButtonText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.onAccent,
      fontWeight: typography.weight.semibold,
    },
  }) as const;
