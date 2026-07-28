import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { SECRET_MENU_ENABLED } from '../../config/features';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { ByzantineArrow } from '../../components/common/ByzantineArrow';
import { ByzantineKnot } from '../../components/common/ByzantineKnot';
import { KeyboardSafeView } from '../../components/common/KeyboardSafeView';
import { LiturgicalDayPanel } from '../../components/common/LiturgicalDayPanel';
import { PromptModal } from '../../components/common/PromptModal';
import { Text, TextInput } from '../../components/common/ScaledText';
import {
  ensureLiturgicalYear,
  getEventOccurrenceCountsForMonth,
  getEventsByDate,
  getLiturgicalDayByDate,
  searchLiturgicalContent,
  type LiturgicalSearchResult,
} from '../../features/calendar/calendarService';
import { useCalendarDataVersion } from '../../features/calendar/useCalendarDataVersion';
import { getDayEmphasis, type DayEmphasis } from '../../features/calendar/dayEmphasis';
import {
  localized,
  type EventRecurrence,
  type LiturgicalEvent,
} from '../../features/calendar/types';
import { useEventsStore } from '../../features/events/useEventsStore';
import type { MainTabsParamList, RootStackParamList } from '../../navigation/types';
import { loginAdminThroughCloudflare } from '../../services/api/adminAuth';
import { useAppStore } from '../../store/useAppStore';
import { useNetworkStore } from '../../store/useNetworkStore';
import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatDisplayDate } from '../../utils/date';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Month'>,
  NativeStackScreenProps<RootStackParamList>
>;

