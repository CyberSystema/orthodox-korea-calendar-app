import { useEffect, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { LiturgicalDay, LiturgicalEvent } from '../../features/calendar/types';
import { localized } from '../../features/calendar/types';
import type { SupportedLanguage } from '../../types/language';
import { spacing } from '../../theme/spacing';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { Mandorla, OrnamentalRule } from './IlluminatedOrnaments';
import { CandleGlow, GoldLeafNumeral } from './IlluminatedSkia';
import { LITURGICAL_MARKS, LiturgicalMark } from './LiturgicalMark';
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
    // The six liturgical marks. Required — see the marks band below.
    fast: string;
    cheese: string;
    fish: string;
    pres: string;
    basil: string;
    dl: string;
  };
  onEventPress?: (event: LiturgicalEvent) => void;
};

/** Entrance timings. Each band arrives just after the one above it, so the page
 *  assembles downward like a leaf being written rather than all at once. */
const STEP = 90;
const DUR = 520;

/**
 * THE DAY AS AN ILLUMINATED LEAF.
 *
 * This is not the default panel restyled — it is a different composition, and
 * the ornament is drawn rather than implied:
 *
 *   A MANDORLA behind the date, the almond of light Byzantine work puts behind a
 *   holy figure. Its rays only appear when the day is a feast, and on a great
 *   feast it turns slowly — so rank is something you SEE before you read.
 *
 *   AN ILLUMINATED CAPITAL opens the day's principal commemoration, framed in a
 *   gold lattice like a decorated initial.
 *
 *   RULED BANDS with lozenge dividers instead of hairlines, corner vines framing
 *   the leaf, and a parchment tooth over the whole page so the flat areas do not
 *   read as plastic.
 *
 *   MOTION that assembles the page downward on arrival, and re-runs when the day
 *   changes — keyed on the date, so paging through days feels like turning
 *   leaves.
 *
 * Every ornament is pointer-transparent and hidden from assistive tech; none of
 * it sits between the reader and the text. The numeral opts out of text scaling
 * because it is a display figure inside a fixed composition — the reader's size
 * setting governs the content beneath it.
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
  const { width } = useWindowDimensions();

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

  const pick = <T,>(ko: T | undefined, en: T | undefined, fallback: T): T =>
    (language === 'ko' ? ko : en) ?? fallback;

  const celebrations = pick(
    liturgicalDay?.celebrationsLocalized?.ko,
    liturgicalDay?.celebrationsLocalized?.en,
    liturgicalDay?.celebrations ?? [],
  );
  const saints = pick(
    liturgicalDay?.saintsLocalized?.ko,
    liturgicalDay?.saintsLocalized?.en,
    liturgicalDay?.saints ?? [],
  );
  const readings = pick(
    liturgicalDay?.readingsLocalized?.ko,
    liturgicalDay?.readingsLocalized?.en,
    liturgicalDay?.readings ?? [],
  );

  // One focal point: a high-rank entry, else the first celebration, else the
  // first saint. It is then removed from the list so it is never said twice.
  const headline = useMemo(() => {
    const ranked = celebrations.find((c) => c.highRank) ?? celebrations[0] ?? saints[0];
    return ranked ? localized(ranked.title, language) : null;
  }, [celebrations, saints, language]);

  const rest = useMemo(() => {
    const all = [...celebrations, ...saints];
    return headline ? all.filter((c) => localized(c.title, language) !== headline) : all;
  }, [celebrations, saints, headline, language]);

  const isFeast = celebrations.some((c) => c.highRank);
  const isFast = Boolean(liturgicalDay?.fast);

  // THE SIX LITURGICAL MARKS. These are not decoration — they are what a reader
  // checks the calendar FOR: whether the day fasts, what it permits, and which
  // liturgy is served. An earlier pass of this composition reduced all six to a
  // single dagger, which silently dropped divine liturgy, St Basil, fish, cheese
  // and presanctified. Never do that again.
  const marks = useMemo(() => {
    if (!liturgicalDay) return [];
    return LITURGICAL_MARKS.filter((m) => Boolean(liturgicalDay[m.flag])).map((m) => ({
      ...m,
      label: labels[m.key],
    }));
  }, [liturgicalDay, labels]);
  const heroColor = isFeast || isSunday ? th.feastAccent : th.textPrimary;

  // The mandorla turns only on a great feast — a whole degree of ceremony the
  // app previously expressed as a coloured dot. One slow rotation, never fast
  // enough to distract from reading.
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = 0;
    if (!isFeast) return;
    spin.value = withRepeat(withTiming(1, { duration: 64000, easing: Easing.linear }), -1, false);
  }, [isFeast, spin]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // A soft tick when the day changes — turning a leaf should be felt, not only
  // seen. Selection-strength, so it never feels like an alert.
  useEffect(() => {
    void Haptics.selectionAsync().catch(() => {});
  }, [dateISO]);

  const halo = Math.min(width * 0.72, 300);
  const capital = headline?.trim()?.[0] ?? '';
  const headlineRest = headline ? headline.trim().slice(1) : '';

  return (
    // Keyed on the date so every entrance animation re-runs when the reader pages
    // to another day — the page is re-written rather than mutated.
    <View style={styles.page} key={dateISO}>
      {/* ═══ HERO ═══ */}
      <View style={styles.hero}>
        {/* Three stacked light layers: a wide candle pool, the turning mandorla,
            and the gilded figure itself. */}
        <View style={styles.glow} pointerEvents="none" accessible={false}>
          <CandleGlow size={halo * 1.35} color={th.accent} intense={isFeast} />
        </View>
        <Animated.View
          style={[styles.halo, spinStyle]}
          pointerEvents="none"
          accessible={false}
          entering={FadeIn.duration(900)}
        >
          <Mandorla size={halo} color={th.accent} intense={isFeast} rays={isFeast ? 24 : 12} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(DUR)}>
          <Text style={styles.weekday}>{weekday.toUpperCase()}</Text>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(STEP).duration(680)}>
          {/* On a feast the numeral is GILDED: a Skia specular band travels across
              the glyph, which is what makes gold read as metal rather than as
              yellow paint. Ordinary days keep plain type — the gilding has to
              mean something. */}
          {isFeast ? (
            <View accessible accessibilityLabel={String(dayNum)}>
              <GoldLeafNumeral
                value={String(dayNum)}
                size={{ width: halo, height: 120 }}
                fontSize={96}
                base={th.accent}
                highlight={th.accentPale}
              />
            </View>
          ) : (
            <Text style={[styles.numeral, { color: heroColor }]} allowFontScaling={false}>
              {dayNum}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(STEP * 2).duration(DUR)}>
          <Text style={styles.monthYear}>{monthYear}</Text>
        </Animated.View>
      </View>

      {/* ═══ THE SIX LITURGICAL MARKS ═══
          Drawn LARGE and gilded, not cropped into 22pt circles: these hand-drawn
          marks are the answer to the question people actually open a calendar
          with — does today fast, what may I eat, which liturgy is served. They
          wrap, and each carries its name, because a drawing alone is not an
          answer and a screen reader gets nothing from it. */}
      {marks.length > 0 ? (
        <Animated.View style={styles.marks} entering={FadeIn.delay(STEP * 2).duration(DUR)}>
          {marks.map((mark) => (
            <View key={mark.key} style={styles.mark}>
              <LiturgicalMark
                source={mark.image}
                size={44}
                color={mark.key === 'fast' ? th.fastAccent : th.accent}
                label={mark.label}
              />
              <Text style={styles.markLabel} numberOfLines={2}>
                {mark.label}
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* ═══ THE DAY'S NAME, WITH A RAISED INITIAL ═══
          The initial is INLINE — a nested Text — not a framed box beside the
          name. A box cannot be wrapped around in React Native (there is no
          float), so the remainder started a new column and "A  imilianos" read
          as a typo rather than as an illuminated capital. Nested Text keeps the
          letter in the text flow, so the name wraps as one word at any font
          scale, and it stays correct in Korean, where the initial is a whole
          syllable block rather than a broken letter.

          Plain Text, not SelectableText: this is a heading, and headings are
          deliberately outside the selection surface (see SelectableText). */}
      {headline ? (
        <Animated.View entering={FadeInDown.delay(STEP * 3).duration(DUR)}>
          <Text style={styles.headline}>
            <Text style={[styles.versal, { color: heroColor }]}>{capital}</Text>
            {headlineRest}
          </Text>
        </Animated.View>
      ) : null}

      {/* ═══ READINGS ═══ */}
      <Band title={labels.readings} delay={STEP * 4} width={width}>
        {readings.length ? (
          readings.map((r) => (
            <SelectableText key={r} style={styles.reading}>
              {r}
            </SelectableText>
          ))
        ) : (
          <Text style={styles.muted}>{labels.noReadings}</Text>
        )}
      </Band>

      {/* ═══ COMMEMORATIONS ═══ */}
      {rest.length ? (
        <Band title={labels.saints} delay={STEP * 5} width={width}>
          {rest.map((c, i) => (
            <SelectableText key={`${c.id}-${i}`} style={styles.commemoration}>
              {localized(c.title, language)}
            </SelectableText>
          ))}
        </Band>
      ) : null}

      {/* ═══ PARISH EVENTS ═══ */}
      {events.length ? (
        <Band title={labels.events} delay={STEP * 6} width={width}>
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
        </Band>
      ) : null}
    </View>
  );
}

/** A ruled band: ornamental divider, letterspaced label, then its content. */
function Band({
  title,
  delay,
  width,
  children,
}: {
  title: string;
  delay: number;
  width: number;
  children: React.ReactNode;
}) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Animated.View style={styles.band} entering={FadeInDown.delay(delay).duration(DUR)}>
      <View pointerEvents="none" accessible={false}>
        <OrnamentalRule width={width - spacing.lg * 2} color={th.accent} />
      </View>
      <Text style={styles.bandLabel}>{title.toUpperCase()}</Text>
      <View style={styles.bandBody}>{children}</View>
    </Animated.View>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    page: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },
    pressed: { opacity: 0.6 },

    // ── Hero ────────────────────────────────────────────────────────────────
    hero: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xs },
    halo: { position: 'absolute', top: -10, alignItems: 'center', justifyContent: 'center' },
    glow: { position: 'absolute', top: -60, alignItems: 'center', justifyContent: 'center' },
    weekday: {
      fontFamily: th.design.fontHeading,
      fontSize: 13,
      letterSpacing: 5,
      color: th.accent,
    },
    numeral: {
      fontFamily: th.design.fontHeading,
      fontSize: 86,
      lineHeight: 96,
    },
    monthYear: {
      fontFamily: th.design.fontHeading,
      fontSize: 17,
      letterSpacing: 1,
      color: th.textSecondary,
    },
    // A mark and its name are one unit; the row wraps rather than shrinking, so
    // a long Korean label never squeezes the drawing.
    marks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.lg,
      // Clear of the mandorla's rays, which reach below the numeral — without
      // this the first row of marks sits inside the halo and reads as clutter.
      paddingTop: spacing.xl,
    },
    mark: { alignItems: 'center', gap: 4, maxWidth: 110 },
    markLabel: {
      fontFamily: th.design.fontHeading,
      fontSize: 12,
      letterSpacing: 0.8,
      color: th.textSecondary,
      textAlign: 'center',
      flexShrink: 1,
    },
    fastMark: {
      fontFamily: th.design.fontHeading,
      fontSize: 22,
      color: th.fastAccent,
    },

    // ── Illuminated capital + headline ──────────────────────────────────────
    versal: {
      fontFamily: th.design.fontHeadingStrong,
      // Roughly 1.6× the headline — large enough to read as an initial, small
      // enough that it never forces the first line taller than the rest.
      fontSize: 38,
    },
    headline: {
      flexShrink: 1,
      fontFamily: th.design.fontHeadingStrong,
      fontSize: 24,
      lineHeight: 32,
      color: th.textPrimary,
      // Pulls the first line's cap-height level with the top of the frame.
      paddingTop: 3,
    },

    // ── Bands ───────────────────────────────────────────────────────────────
    band: { gap: spacing.sm, alignItems: 'center' },
    bandLabel: {
      fontFamily: th.design.fontHeading,
      fontSize: 11,
      letterSpacing: 4,
      color: th.accent,
    },
    bandBody: { gap: spacing.sm, alignSelf: 'stretch' },
    reading: {
      fontFamily: th.design.fontHeading,
      fontSize: 21,
      lineHeight: 30,
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
