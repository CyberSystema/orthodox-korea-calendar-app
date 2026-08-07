import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import type { LiturgicalDay, LiturgicalEvent } from '../../features/calendar/types';
import { localized } from '../../features/calendar/types';
import type { SupportedLanguage } from '../../types/language';
import { spacing } from '../../theme/spacing';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { ByzantineKnot } from './ByzantineKnot';
import { Text } from './ScaledText';
import { SelectableText } from './SelectableText';

type Props = {
  language: SupportedLanguage;
  dateISO: string;
  liturgicalDay: LiturgicalDay | null;
  events: LiturgicalEvent[];
  labels: {
    readings: string;
    saints: string;
    events: string;
    tone: string;
    noReadings: string;
  };
  onEventPress?: (event: LiturgicalEvent) => void;
};

/**
 * THE DAY AS A PAGE, not as a card.
 *
 * This is the Illuminated direction's own composition, and it is deliberately a
 * different SHAPE from the default panel rather than the same layout in another
 * typeface — that was the failure of the first attempt at these directions.
 * What actually changes:
 *
 *   HIERARCHY. The old panel gave the date, the feast, the readings and the
 *   saints nearly the same weight (15/17/20pt) inside one bordered box, so the
 *   eye had nowhere to land. Here the numeral is ~72pt and the commemoration is
 *   the headline; everything else recedes. The type scale spans 11 → 72 instead
 *   of 15 → 20.
 *
 *   COMPOSITION. No card floating in empty space. Full-bleed bands separated by
 *   gold rules, so the page fills the screen the way a manuscript leaf does.
 *
 *   RANK IS VISIBLE. A feast, a fast and an ordinary Tuesday currently look
 *   identical apart from a coloured dot. Here the day's own flags — which the
 *   app already computes — set the hero's colour and ornament, so a great feast
 *   announces itself.
 */
