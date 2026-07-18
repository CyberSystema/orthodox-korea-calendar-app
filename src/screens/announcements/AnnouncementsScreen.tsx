import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ByzantineKnot } from '../../components/common/ByzantineKnot';
import {
  useAnnouncementsStore,
} from '../../features/announcements/useAnnouncementsStore';
import type { Announcement } from '../../services/api/announcementsRepository';
import type { LocalizedText } from '../../features/calendar/types';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatRelativeTime } from '../../utils/date';
import type { MainTabsParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Announcements'>,
  NativeStackScreenProps<RootStackParamList>
>;

function BellIcon({ size = 20, color = colors.brandText }: { size?: number; color?: string }) {
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);

  const announcements = useAnnouncementsStore((state) => state.announcements);
  const loadState = useAnnouncementsStore((state) => state.loadState);
  const loadError = useAnnouncementsStore((state) => state.loadError);
  const refresh = useAnnouncementsStore((state) => state.refresh);
  const markAllSeen = useAnnouncementsStore((state) => state.markAllSeen);

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

  const renderItem = useCallback(
    ({ item }: { item: Announcement }) => {
      const title = pickLocalized(item.title, language);
      const body = pickLocalized(item.body, language);
      const isUnread = item.id > viewedThreshold;
      const audience = audienceLabel(item.target);
      const hasEvent = !!item.eventId;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            isUnread && styles.cardUnread,
            pressed && hasEvent && styles.pressed,
          ]}
          disabled={!hasEvent}
          onPress={() => {
            if (item.eventId) {
              navigation.navigate('EventDetail', { eventId: item.eventId });
            }
          }}
          accessibilityRole={hasEvent ? 'button' : 'text'}
          accessibilityLabel={hasEvent ? `${title}. ${t('announcements.viewEvent')}` : title}
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
          {body ? <Text style={styles.cardBody}>{body}</Text> : null}

          {hasEvent ? (
            <View style={styles.cardFooter}>
              <Text style={styles.viewEventText}>{t('announcements.viewEvent')}</Text>
              <Text style={styles.viewEventArrow}>›</Text>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [language, viewedThreshold, navigation, t],
  );

  const showEmpty = announcements.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* ═══ BRANDED HEADER ═══ */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          <ByzantineKnot size={14} color={colors.accentBright} />
          <Text style={styles.headerBrand}>{t('announcements.title')}</Text>
          <ByzantineKnot size={14} color={colors.accentBright} />
          <View style={styles.headerLine} />
        </View>
        <View style={styles.headerGoldLine} />
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
          showEmpty && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <BellIcon size={40} color={colors.textGhost} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.7,
  },

  // ─── Branded header ────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primaryDeep,
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
    backgroundColor: colors.accentLine,
  },
  headerBrand: {
    color: colors.brandText,
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    letterSpacing: 0.8,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerGoldLine: {
    height: 2,
    backgroundColor: colors.accent,
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
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWhite,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardUnread: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.accent,
  },
  audienceChip: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  audienceChipText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  cardTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
    lineHeight: typography.size.lg * 1.35,
  },
  cardBody: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textBody,
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
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  viewEventArrow: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.accent,
    marginTop: -2,
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
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textFaint,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
});