function MenuIcon({ size = 20, color = colors.brandText }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function SearchSvgIcon({ size = 20, color = colors.brandText }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const fallbackWeekHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function createMonthCells(cursor: dayjs.Dayjs): Array<number | null> {
  const startOfMonth = cursor.startOf('month');
  const endOfMonth = cursor.endOf('month');
  const leading = startOfMonth.day();
  const totalDays = endOfMonth.date();

  const result: Array<number | null> = [];
  for (let i = 0; i < leading; i += 1) {
    result.push(null);
  }
  for (let d = 1; d <= totalDays; d += 1) {
    result.push(d);
  }
  while (result.length % 7 !== 0) {
    result.push(null);
  }

  return result;
}

export function MonthScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // The search modal is top-anchored at (insets.top + 28) — a comfortable gap below the
  // notch — and capped to the band above the keyboard, so the WHOLE card is always on
  // screen (28 below the notch, 16 above the keyboard) no matter how long the list is.
  const searchCardMaxHeight =
    WINDOW_HEIGHT - insets.top - 28 - Math.max(keyboardHeight, insets.bottom) - 16;
  const {
    language,
    adminMode,
    selectedDateISO,
    setSelectedDateISO,
    setSecretMenuUnlocked,
    setCloudflareAdminAuthenticated,
  } = useAppStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const addEvent = useEventsStore((state) => state.addEvent);
  const updateEvent = useEventsStore((state) => state.updateEvent);
  const deleteEvent = useEventsStore((state) => state.deleteEvent);
  const syncYearEvents = useEventsStore((state) => state.syncYearEvents);
  const syncState = useEventsStore((state) => state.syncState);
  const syncError = useEventsStore((state) => state.syncError);
  const customEvents = useEventsStore((state) => state.customEvents);

  const initial =
    route.params?.year && route.params?.month
      ? dayjs(`${route.params.year}-${route.params.month}-01`)
      : dayjs();
  const [cursor, setCursor] = useState(initial.startOf('month'));
  const todayISO = dayjs().format('YYYY-MM-DD');
  const [yearReady, setYearReady] = useState(true);
  // Repaints automatically when a background GitHub sync brings in newer calendar JSON.
  const dataVersion = useCalendarDataVersion();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<LiturgicalSearchResult[]>([]);
  const searchRequestIdRef = useRef(0);

  // Secret menu: 7 rapid taps on brand text
  const [adminPromptVisible, setAdminPromptVisible] = useState(false);
  const secretTapRef = useRef({ count: 0, lastTap: 0 });
  const handleBrandTap = useCallback(() => {
    // Owner-only: disabled (no-op) in all EAS/store builds; on only in local sideloads.
    if (!SECRET_MENU_ENABLED) return;
    const now = Date.now();
    const ref = secretTapRef.current;
    if (now - ref.lastTap > 1200) ref.count = 0;
    ref.count += 1;
    ref.lastTap = now;
    if (ref.count >= 7) {
      ref.count = 0;
      setAdminPromptVisible(true);
    }
  }, []);
  const submitAdminPassword = useCallback(
    async (password: string) => {
      setAdminPromptVisible(false);
      if (!password) return;
      const result = await loginAdminThroughCloudflare(password);
      if (result.ok) {
        setCloudflareAdminAuthenticated(true);
        setSecretMenuUnlocked(true);
        navigation.navigate('SecretMenu');
      } else {
        Alert.alert(t('secret.accessDeniedTitle'), result.message || t('secret.invalidPasscode'));
      }
    },
    [navigation, setCloudflareAdminAuthenticated, setSecretMenuUnlocked, t],
  );

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalYear, setEditingOriginalYear] = useState<number | undefined>(undefined);
  const [formDateISO, setFormDateISO] = useState(todayISO);
  const [formDatePickerOpen, setFormDatePickerOpen] = useState(false);
  const formDateParsed = dayjs(formDateISO);
  const formDateYear = formDateParsed.isValid() ? formDateParsed.year() : dayjs().year();
  const formDateMonth = formDateParsed.isValid() ? formDateParsed.month() + 1 : dayjs().month() + 1;
  const formDateDay = formDateParsed.isValid() ? formDateParsed.date() : dayjs().date();

  const setFormDatePart = (part: 'year' | 'month' | 'day', delta: number) => {
    const d = dayjs(formDateISO);
    let next = d.isValid() ? d : dayjs();
    if (part === 'year') next = next.add(delta, 'year');
    else if (part === 'month') next = next.add(delta, 'month');
    else next = next.add(delta, 'day');
    setFormDateISO(next.format('YYYY-MM-DD'));
  };
  const [titleEn, setTitleEn] = useState('');
  const [titleKo, setTitleKo] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [summaryKo, setSummaryKo] = useState('');
  const [detailsEn, setDetailsEn] = useState('');
  const [detailsKo, setDetailsKo] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<EventRecurrence>('none');
  const [formNotify, setFormNotify] = useState(true);

  const weekHeaders = t('month.weekdays', { returnObjects: true });
  const weekLabels = Array.isArray(weekHeaders) ? weekHeaders : fallbackWeekHeaders;

  const monthPrefix = cursor.format('YYYY-MM');
  const defaultMonthDateISO = todayISO.startsWith(monthPrefix) ? todayISO : `${monthPrefix}-01`;
  const activeDateISO = selectedDateISO?.startsWith(monthPrefix)
    ? selectedDateISO
    : defaultMonthDateISO;

  const cells = useMemo(() => createMonthCells(cursor), [cursor]);
  const monthEventCounts = useMemo(
    () => getEventOccurrenceCountsForMonth(cursor.year(), cursor.month() + 1, adminMode),
    // customEvents drives rebuildEventIndexes; dataVersion is unrelated here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor, adminMode, customEvents],
  );

  type CellData = {
    day: number;
    dateISO: string;
    eventCount: number;
    isSunday: boolean;
    hasHighRank: boolean;
    hasFeast: boolean;
    hasFast: boolean;
    hasLiturgy: boolean;
    /** Shared Sunday-red / Saturday-blue colour code — see dayEmphasis.ts. */
    emphasis: DayEmphasis;
  };

  const cellDataMap = useMemo(() => {
    const map = new Map<number, CellData>();
    const todayCursor = cursor;
    for (const day of cells) {
      if (day == null) continue;
      const dateISO = todayCursor.date(day).format('YYYY-MM-DD');
      const eventCount = monthEventCounts.get(dateISO) || 0;
      const dayData = getLiturgicalDayByDate(dateISO);
      const dayOfWeek = todayCursor.date(day).day();
      const isSunday = dayOfWeek === 0;
      const hasHighRank = Boolean(dayData?.celebrations?.some((entry) => entry.highRank));
      const hasFeast = Boolean(dayData?.celebrations?.some((entry) => entry.celeb));
      const emphasis = getDayEmphasis({ dayOfWeek, hasHighRank, hasCelebration: hasFeast });
      const hasFast = Boolean(dayData?.fast);
      const hasLiturgy = Boolean(
        dayData?.divineLiturgy || dayData?.saintBasil || dayData?.presanctified,
      );
      map.set(day, {
        day,
        dateISO,
        eventCount,
        isSunday,
        hasHighRank,
        hasFeast,
        hasFast,
        hasLiturgy,
        emphasis,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, monthEventCounts, dataVersion]);

  const selectedEvents = useMemo(
    () => getEventsByDate(activeDateISO, adminMode),
    [activeDateISO, adminMode, customEvents],
  );
  const selectedLiturgicalDay = useMemo(
    () => getLiturgicalDayByDate(activeDateISO),
    [activeDateISO, dataVersion],
  );

  useEffect(() => {
    setSelectedDateISO(activeDateISO);
  }, [activeDateISO, setSelectedDateISO]);

  useEffect(() => {
    let mounted = true;
    const year = cursor.year();
    void ensureLiturgicalYear(year).then((ok) => {
      if (mounted) {
        setYearReady(ok);
      }
    });
    void syncYearEvents(year);

    return () => {
      mounted = false;
    };
  }, [cursor, syncYearEvents]);

  const goPrev = () => setCursor((prev) => prev.subtract(1, 'month').startOf('month'));
  const goNext = () => setCursor((prev) => prev.add(1, 'month').startOf('month'));

  // ─── Search logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchVisible) return;

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearchBusy(true);

    const timer = setTimeout(() => {
      const year = cursor.year();
      void searchLiturgicalContent(q, language, [year - 1, year, year + 1]).then((results) => {
        if (searchRequestIdRef.current === requestId) {
          setSearchResults(results);
          setSearchBusy(false);
        }
      });
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, searchVisible, language, cursor]);

  const openSearch = () => {
    setSearchVisible(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openSearchResult = (result: LiturgicalSearchResult) => {
    const resultDate = dayjs(result.dateISO);
    setCursor(resultDate.startOf('month'));
    setSelectedDateISO(result.dateISO);
    setSearchVisible(false);
  };

  const searchKindLabel = (kind: LiturgicalSearchResult['kind']) => {
    if (kind === 'celebration') return t('common.celebrations');
    if (kind === 'saint') return t('common.saints');
    return t('common.readings');
  };

  const pickDate = (day: number) => {
    const picked = cursor.date(day).format('YYYY-MM-DD');
    setSelectedDateISO(picked);
  };

  const goToday = () => {
    const today = dayjs();
    setCursor(today.startOf('month'));
    setSelectedDateISO(today.format('YYYY-MM-DD'));
  };

  const openCreateEditor = () => {
    setEditingId(null);
    setEditingOriginalYear(undefined);
    setFormDateISO(activeDateISO);
    setTitleEn('');
    setTitleKo('');
    setSummaryEn('');
    setSummaryKo('');
    setDetailsEn('');
    setDetailsKo('');
    setFormRecurrence('none');
    setFormNotify(true);
    setEditorVisible(true);
  };

  const openEditEditor = (event: LiturgicalEvent) => {
    setEditingId(event.id);
    setEditingOriginalYear(
      Number.parseInt((event.seriesStartDate || event.dateISO).slice(0, 4), 10),
    );
    setFormDateISO(event.seriesStartDate || event.dateISO);
    setTitleEn(event.title.en);
    setTitleKo(event.title.ko);
    setSummaryEn(event.summary.en);
    setSummaryKo(event.summary.ko);
    setDetailsEn(event.details.en);
    setDetailsKo(event.details.ko);
    setFormRecurrence(event.recurrence || 'none');
    setFormNotify(Boolean(event.notify));
    setEditorVisible(true);
  };

  const onSaveEditor = async () => {
    const normalizedDate = formDateISO.trim();
    const parsedDate = dayjs(normalizedDate);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ||
      !parsedDate.isValid() ||
      parsedDate.format('YYYY-MM-DD') !== normalizedDate
    ) {
      Alert.alert(t('month.eventDate'), t('today.invalidDate'));
      return;
    }

    if (!titleEn.trim() && !titleKo.trim()) {
      Alert.alert(t('month.eventTitleRequiredTitle'), t('month.eventTitleRequiredOneLanguage'));
      return;
    }

    const payload = {
      id: editingId ?? undefined,
      originalYear: editingOriginalYear,
      dateISO: normalizedDate,
      title: {
        en: titleEn.trim() || titleKo.trim(),
        ko: titleKo.trim() || titleEn.trim(),
      },
      summary: {
        en: summaryEn.trim() || detailsEn.trim() || titleEn.trim() || titleKo.trim(),
        ko: summaryKo.trim() || detailsKo.trim() || titleKo.trim() || titleEn.trim(),
      },
      details: {
        en: detailsEn.trim() || summaryEn.trim() || titleEn.trim() || titleKo.trim(),
        ko: detailsKo.trim() || summaryKo.trim() || titleKo.trim() || titleEn.trim(),
      },
      recurrence: formRecurrence,
      notify: formNotify,
      notificationTarget: formNotify ? ('all' as const) : undefined,
    };

    try {
      if (editingId) {
        await updateEvent(payload);
      } else {
        await addEvent(payload);
      }
      setEditorVisible(false);
    } catch (error) {
      Alert.alert(
        t('month.eventSaveError'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const onDeleteEvent = (event: LiturgicalEvent) => {
    Alert.alert(t('month.deleteEventTitle'), t('month.deleteEventConfirm'), [
      { text: t('today.cancel'), style: 'cancel' },
      {
        text: t('month.deleteEvent'),
        style: 'destructive',
        onPress: () => {
          void deleteEvent(event.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* ═══ BRANDED HEADER (fixed) ═══ */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openSettings')}
          >
            <MenuIcon size={20} color={colors.brandText} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.headerLine} />
            <ByzantineKnot size={14} color={colors.accentBright} />
            <Pressable
              style={styles.headerBrandPress}
              onPress={handleBrandTap}
              hitSlop={4}
              accessibilityRole="header"
              accessibilityLabel={t('a11y.brandTitle')}
            >
              <Text style={styles.headerBrand}>ORTHODOX KOREA</Text>
            </Pressable>
            <ByzantineKnot size={14} color={colors.accentBright} />
            <View style={styles.headerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
            onPress={openSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.search')}
          >
            <SearchSvgIcon size={20} color={colors.brandText} />
          </Pressable>
        </View>
        <View style={styles.headerGoldLine} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        // See TodayScreen: the tab bar already reserves the bottom inset, so this
        // is plain breathing room rather than insets.bottom counted twice.
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl }]}
      >
        {/* ═══ MONTH NAVIGATOR ═══ */}
        <View style={styles.monthNav}>
          <Pressable
            style={({ pressed }) => [styles.monthArrowButton, pressed && styles.pressed]}
            onPress={goPrev}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.previousMonth')}
          >
            <ByzantineArrow direction="left" size={20} color={colors.accent} />
          </Pressable>
          <Text style={styles.monthLabel}>{cursor.locale(language).format('MMMM YYYY')}</Text>
          <Pressable
            style={({ pressed }) => [styles.monthArrowButton, pressed && styles.pressed]}
            onPress={goNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.nextMonth')}
          >
            <ByzantineArrow direction="right" size={20} color={colors.accent} />
          </Pressable>
        </View>

        {/* ═══ CALENDAR GRID ═══ */}
        <View style={styles.gridCard}>
          <View style={styles.weekHeaderRow}>
            {weekLabels.map((header: string) => (
              // Three-letter abbreviations in 1/7th of the width: keep them on
              // one line at any font scale rather than letting them wrap and
              // desynchronise the header row from the grid below.
              <Text key={header} style={styles.weekHeaderText} numberOfLines={1}>
                {header}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={[styles.cell, styles.emptyCell]} />;
              }

              const cd = cellDataMap.get(day);
              if (!cd)
                return <View key={`empty-${index}`} style={[styles.cell, styles.emptyCell]} />;

              const isSelected = activeDateISO === cd.dateISO;
              const isToday = todayISO === cd.dateISO;

              return (
                <Pressable
                  key={cd.dateISO}
                  onPress={() => pickDate(day)}
                  accessibilityRole="button"
                  accessibilityLabel={formatDisplayDate(cd.dateISO, language)}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.cell,
                    (cd.isSunday || cd.hasHighRank) && styles.cellHigh,
                    !cd.isSunday && !cd.hasHighRank && cd.hasFeast && styles.cellFeast,
                    isToday && !isSelected && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cellDay,
                      cd.emphasis === 'crimson' && styles.cellDayHigh,
                      cd.emphasis === 'blue' && styles.cellDaySaturday,
                      isSelected && styles.cellDaySelected,
                    ]}
                  >
                    {day}
                  </Text>
                  {/* Colored pips for liturgical flags */}
                  <View style={styles.cellPipRow}>
                    {cd.hasFast ? (
                      <View
                        style={[
                          styles.pip,
                          { backgroundColor: isSelected ? colors.accentPale : colors.pipFast },
                        ]}
                      />
                    ) : null}
                    {cd.hasLiturgy ? (
                      <View
                        style={[
                          styles.pip,
                          { backgroundColor: isSelected ? colors.accentPale : colors.pipLiturgy },
                        ]}
                      />
                    ) : null}
                    {cd.eventCount > 0 ? (
                      <View
                        style={[
                          styles.pip,
                          { backgroundColor: isSelected ? colors.accentPale : colors.pipEvent },
                        ]}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ═══ SELECTION BAR ═══ */}
        <View style={[styles.selectionBar, activeDateISO === todayISO && styles.selectionBarToday]}>
          <Text style={styles.selectionDate}>{formatDisplayDate(activeDateISO, language)}</Text>
          {activeDateISO !== todayISO ? (
            <Pressable
              style={({ pressed }) => [styles.selectionTodayButton, pressed && styles.pressed]}
              onPress={goToday}
            >
              <Text style={styles.selectionTodayButtonText}>{t('today.goToday')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ═══ WARNINGS ═══ */}
        {!yearReady ? (
          <Text style={styles.warningText}>
            {t('today.noYearDataPublished', { year: cursor.year() })}
          </Text>
        ) : null}
        {yearReady && !selectedLiturgicalDay ? (
          <Text style={styles.warningText}>{t('today.noDayData')}</Text>
        ) : null}

        {/* ═══ DAY PANEL ═══ */}
        <View style={styles.manuscriptFrame}>
          <LiturgicalDayPanel
            language={language}
            dateISO={activeDateISO}
            liturgicalDay={selectedLiturgicalDay}
            events={selectedEvents}
            labels={{
              readings: t('common.readings'),
              celebrations: t('common.celebrations'),
              saints: t('common.saints'),
              otherInfo: t('common.otherInfo'),
              events: t('common.events'),
              itemReadings: t('common.itemReadings'),
              tone: t('common.tone'),
              matins: t('common.matins'),
              noReadings: t('common.noReadings'),
              noSaints: t('common.noSaints'),
              noOtherInfo: t('common.noOtherInfo'),
              noEvents: t('common.noEvents'),
              fast: t('common.fast'),
              cheese: t('common.cheese'),
              fish: t('common.fish'),
              pres: t('common.pres'),
              basil: t('common.basil'),
              dl: t('common.dl'),
            }}
            onEventPress={(event) =>
              navigation.navigate('EventDetail', { eventId: event.id, dateISO: event.dateISO })
            }
          />
        </View>

        {/* ═══ ADMIN SECTION ═══ (hidden offline — staff editing needs the backend) */}
        {adminMode && isOnline ? (
          <View style={styles.adminCard}>
            <Text style={styles.adminTitle}>{t('month.adminWorkflow')}</Text>
            <Text style={styles.adminSyncText}>
              {syncState === 'syncing' ? t('month.syncingApi') : syncError || t('month.syncedApi')}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.adminPrimaryButton, pressed && styles.pressed]}
              onPress={openCreateEditor}
            >
              <Text style={styles.adminPrimaryButtonText}>{t('month.addEventOnDate')}</Text>
            </Pressable>

            {selectedEvents.map((event) => (
              <View key={event.id} style={styles.adminRow}>
                <Text style={styles.adminRowTitle} numberOfLines={2}>
                  {localized(event.title, language)}
                </Text>
                <Text style={styles.adminRowMeta}>
                  {t(`month.recurrence.${event.recurrence || 'none'}`)}
                </Text>
                <View style={styles.adminRowActions}>
                  <Pressable
                    style={({ pressed }) => [styles.adminGhostButton, pressed && styles.pressed]}
                    onPress={() => openEditEditor(event)}
                  >
                    <Text style={styles.adminGhostButtonText}>{t('month.editEvent')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.adminDangerButton, pressed && styles.pressed]}
                    onPress={() => onDeleteEvent(event)}
                  >
                    <Text style={styles.adminDangerButtonText}>{t('month.deleteEvent')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ═══ EDITOR MODAL ═══ */}
      <Modal
        visible={editorVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <KeyboardSafeView style={styles.editorBackdrop} keyboardVerticalOffset={insets.top}>
          <ScrollView
            contentContainerStyle={styles.editorScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.editorCard}>
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle}>
                  {editingId ? t('month.editEvent') : t('month.addEvent')}
                </Text>
              </View>
              <Text style={styles.editorDate}>{formatDisplayDate(formDateISO, language)}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.input,
                  styles.datePickerTrigger,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setFormDatePickerOpen(true)}
              >
                <Text style={styles.datePickerTriggerText}>{formDateISO}</Text>
                <Text style={styles.datePickerTriggerIcon}>📅</Text>
              </Pressable>

              {formDatePickerOpen && (
                <View style={styles.datePickerInline}>
                  <View style={styles.datePickerRow}>
                    <View style={styles.datePickerSegment}>
                      <Text style={styles.datePickerLabel}>{t('today.yearLabel')}</Text>
                      <View style={styles.datePickerStepper}>
                        <Pressable
                          onPress={() => setFormDatePart('year', -1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.yearLabel')} ${t('a11y.decreaseValue')}`}
                        >
                          {/* Chevron glyphs are icons pinned to a 28pt box, not
                              readable content — they must not scale. */}
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ‹
                          </Text>
                        </Pressable>
                        <Text style={styles.datePickerValue}>{formDateYear}</Text>
                        <Pressable
                          onPress={() => setFormDatePart('year', 1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.yearLabel')} ${t('a11y.increaseValue')}`}
                        >
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ›
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.datePickerSegment}>
                      <Text style={styles.datePickerLabel}>{t('today.monthLabel')}</Text>
                      <View style={styles.datePickerStepper}>
                        <Pressable
                          onPress={() => setFormDatePart('month', -1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.monthLabel')} ${t('a11y.decreaseValue')}`}
                        >
                          {/* Chevron glyphs are icons pinned to a 28pt box, not
                              readable content — they must not scale. */}
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ‹
                          </Text>
                        </Pressable>
                        <Text style={styles.datePickerValue}>
                          {String(formDateMonth).padStart(2, '0')}
                        </Text>
                        <Pressable
                          onPress={() => setFormDatePart('month', 1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.monthLabel')} ${t('a11y.increaseValue')}`}
                        >
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ›
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.datePickerSegment}>
                      <Text style={styles.datePickerLabel}>{t('today.dayLabel')}</Text>
                      <View style={styles.datePickerStepper}>
                        <Pressable
                          onPress={() => setFormDatePart('day', -1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.dayLabel')} ${t('a11y.decreaseValue')}`}
                        >
                          {/* Chevron glyphs are icons pinned to a 28pt box, not
                              readable content — they must not scale. */}
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ‹
                          </Text>
                        </Pressable>
                        <Text style={styles.datePickerValue}>
                          {String(formDateDay).padStart(2, '0')}
                        </Text>
                        <Pressable
                          onPress={() => setFormDatePart('day', 1)}
                          style={styles.datePickerArrow}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('today.dayLabel')} ${t('a11y.increaseValue')}`}
                        >
                          <Text allowFontScaling={false} style={styles.datePickerArrowText}>
                            ›
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    style={styles.datePickerDone}
                    onPress={() => setFormDatePickerOpen(false)}
                  >
                    <Text style={styles.datePickerDoneText}>{t('common.done')}</Text>
                  </Pressable>
                </View>
              )}

              <TextInput
                value={titleEn}
                onChangeText={setTitleEn}
                placeholder={t('month.titleEnPlaceholder')}
                style={styles.input}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={titleKo}
                onChangeText={setTitleKo}
                placeholder={t('month.titleKoPlaceholder')}
                style={styles.input}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={summaryEn}
                onChangeText={setSummaryEn}
                placeholder={t('month.summaryEnPlaceholder')}
                style={styles.input}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={summaryKo}
                onChangeText={setSummaryKo}
                placeholder={t('month.summaryKoPlaceholder')}
                style={styles.input}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={detailsEn}
                onChangeText={setDetailsEn}
                placeholder={t('month.detailsEnPlaceholder')}
                style={[styles.input, styles.inputMultiline]}
                multiline
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={detailsKo}
                onChangeText={setDetailsKo}
                placeholder={t('month.detailsKoPlaceholder')}
                style={[styles.input, styles.inputMultiline]}
                multiline
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.formLabel}>{t('month.recurrence.title')}</Text>
              <View style={styles.optionRow}>
                {(['none', 'daily', 'weekly', 'monthly'] as EventRecurrence[]).map((recurrence) => (
                  <Pressable
                    key={recurrence}
                    style={[
                      styles.optionPill,
                      formRecurrence === recurrence && styles.optionPillActive,
                    ]}
                    onPress={() => setFormRecurrence(recurrence)}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        formRecurrence === recurrence && styles.optionPillTextActive,
                      ]}
                    >
                      {t(`month.recurrence.${recurrence}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Notify choice shown for BOTH create and edit. On edit it defaults
                  off (see openEditEditor), so re-notifying is an explicit opt-in:
                  a typo fix stays silent, a time/venue change can be announced. */}
              <Pressable
                style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
                onPress={() => setFormNotify((prev) => !prev)}
              >
                <View style={[styles.checkboxBox, formNotify && styles.checkboxBoxActive]}>
                  {formNotify ? (
                    <Text allowFontScaling={false} style={styles.checkboxTick}>
                      ✓
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.checkboxText}>
                  {t(editingId ? 'month.sendNotificationOnEdit' : 'month.sendNotification')}
                </Text>
              </Pressable>

              <View style={styles.editorActions}>
                <Pressable
                  style={({ pressed }) => [styles.editorCancel, pressed && styles.pressed]}
                  onPress={() => setEditorVisible(false)}
                >
                  <Text style={styles.editorCancelText}>{t('today.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.editorSave, pressed && styles.pressed]}
                  onPress={onSaveEditor}
                >
                  <Text style={styles.editorSaveText}>{t('month.save')}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardSafeView>
      </Modal>

      {/* ═══ SEARCH MODAL ═══ */}
      <Modal
        visible={searchVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setSearchVisible(false)}
      >
        <Pressable
          style={[
            styles.searchBackdrop,
            { justifyContent: 'flex-start', paddingTop: insets.top + 28 },
          ]}
          onPress={() => setSearchVisible(false)}
        >
          <Pressable
            style={[styles.searchCard, { maxHeight: searchCardMaxHeight }]}
            onPress={() => {}}
          >
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>{t('today.searchTitle')}</Text>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={t('today.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <ScrollView
              style={styles.searchList}
              contentContainerStyle={styles.searchListContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {searchBusy ? <Text style={styles.searchHint}>{t('common.loading')}</Text> : null}
              {!searchBusy && searchQuery.trim().length < 2 ? (
                <Text style={styles.searchHint}>{t('today.searchHint')}</Text>
              ) : null}
              {!searchBusy && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <Text style={styles.searchHint}>{t('today.noSearchResults')}</Text>
              ) : null}

              {!searchBusy
                ? searchResults.map((result) => (
                    <Pressable
                      key={`${result.kind}-${result.dateISO}-${result.label}`}
                      style={({ pressed }) => [styles.searchResultItem, pressed && styles.pressed]}
                      onPress={() => openSearchResult(result)}
                    >
                      <View style={styles.searchResultTopRow}>
                        <Text style={styles.searchResultKind}>{searchKindLabel(result.kind)}</Text>
                        <Text style={styles.searchResultDate}>
                          {formatDisplayDate(result.dateISO, language)}
                        </Text>
                      </View>
                      <Text style={styles.searchResultLabel}>{result.label}</Text>
                    </Pressable>
                  ))
                : null}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.searchCloseButton, pressed && styles.pressed]}
              onPress={() => setSearchVisible(false)}
            >
              <Text style={styles.searchCloseButtonText}>{t('today.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ ADMIN UNLOCK PROMPT ═══ */}
      <PromptModal
        visible={adminPromptVisible}
        title={t('secret.accessTitle')}
        message={t('secret.accessPrompt')}
        placeholder={t('secret.accessPlaceholder')}
        submitLabel={t('secret.accessSubmit')}
        cancelLabel={t('today.cancel')}
        secureTextEntry
        onSubmit={(value) => void submitAdminPassword(value)}
        onCancel={() => setAdminPromptVisible(false)}
      />
    </View>
  );
}

// App is portrait-locked, so a window-based max height resolves reliably — unlike a
// percentage of the modal's auto-height KeyboardAvoidingView parent (which mis-sized
// the card and clipped the close button).
const WINDOW_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },

  // ─── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primaryDeep,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSubtle,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accentLine,
  },
  // See the twin comment in TodayScreen: the Pressable must shrink too, or the
  // Text's own flexShrink is inert and the search button is pushed off-screen.
  headerBrandPress: {
    flexShrink: 1,
  },
  headerBrand: {
    color: colors.brandText,
    fontFamily: typography.family.heading,
    fontSize: typography.size.xs,
    letterSpacing: 1.2,
    textAlign: 'center',
    flexShrink: 1,
  },
  headerGoldLine: {
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },

  // ─── Month navigator ───────────────────────────────────────────────────────
  monthNav: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  monthArrowButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },

  // ─── Grid card ─────────────────────────────────────────────────────────────
  gridCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.primaryDeep,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.heading,
    fontSize: typography.size.xs,
    color: colors.brandText,
    paddingVertical: spacing.sm,
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    minHeight: 56,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWhite,
    paddingVertical: 4,
    gap: 2,
  },
  emptyCell: {
    backgroundColor: colors.surface,
  },
  cellHigh: {
    backgroundColor: colors.crimsonTint,
  },
  cellFeast: {
    backgroundColor: colors.accentGlow,
  },
  cellToday: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDeep,
    borderWidth: 1.5,
  },
  cellDay: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  cellDayHigh: {
    color: colors.danger,
    fontFamily: typography.family.heading,
    fontWeight: typography.weight.bold,
  },
  cellDaySaturday: {
    color: colors.blue,
    fontFamily: typography.family.heading,
    fontWeight: typography.weight.bold,
  },
  cellDaySelected: {
    color: colors.surfaceWhite,
    fontFamily: typography.family.heading,
    fontWeight: typography.weight.bold,
  },
  cellPipRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    alignItems: 'center',
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // ─── Selection bar ─────────────────────────────────────────────────────────
  selectionBar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectionBarToday: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  selectionDate: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  selectionTodayButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  selectionTodayButtonText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },

  warningText: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceWhite,
    fontFamily: typography.family.body,
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  manuscriptFrame: {
    marginHorizontal: spacing.lg,
  },

  // ─── Admin section ─────────────────────────────────────────────────────────
  adminCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  adminTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  adminSyncText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  adminPrimaryButton: {
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  adminPrimaryButtonText: {
    color: colors.surfaceWhite,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  adminRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  adminRowTitle: {
    fontFamily: typography.family.body,
    color: colors.textBody,
    fontSize: typography.size.sm,
  },
  adminRowMeta: {
    fontFamily: typography.family.body,
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  adminRowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  adminGhostButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  adminGhostButtonText: {
    color: colors.primary,
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
  },
  adminDangerButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  adminDangerButtonText: {
    color: colors.danger,
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
  },

  // ─── Editor modal ──────────────────────────────────────────────────────────
  editorBackdrop: {
    flex: 1,
    backgroundColor: colors.backdropDark,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  editorScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  editorCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWhite,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  editorHeader: {
    backgroundColor: colors.primaryDeep,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  editorTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.brandText,
  },
  editorDate: {
    fontFamily: typography.family.body,
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textBody,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTriggerText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textBody,
    flexShrink: 1,
  },
  datePickerTriggerIcon: {
    fontSize: 16,
  },
  datePickerInline: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  datePickerSegment: {
    alignItems: 'center',
    flexShrink: 1,
  },
  datePickerStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  datePickerLabel: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  datePickerArrow: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  datePickerArrowText: {
    color: colors.brandText,
    fontSize: 15,
    fontWeight: '700',
  },
  datePickerValue: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textBody,
    textAlign: 'center',
    paddingHorizontal: 2,
    flexShrink: 1,
  },
  datePickerDone: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDeep,
  },
  datePickerDoneText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.brandText,
  },
  formLabel: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  optionPillText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  optionPillTextActive: {
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxBoxActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  checkboxTick: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontFamily: typography.family.body,
  },
  checkboxText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textBody,
    flexShrink: 1,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
  },
  editorCancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  editorCancelText: {
    color: colors.textSecondary,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
  },
  editorSave: {
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  editorSaveText: {
    color: colors.surfaceWhite,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
  },

  // ─── Search modal ──────────────────────────────────────────────────────────
  searchBackdrop: {
    flex: 1,
    backgroundColor: colors.backdropDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: WINDOW_HEIGHT * 0.7,
    overflow: 'hidden',
  },
  searchModalHeader: {
    backgroundColor: colors.primaryDeep,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchModalTitle: {
    color: colors.brandText,
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textBody,
  },
  searchList: {
    // Shrink the results list so the header, input, and close button stay visible
    // (close button was being clipped). Scrolls within whatever space remains.
    flexShrink: 1,
  },
  searchListContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  searchResultItem: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceWhite,
    gap: spacing.xs,
  },
  searchResultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultKind: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  searchResultDate: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  searchResultLabel: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.textBody,
  },
  searchCloseButton: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  searchCloseButtonText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.primary,
  },
});