export function IlluminatedDay({
  language,
  dateISO,
  liturgicalDay,
  events,
  labels,
  onEventPress,
}: Props) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { dayNum, weekday, monthYear, isSunday } = useMemo(() => {
    const d = new Date(`${dateISO}T00:00:00`);
    const locale = language === 'ko' ? 'ko' : 'en';
    return {
      dayNum: d.getDate(),
      weekday: d.toLocaleDateString(locale, { weekday: 'long' }),
      monthYear: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      isSunday: d.getDay() === 0,
    };
  }, [dateISO, language]);

  const celebrations = useMemo(
    () =>
      (language === 'ko'
        ? liturgicalDay?.celebrationsLocalized?.ko
        : liturgicalDay?.celebrationsLocalized?.en) ??
      liturgicalDay?.celebrations ??
      [],
    [liturgicalDay, language],
  );
  const saints = useMemo(
    () =>
      (language === 'ko'
        ? liturgicalDay?.saintsLocalized?.ko
        : liturgicalDay?.saintsLocalized?.en) ??
      liturgicalDay?.saints ??
      [],
    [liturgicalDay, language],
  );
  const readings = useMemo(
    () =>
      (language === 'ko'
        ? liturgicalDay?.readingsLocalized?.ko
        : liturgicalDay?.readingsLocalized?.en) ??
      liturgicalDay?.readings ??
      [],
    [liturgicalDay, language],
  );

  // The headline is the day's principal commemoration: a high-rank entry if there
  // is one, else the first celebration, else the first saint. Everything else
  // falls into the list below, so the page always has exactly one focal point.
  const headline = useMemo(() => {
    const ranked = celebrations.find((c) => c.highRank) ?? celebrations[0] ?? saints[0];
    return ranked ? localized(ranked.title, language) : null;
  }, [celebrations, saints, language]);

  const isFeast = celebrations.some((c) => c.highRank);
  const isFast = Boolean(liturgicalDay?.fast);
  const heroColor = isFeast || isSunday ? th.feastAccent : th.textPrimary;

  const rest = useMemo(() => {
    const all = [...celebrations, ...saints];
    // Drop the entry already used as the headline so it is not said twice.
    return headline ? all.filter((c) => localized(c.title, language) !== headline) : all;
  }, [celebrations, saints, headline, language]);

  return (
    <View style={styles.page}>
      {/* ═══ HERO ═══ */}
      <View style={styles.hero}>
        <Text style={styles.weekday}>{weekday.toUpperCase()}</Text>
        <Text style={[styles.numeral, { color: heroColor }]} allowFontScaling={false}>
          {dayNum}
        </Text>
        <Text style={styles.monthYear}>{monthYear}</Text>

        <View style={styles.ornamentRow}>
          <View style={styles.rule} />
          <ByzantineKnot size={12} color={th.accent} />
          <View style={styles.rule} />
        </View>

        {headline ? (
          <SelectableText style={[styles.headline, { color: heroColor }]}>
            {headline}
          </SelectableText>
        ) : null}

        {/* Fasting is a state of the day, not a badge to collect — one quiet line. */}
        {isFast ? <Text style={styles.fastMark}>{'†'}</Text> : null}
      </View>

      {/* ═══ READINGS ═══ */}
      <Section title={labels.readings}>
        {readings.length ? (
          readings.map((r) => (
            <SelectableText key={r} style={styles.reading}>
              {r}
            </SelectableText>
          ))
        ) : (
          <Text style={styles.muted}>{labels.noReadings}</Text>
        )}
      </Section>

      {/* ═══ COMMEMORATIONS ═══ */}
      {rest.length ? (
        <Section title={labels.saints}>
          {rest.map((c, i) => (
            <SelectableText key={`${c.id}-${i}`} style={styles.commemoration}>
              {localized(c.title, language)}
            </SelectableText>
          ))}
        </Section>
      ) : null}

      {/* ═══ PARISH EVENTS ═══ */}
      {events.length ? (
        <Section title={labels.events}>
          {events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => onEventPress?.(e)}
              style={({ pressed }) => [styles.event, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.eventTitle}>{localized(e.title, language)}</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

/** A ruled section label — the manuscript's own way of starting a new part. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.rule} />
        <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
        <View style={styles.rule} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    page: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xxl,
    },
    pressed: { opacity: 0.6 },

    // ── Hero ────────────────────────────────────────────────────────────────
    hero: {
      alignItems: 'center',
      paddingTop: spacing.xl,
      gap: spacing.xs,
    },
    weekday: {
      fontFamily: th.design.fontHeading,
      fontSize: 13,
      letterSpacing: 4,
      color: th.accent,
    },
    numeral: {
      // The single largest thing on the screen. Deliberately opted out of text
      // scaling: it is a display figure inside a fixed composition, and the
      // reader's size setting governs the CONTENT below it.
      fontFamily: th.design.fontHeading,
      fontSize: 72,
      lineHeight: 80,
    },
    monthYear: {
      fontFamily: th.design.fontHeading,
      fontSize: 17,
      color: th.textSecondary,
    },
    ornamentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'stretch',
      paddingVertical: spacing.md,
    },
    rule: {
      flex: 1,
      height: 1,
      backgroundColor: th.accentDim,
    },
    headline: {
      fontFamily: th.design.fontHeadingStrong,
      fontSize: 26,
      lineHeight: 34,
      textAlign: 'center',
    },
    fastMark: {
      fontFamily: th.design.fontHeading,
      fontSize: 20,
      color: th.fastAccent,
      paddingTop: spacing.xs,
    },

    // ── Sections ────────────────────────────────────────────────────────────
    section: { gap: spacing.md },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: th.design.fontHeading,
      fontSize: 11,
      letterSpacing: 3,
      color: th.accent,
    },
    sectionBody: { gap: spacing.sm },
    reading: {
      fontFamily: th.design.fontHeading,
      fontSize: 20,
      lineHeight: 28,
      color: th.textBody,
      textAlign: 'center',
    },
    commemoration: {
      fontFamily: th.design.fontHeading,
      fontSize: 17,
      lineHeight: 26,
      color: th.textBody,
      textAlign: 'center',
    },
    muted: {
      fontFamily: th.design.fontHeading,
      fontSize: 15,
      color: th.textFaint,
      textAlign: 'center',
    },
    event: { paddingVertical: spacing.xs },
    eventTitle: {
      fontFamily: th.design.fontHeadingStrong,
      fontSize: 17,
      color: th.primary,
      textAlign: 'center',
    },
  }) as const;
