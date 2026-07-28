import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTextScale } from '../../hooks/useTextScale';
import type { SupportedLanguage } from '../../types/language';
import type { LiturgicalDay, LiturgicalEvent } from '../../features/calendar/types';
import { localized } from '../../features/calendar/types';
import { colors, shadows } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatDisplayDate } from '../../utils/date';
import { getDayEmphasis } from '../../features/calendar/dayEmphasis';
import { LiturgicalFlagsRow } from './LiturgicalFlagsRow';
import { OrnamentTitle } from './OrnamentTitle';
import { Text } from './ScaledText';
import { SelectableText } from './SelectableText';

type Props = {
  language: SupportedLanguage;
  dateISO: string;
  liturgicalDay: LiturgicalDay | null;
  events: LiturgicalEvent[];
  labels: {
    readings: string;
    celebrations: string;
    saints: string;
    otherInfo: string;
    events: string;
    itemReadings: string;
    tone: string;
    matins: string;
    noReadings: string;
    noSaints: string;
    noOtherInfo: string;
    noEvents: string;
    fast: string;
    cheese: string;
    fish: string;
    pres: string;
    basil: string;
    dl: string;
  };
  onEventPress: (event: LiturgicalEvent) => void;
};

export function LiturgicalDayPanel({
  language,
  dateISO,
  liturgicalDay,
  events,
  labels,
  onEventPress,
}: Props) {
  const { isSunday, isSaturday, dayNum, dayName, monthYear } = useMemo(() => {
    const d = new Date(`${dateISO}T00:00:00`);
    const locale = language === 'ko' ? 'ko' : 'en';
    return {
      isSunday: d.getDay() === 0,
      isSaturday: d.getDay() === 6,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString(locale, { weekday: 'long' }),
      monthYear: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    };
  }, [dateISO, language]);

  const displayReadings = useMemo(
    () =>
      language === 'ko'
        ? liturgicalDay?.readingsLocalized?.ko || liturgicalDay?.readings || []
        : liturgicalDay?.readingsLocalized?.en || liturgicalDay?.readings || [],
    [language, liturgicalDay],
  );

  const displayCelebrations = useMemo(
    () =>
      language === 'ko'
        ? liturgicalDay?.celebrationsLocalized?.ko || liturgicalDay?.celebrations || []
        : liturgicalDay?.celebrationsLocalized?.en || liturgicalDay?.celebrations || [],
    [language, liturgicalDay],
  );

  const displaySaints = useMemo(
    () =>
      language === 'ko'
        ? liturgicalDay?.saintsLocalized?.ko || liturgicalDay?.saints || []
        : liturgicalDay?.saintsLocalized?.en || liturgicalDay?.saints || [],
    [language, liturgicalDay],
  );

  const hasFlags = Boolean(
    liturgicalDay &&
    (liturgicalDay.fast ||
      liturgicalDay.cheese ||
      liturgicalDay.fish ||
      liturgicalDay.presanctified ||
      liturgicalDay.saintBasil ||
      liturgicalDay.divineLiturgy),
  );

  // Shared colour code (see dayEmphasis.ts). A filled circle always pairs with a
  // white day number; 'none' keeps the crimson outline.
  const dateRingFill = useMemo(() => {
    const entries = [...displayCelebrations, ...displaySaints];
    return getDayEmphasis({
      dayOfWeek: isSunday ? 0 : isSaturday ? 6 : 1,
      hasHighRank: entries.some((entry) => entry.highRank),
      hasCelebration: entries.some((entry) => entry.celeb),
    });
  }, [isSunday, isSaturday, displayCelebrations, displaySaints]);

  const isDateRingFilled = dateRingFill !== 'none';

  const uniqueInfoLines = useMemo(() => {
    const lines: string[] = [];
    for (const entry of [...displayCelebrations, ...displaySaints]) {
      if (entry.tone) lines.push(`${labels.tone} ${entry.tone}`);
      if (entry.matinsGospel) lines.push(`${labels.matins} ${entry.matinsGospel}`);
    }
    return Array.from(new Set(lines));
  }, [displayCelebrations, displaySaints, labels.tone, labels.matins]);

  // The date circle is a fixed box around scaling type, so it has to grow with
  // it — otherwise the day number is vertically shaved off at a large font size
  // (a filled, border-radiused View clips its children on Android).
  const textScale = useTextScale();
  const ringSize = Math.round(RING_BASE_SIZE * textScale);

  const isEmptyDay =
    !hasFlags &&
    displayReadings.length === 0 &&
    displayCelebrations.length === 0 &&
    displaySaints.length === 0 &&
    uniqueInfoLines.length === 0 &&
    events.length === 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View
          style={[
            styles.ring,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            dateRingFill === 'crimson' && styles.ringHighlight,
            dateRingFill === 'blue' && styles.ringSaturday,
          ]}
        >
          <Text style={[styles.ringText, isDateRingFilled && styles.ringTextHighlight]}>
            {dayNum}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.dayName}>{dayName}</Text>
          <Text style={styles.monthYear}>{monthYear}</Text>
        </View>
      </View>

      {liturgicalDay && hasFlags ? (
        <View style={styles.section}>
          <LiturgicalFlagsRow
            day={liturgicalDay}
            labels={{
              fast: labels.fast,
              cheese: labels.cheese,
              fish: labels.fish,
              pres: labels.pres,
              basil: labels.basil,
              dl: labels.dl,
            }}
          />
        </View>
      ) : null}

      {displayReadings.length ? (
        <View style={styles.section}>
          <OrnamentTitle text={labels.readings} />
          <View style={styles.readingRow}>
            {displayReadings.map((reading) => (
              // The pill is a View wrapping a plain Text. A <Text> that carries its
              // own padding/border under-reports its height to Android's flex layout,
              // so a long reading (or a raised OS font scale) made the pill spill over
              // the next section's header. A View measures its text child correctly.
              <View key={reading} style={styles.readingTag}>
                <SelectableText style={styles.readingTagText}>{reading}</SelectableText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {displayCelebrations.length ? (
        <View style={styles.section}>
          <OrnamentTitle text={labels.celebrations} />
          {displayCelebrations.map((item) => (
            <View
              key={item.id}
              style={[
                styles.celebrationItem,
                item.highRank ? styles.celebItemHigh : item.celeb ? styles.celebItemFeast : null,
              ]}
            >
              <SelectableText
                style={[
                  styles.celebrationTitle,
                  item.highRank
                    ? styles.celebTitleHigh
                    : item.celeb
                      ? styles.celebTitleFeast
                      : null,
                ]}
              >
                {localized(item.title, language)}
              </SelectableText>
              {item.readings?.length ? (
                <SelectableText style={styles.celebrationMeta}>
                  {labels.itemReadings}: {item.readings.join(', ')}
                </SelectableText>
              ) : null}
              {item.tone ? (
                <SelectableText style={styles.celebrationMeta}>
                  {labels.tone} {item.tone}
                </SelectableText>
              ) : null}
              {item.matinsGospel ? (
                <SelectableText style={styles.celebrationMeta}>
                  {labels.matins} {item.matinsGospel}
                </SelectableText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {displaySaints.length ? (
        <View style={styles.section}>
          <OrnamentTitle text={labels.saints} />
          {displaySaints.map((item) => (
            <View key={item.id} style={styles.celebrationItem}>
              <SelectableText style={styles.celebrationTitle}>
                {localized(item.title, language)}
              </SelectableText>
              {item.readings?.length ? (
                <SelectableText style={styles.celebrationMeta}>
                  {labels.itemReadings}: {item.readings.join(', ')}
                </SelectableText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {uniqueInfoLines.length ? (
        <View style={styles.section}>
          <OrnamentTitle text={labels.otherInfo} />
          {uniqueInfoLines.map((item) => (
            <SelectableText key={item} style={styles.celebrationMeta}>
              - {item}
            </SelectableText>
          ))}
        </View>
      ) : null}

      {events.length ? (
        <View style={styles.section}>
          <OrnamentTitle text={labels.events} />
          {events.map((event) => (
            <Pressable
              key={event.id}
              style={({ pressed }) => [styles.eventItem, pressed && styles.pressed]}
              onPress={() => onEventPress(event)}
            >
              <Text style={styles.eventTitle}>{localized(event.title, language)}</Text>
              <Text style={styles.eventSummary}>{localized(event.summary, language)}</Text>
              <Text style={styles.eventDate}>{formatDisplayDate(event.dateISO, language)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isEmptyDay ? (
        <View style={styles.section}>
          <Text style={styles.emptyText}>{labels.noEvents}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Diameter of the date circle at a 1.0 text scale; grows with the text. */
const RING_BASE_SIZE = 56;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.warm,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  // Size (width/height/borderRadius) is applied inline from the text scale.
  ring: {
    borderWidth: 2.5,
    borderColor: colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Without the shrink this bare View sizes to the day name's full width and
  // runs past the card's rounded edge once the type grows.
  headerText: {
    flexShrink: 1,
  },
  ringText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.crimson,
  },
  ringHighlight: {
    backgroundColor: colors.crimson,
  },
  ringSaturday: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  ringTextHighlight: {
    color: colors.surfaceWhite,
  },
  dayName: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.primary,
  },
  monthYear: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  readingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // Container carries the pill chrome; the Text inside carries only type. Keeping
  // padding/border off the Text is what stops it overflowing its row (see render).
  readingTag: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    // Never let one long reading push the row wider than the card.
    flexShrink: 1,
    maxWidth: '100%',
  },
  readingTagText: {
    color: colors.textBody,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
  },
  celebrationItem: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  celebrationTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textBody,
  },
  celebItemHigh: {
    borderLeftColor: colors.crimson,
    backgroundColor: colors.crimsonTint,
  },
  // Celebration ("celeb": true) entries — blue container, italic title. Scoped to
  // the entry itself; the surrounding day keeps its own emphasis.
  celebItemFeast: {
    borderLeftColor: colors.blue,
    backgroundColor: colors.blueTint,
  },
  celebTitleHigh: {
    color: colors.crimson,
    fontWeight: typography.weight.semibold,
  },
  celebTitleFeast: {
    color: colors.blue,
    fontStyle: 'italic',
  },
  celebrationMeta: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  eventItem: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceWhite,
    gap: spacing.xs,
  },
  eventTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  eventSummary: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textBody,
  },
  eventDate: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
