import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Alert, Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { SECRET_MENU_ENABLED } from '../../config/features';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { ByzantineArrow } from '../../components/common/ByzantineArrow';
import { ByzantineKnot } from '../../components/common/ByzantineKnot';
import { LiturgicalDayPanel } from '../../components/common/LiturgicalDayPanel';
import { PromptModal } from '../../components/common/PromptModal';
import {
  ensureLiturgicalYear,
  getEventsByDate,
  getLiturgicalDayByDate,
  searchLiturgicalContent,
  type LiturgicalSearchResult,
} from '../../features/calendar/calendarService';
import { useCalendarDataVersion } from '../../features/calendar/useCalendarDataVersion';
import { useEventsStore } from '../../features/events/useEventsStore';
import { loginAdminThroughCloudflare } from '../../services/api/adminAuth';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { MainTabsParamList, RootStackParamList } from '../../navigation/types';
import { formatDisplayDate } from '../../utils/date';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Today'>,
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

export function TodayScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // The search modal is top-anchored at (insets.top + 28) — a comfortable gap below the
  // notch — and capped to the band above the keyboard, so the WHOLE card is always on
  // screen (28 below the notch, 16 above the keyboard) no matter how long the list is.
  const searchCardMaxHeight = WINDOW_HEIGHT - insets.top - 28 - Math.max(keyboardHeight, insets.bottom) - 16;
  const { language, setLanguage, adminMode, setSecretMenuUnlocked, setCloudflareAdminAuthenticated } = useAppStore();
  const [activeDateISO, setActiveDateISO] = useState(dayjs().format('YYYY-MM-DD'));
  const todayISO = dayjs().format('YYYY-MM-DD');
  const [yearReady, setYearReady] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<LiturgicalSearchResult[]>([]);
  const searchRequestIdRef = useRef(0);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedDay, setSelectedDay] = useState(dayjs().date());
  const syncYearEvents = useEventsStore((state) => state.syncYearEvents);
  const customEvents = useEventsStore((state) => state.customEvents);
  // Repaints automatically when a background GitHub sync brings in newer calendar JSON.
  const dataVersion = useCalendarDataVersion();

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
  const activeYear = dayjs(activeDateISO).year();
  const events = useMemo(() => getEventsByDate(activeDateISO, adminMode), [activeDateISO, adminMode, customEvents]);
  const liturgicalDay = useMemo(() => getLiturgicalDayByDate(activeDateISO), [activeDateISO, dataVersion]);
  const maxDayInSelectedMonth = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`).daysInMonth();

  useEffect(() => {
    let mounted = true;
    const year = dayjs(activeDateISO).year();
    void ensureLiturgicalYear(year).then((ok) => {
      if (mounted) {
        setYearReady(ok);
      }
    });
    return () => {
      mounted = false;
    };
  }, [activeDateISO]);

  useEffect(() => {
    void syncYearEvents(activeYear);
  }, [activeYear, syncYearEvents]);

  useEffect(() => {
    if (!searchVisible) {
      return;
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearchBusy(true);

    const timer = setTimeout(() => {
      const year = dayjs(activeDateISO).year();
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
  }, [searchQuery, searchVisible, language, activeDateISO]);

  const toggleLanguage = () => {
    const next = language === 'en' ? 'ko' : 'en';
    setLanguage(next);
  };

  const goPreviousDay = () => {
    setActiveDateISO((prev) => dayjs(prev).subtract(1, 'day').format('YYYY-MM-DD'));
  };

  const goNextDay = () => {
    setActiveDateISO((prev) => dayjs(prev).add(1, 'day').format('YYYY-MM-DD'));
  };

  const goToday = () => {
    setActiveDateISO(todayISO);
  };

  const openSearch = () => {
    setSearchVisible(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openDatePicker = () => {
    const active = dayjs(activeDateISO);
    setSelectedYear(active.year());
    setSelectedMonth(active.month() + 1);
    setSelectedDay(active.date());
    setDatePickerVisible(true);
  };

  const changeYear = (delta: number) => {
    setSelectedYear((prev) => prev + delta);
  };

  const changeMonth = (delta: number) => {
    setSelectedMonth((prev) => {
      const next = prev + delta;
      if (next < 1) return 12;
      if (next > 12) return 1;
      return next;
    });
  };

  const changeDay = (delta: number) => {
    setSelectedDay((prev) => {
      const next = prev + delta;
      const max = maxDayInSelectedMonth;
      if (next < 1) return max;
      if (next > max) return 1;
      return next;
    });
  };

  useEffect(() => {
    setSelectedDay((prev) => Math.min(prev, maxDayInSelectedMonth));
  }, [maxDayInSelectedMonth]);

  const goToSelectedDate = async () => {
    const normalized = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

    const ready = await ensureLiturgicalYear(selectedYear);
    setYearReady(ready);
    setActiveDateISO(normalized);
    setDatePickerVisible(false);
  };

  const openSearchResult = (result: LiturgicalSearchResult) => {
    setActiveDateISO(result.dateISO);
    setSearchVisible(false);
  };

  const searchKindLabel = (kind: LiturgicalSearchResult['kind']) => {
    if (kind === 'celebration') return t('common.celebrations');
    if (kind === 'saint') return t('common.saints');
    return t('common.readings');
  };

  const isOnToday = activeDateISO === todayISO;

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
            <Pressable onPress={handleBrandTap} hitSlop={4} accessibilityRole="header" accessibilityLabel={t('a11y.brandTitle')}>
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
        ]}
      >
      {/* ═══ ACTION PILLS ═══ */}
      <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]} onPress={openDatePicker} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('today.openDatePicker')}>
          <Text style={styles.actionPillText}>{t('today.openDatePicker')}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]} onPress={toggleLanguage} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('today.toggleLanguage')}>
          <Text style={styles.actionPillText}>
            {language === 'en' ? '한국어' : 'English'}
          </Text>
        </Pressable>
        {!isOnToday ? (
          <Pressable style={({ pressed }) => [styles.actionPillAccent, pressed && styles.pressed]} onPress={goToday} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('today.goToday')}>
            <Text style={styles.actionPillAccentText}>{t('today.goToday')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ═══ DAY NAVIGATOR ═══ */}
      <View style={[styles.dayNavigator, isOnToday && styles.dayNavigatorToday]}>
        <Pressable style={({ pressed }) => [styles.dayArrowButton, pressed && styles.pressed]} onPress={goPreviousDay} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.previousDay')}>
          <ByzantineArrow direction="left" size={22} color={colors.accent} />
        </Pressable>
        <View style={styles.dayNavLine} />
        <Text style={styles.dayNavDate}>{formatDisplayDate(activeDateISO, language)}</Text>
        <View style={styles.dayNavLine} />
        <Pressable style={({ pressed }) => [styles.dayArrowButton, pressed && styles.pressed]} onPress={goNextDay} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.nextDay')}>
          <ByzantineArrow direction="right" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {/* ═══ WARNINGS ═══ */}
      {!yearReady ? (
        <Text style={styles.warningText}>{t('today.noYearDataPublished', { year: dayjs(activeDateISO).year() })}</Text>
      ) : null}
      {yearReady && !liturgicalDay ? (
        <Text style={styles.warningText}>{t('today.noDayData')}</Text>
      ) : null}

      {/* ═══ DAY PANEL ═══ */}
      <View style={styles.manuscriptFrame}>
        <LiturgicalDayPanel
          language={language}
          dateISO={activeDateISO}
          liturgicalDay={liturgicalDay}
          events={events}
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
          onEventPress={(event) => navigation.navigate('EventDetail', { eventId: event.id, dateISO: event.dateISO })}
        />
      </View>
      </ScrollView>

      {/* ═══ SEARCH MODAL ═══ */}
      <Modal visible={searchVisible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setSearchVisible(false)}>
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-start', paddingTop: insets.top + 28 }]}
          onPress={() => setSearchVisible(false)}
        >
            <Pressable style={[styles.modalCard, { maxHeight: searchCardMaxHeight }]} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('today.searchTitle')}</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
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
                  {searchBusy ? <Text style={styles.modalHint}>{t('common.loading')}</Text> : null}
                  {!searchBusy && searchQuery.trim().length < 2 ? <Text style={styles.modalHint}>{t('today.searchHint')}</Text> : null}
                  {!searchBusy && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                    <Text style={styles.modalHint}>{t('today.noSearchResults')}</Text>
                  ) : null}

                  {!searchBusy
                    ? searchResults.map((result) => (
                        <Pressable
                          key={`${result.kind}-${result.dateISO}-${result.label}`}
                          style={({ pressed }) => [styles.searchResultItem, pressed && styles.pressed]}
                          onPress={() => openSearchResult(result)}
                          accessibilityRole="button"
                        >
                          <View style={styles.searchResultTopRow}>
                            <Text style={styles.searchResultKind}>{searchKindLabel(result.kind)}</Text>
                            <Text style={styles.searchResultDate}>{formatDisplayDate(result.dateISO, language)}</Text>
                          </View>
                          <Text style={styles.searchResultLabel}>{result.label}</Text>
                        </Pressable>
                      ))
                    : null}
                </ScrollView>

                <Pressable style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]} onPress={() => setSearchVisible(false)} accessibilityRole="button">
                  <Text style={styles.modalCloseButtonText}>{t('today.cancel')}</Text>
                </Pressable>
            </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ DATE PICKER MODAL ═══ */}
      <Modal visible={datePickerVisible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDatePickerVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => Keyboard.dismiss()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('today.jumpToDateTitle')}</Text>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>{t('today.yearLabel')}</Text>
              <View style={styles.pickerControl}>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeYear(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.yearLabel')} ${t('a11y.decreaseValue')}`}>
                  <ByzantineArrow direction="left" size={18} color={colors.accent} />
                </Pressable>
                <Text style={styles.pickerValue}>{selectedYear}</Text>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeYear(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.yearLabel')} ${t('a11y.increaseValue')}`}>
                  <ByzantineArrow direction="right" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>{t('today.monthLabel')}</Text>
              <View style={styles.pickerControl}>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeMonth(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.monthLabel')} ${t('a11y.decreaseValue')}`}>
                  <ByzantineArrow direction="left" size={18} color={colors.accent} />
                </Pressable>
                <Text style={styles.pickerValue}>
                  {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString(language === 'ko' ? 'ko' : 'en', {
                    month: 'long',
                  })}
                </Text>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeMonth(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.monthLabel')} ${t('a11y.increaseValue')}`}>
                  <ByzantineArrow direction="right" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>{t('today.dayLabel')}</Text>
              <View style={styles.pickerControl}>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeDay(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.dayLabel')} ${t('a11y.decreaseValue')}`}>
                  <ByzantineArrow direction="left" size={18} color={colors.accent} />
                </Pressable>
                <Text style={styles.pickerValue}>{selectedDay}</Text>
                <Pressable style={styles.pickerArrowButton} onPress={() => changeDay(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('today.dayLabel')} ${t('a11y.increaseValue')}`}>
                  <ByzantineArrow direction="right" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable style={({ pressed }) => [styles.modalActionButtonMuted, pressed && styles.pressed]} onPress={() => setDatePickerVisible(false)} accessibilityRole="button">
                <Text style={styles.modalActionButtonMutedText}>{t('today.cancel')}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modalActionButton, pressed && styles.pressed]} onPress={() => void goToSelectedDate()} accessibilityRole="button">
                <Text style={styles.modalActionButtonText}>{t('today.jumpButton')}</Text>
              </Pressable>
            </View>
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
  // ─── Scaffold ──────────────────────────────────────────────────────────────
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

  // ─── Action pills ──────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  actionPillText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  actionPillAccent: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  actionPillAccentText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },

  // ─── Day navigator ─────────────────────────────────────────────────────────
  dayNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dayNavigatorToday: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  dayNavLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  dayArrowButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
  },
  dayNavDate: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },

  // ─── Warning text ──────────────────────────────────────────────────────────
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

  // ─── Manuscript frame ──────────────────────────────────────────────────────
  manuscriptFrame: {
    marginHorizontal: spacing.lg,
  },

  // ─── Modal shared ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdropDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    maxHeight: WINDOW_HEIGHT * 0.7,
  },
  modalHeader: {
    backgroundColor: colors.primaryDeep,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  modalTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.brandText,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    color: colors.textBody,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.md,
  },
  modalHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  // ─── Search results ────────────────────────────────────────────────────────
  searchList: {
    // Shrink the results list so the header, input, and close button stay visible
    // (close button was being clipped). Scrolls within whatever space remains.
    flexShrink: 1,
    paddingHorizontal: spacing.md,
  },
  searchListContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  searchResultItem: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
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
  },
  searchResultDate: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  searchResultLabel: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },

  // ─── Modal buttons ─────────────────────────────────────────────────────────
  modalCloseButton: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.md,
    margin: 0,
  },
  modalCloseButtonText: {
    textAlign: 'center',
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },

  // ─── Date picker ───────────────────────────────────────────────────────────
  pickerRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  pickerLabel: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  pickerControl: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickerArrowButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pickerValue: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.primary,
    minWidth: 90,
    textAlign: 'center',
  },

  // ─── Modal action row ──────────────────────────────────────────────────────
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
  },
  modalActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: spacing.sm,
  },
  modalActionButtonText: {
    textAlign: 'center',
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
  modalActionButtonMuted: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
  },
  modalActionButtonMutedText: {
    textAlign: 'center',
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
});
