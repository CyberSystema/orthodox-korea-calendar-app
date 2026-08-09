import { useEffect, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
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
import { MAX_LEAF_WIDTH, useLeaf } from '../../theme/useLeaf';
import { Mandorla, OrnamentalRule } from './IlluminatedOrnaments';
import { CandleGlow, GoldLeafNumeral } from './IlluminatedSkia';
import { LITURGICAL_MARKS, LiturgicalMark } from './LiturgicalMark';
import { containsHangul, Text } from './ScaledText';
import { SelectableText } from './SelectableText';

type Props = {
  language: SupportedLanguage;
  dateISO: string;
  liturgicalDay: LiturgicalDay | null;
  events: LiturgicalEvent[];
  labels: {
    readings: string;
    saints: string;
    /** Civil and national days — NOT saints. See `observances` below. */
    celebrations: string;
    events: string;
    noReadings: string;
    /** "Tone" and "Matins Gospel" — real per-commemoration data, not decoration. */
    tone: string;
    matins: string;
    itemReadings: string;
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
/** The numeral's metrics, shared by the plain Text and the gilded overlay so the
 *  two cannot drift apart in size the way they had. */
const NUMERAL_SIZE = 86;
const NUMERAL_LINE_HEIGHT = 96;
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
  // `celebrations` is everything flagged feast OR highRank OR celeb, and `celeb`
  // means a CIVIL day — National Liberation Day, Independence Movement Day. Those
  // are not saints and must never be listed as though they were.
  const observances = useMemo(() => celebrations.filter((c) => c.celeb), [celebrations]);
  const liturgical = useMemo(() => celebrations.filter((c) => !c.celeb), [celebrations]);

  // The ENTRY, not just its title: each commemoration carries its own readings,
  // tone and matins gospel, and an earlier pass rendered only the title — so a
  // day that had plenty to say looked empty. Keep the object.
  //
  // A civil day is the LAST resort for the headline, never the first. Without
  // that ordering, a saint's day that happens to coincide with a national holiday
  // would put the holiday in the illuminated capital and the saint in a list
  // below it.
  const headlineEntry = useMemo(
    () =>
      liturgical.find((c) => c.highRank) ?? liturgical[0] ?? saints[0] ?? observances[0] ?? null,
    [liturgical, saints, observances],
  );
  const headline = headlineEntry ? localized(headlineEntry.title, language) : null;

  // Filtered by identity rather than by title, so two entries that happen to
  // share a title are not both removed.
  const drop = (list: typeof saints) =>
    headlineEntry ? list.filter((c) => c !== headlineEntry) : list;
  const restSaints = useMemo(
    () => drop([...liturgical, ...saints]),
    [liturgical, saints, headlineEntry],
  );
  const restObservances = useMemo(() => drop(observances), [observances, headlineEntry]);

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

  // The halo was 0.72 of the screen with full-length rays, which on a feast took
  // over the page — the same "noisy" failure the grain had. It is ornament behind
  // the figure, not the subject: smaller, and it stops well short of the margins.
  // ONE SCALE FOR THE DRAWN PAGE — see useLeaf. `k` is exactly 1 on every phone
  // by construction, so the phone composition below is arithmetically unchanged.
  //
  //   k   FIGURE  — the numeral, halo, marks, ornament. Pictures grow with the page.
  //   kt  DISPLAY — headings. Grow, but far less, or they shout.
  //   (1) READING — readings and commemorations NEVER scale: the measure is
  //       already bounded, so larger body type only shortens the line. Inflating
  //       body copy is what makes a tablet layout look amateur.
  const leaf = useLeaf();
  const { k, kt, ks, halo } = leaf;
  const fig = (base: number) => Math.round(base * k);
  const disp = (base: number) => Math.round(base * kt);
  //   ks  SPACE — the gaps between blocks.
  //
  // This was computed from the start and then used NOWHERE, which is the single
  // reason the tablet looked wrong in a way no individual element explained: the
  // figures grew 1.88x while every gap stayed within 2pt of the phone's, so the
  // page came out crowded at the top and 364.5pt short at the foot. A drawing
  // that grows inside a rhythm that does not is not a larger composition, it is
  // the same composition with its air squeezed out.
  const sp = (base: number) => Math.round(base * ks);
  const big = k > 1;
  // A LEAF HAS A MEASURE. Letting the page fill an iPad meant a line of type
  // running the better part of 700pt — unreadable — while two thirds of the
  // screen stayed empty, because the composition was designed and judged at
  // phone width. Bound the leaf and centre it, then put the sections side by
  // side once there is room for two of them: the width gets used by CONTENT
  // rather than by stretching the same column.
  const wide = leaf.spread;
  // Gilding is a dark-ground effect and a feast-day one; both conditions in a
  // single value so the Text, its accessibility and the overlay agree.
  // Gilding runs on BOTH palettes; only the metal changes. On near-black, gold
  // leaf is a bright figure with a brighter sheen. On parchment, real gilding is
  // DARKER than the paper and catches a lighter highlight — so the two colours
  // swap roles rather than the effect being dropped, which is what "gold on
  // cream is illegible" actually called for.
  const gilded = isFeast;
  const giltBase = th.isDark ? th.accent : th.accentText;
  const giltHighlight = th.isDark ? th.accentPale : th.accent;
  const capital = headline?.trim()?.[0] ?? '';
  // THE VERSAL IS A RUN OF ONE CHARACTER, so the content-based face rule would
  // decide for that character ALONE — and a Korean title may open with a digit.
  // Real case: 30 June 2026 in Korean is "12사도 연관 축일", whose capital is "1",
  // so the initial took EB Garamond while the rest of its own word took Nanum
  // Myeongjo — two typefaces inside one word.
  //
  // A drop cap belongs to the word it opens, so it follows the WHOLE title's
  // script rather than its own single glyph.
  const headlineKorean = containsHangul(headline ?? '');
  const headlineRest = headline ? headline.trim().slice(1) : '';

  return (
    // Keyed on the date so every entrance animation re-runs when the reader pages
    // to another day — the page is re-written rather than mutated.
    <View
      style={[styles.page, big && { gap: sp(spacing.xl), paddingBottom: sp(spacing.xl) }]}
      key={dateISO}
    >
      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, big && { paddingTop: sp(spacing.xxl), gap: sp(spacing.xs) }]}>
        <Animated.View entering={FadeInDown.duration(DUR)}>
          <Text style={[styles.weekday, big && { fontSize: fig(13), letterSpacing: fig(5) }]}>
            {weekday.toUpperCase()}
          </Text>
        </Animated.View>

        {/* ═══ THE NUMERAL AND ITS LIGHT ═══
            The ornament is CONCENTRIC WITH THE NUMERAL BY CONSTRUCTION. It used
            to hang off the hero at a hand-picked `top: -10`, which meant its
            centre depended on whatever the weekday's line box happened to
            measure — so it drifted with the font, the language and the text
            scale, and the figure sat off-centre inside its own halo.

            Now both light layers absolutely fill THIS box and centre their
            children, so the halo's centre is the numeral's centre by definition.
            They overflow it freely, which is the point: the halo is much larger
            than the figure it haloes.

            The plain Text always renders and always defines the geometry, in
            both palettes. When the figure is gilded the Text turns transparent
            and the Skia canvas is laid over it, centred on the same box — so
            light and dark occupy identical space and the gilded figure lands
            exactly where the plain one would. */}
        <Animated.View style={styles.numeralStack} entering={ZoomIn.delay(STEP).duration(680)}>
          <View style={styles.ornamentLayer} pointerEvents="none" accessible={false}>
            {/* Candlelight on BOTH palettes. It is simply worth less alpha on
                parchment, where the dark palette's value washes the page instead
                of lighting it and lifts the ground under the type inside the
                halo. Tuned against measured contrast, not by eye. */}
            <CandleGlow
              size={halo * 1.35}
              color={th.accent}
              intense={isFeast}
              strength={th.isDark ? 1 : 0.35}
            />
          </View>
          <Animated.View
            style={styles.ornamentLayer}
            pointerEvents="none"
            accessible={false}
            entering={FadeIn.duration(900)}
          >
            <Animated.View style={spinStyle}>
              <Mandorla
                size={halo}
                color={th.accent}
                intense={isFeast}
                rays={isFeast ? 24 : 12}
                wash={th.isDark ? 1 : 0.5}
              />
            </Animated.View>
          </Animated.View>

          <Text
            style={[
              styles.numeral,
              big && { fontSize: fig(NUMERAL_SIZE), lineHeight: fig(NUMERAL_LINE_HEIGHT) },
              gilded ? styles.numeralGilded : { color: heroColor },
            ]}
            allowFontScaling={false}
            accessibilityElementsHidden={gilded}
          >
            {dayNum}
          </Text>

          {/* Gold leaf is light-on-dark by nature: on the parchment palette the
              gilded numeral came out gold on cream and was barely legible — the
              display figure of the whole page, lost. Light writes the figure in
              red instead, which is what a manuscript does on a pale leaf. */}
          {gilded ? (
            <View
              style={styles.ornamentLayer}
              pointerEvents="none"
              accessible
              accessibilityLabel={String(dayNum)}
            >
              <GoldLeafNumeral
                value={String(dayNum)}
                box={{ width: halo, height: fig(NUMERAL_LINE_HEIGHT) * 1.7 }}
                fontSize={fig(NUMERAL_SIZE)}
                base={giltBase}
                highlight={giltHighlight}
                // The gleam is LIGHT catching metal, so its core is paler than
                // the gilt itself. On parchment that is a step of ~131 in
                // luminance against the base rather than ~80, which is the
                // difference between a gleam you see and one you have to look for.
                spark={th.accentPale}
                // A cast shadow has to be the colour of the LEAF in shade, not
                // black: black on parchment reads as dirt. On the night palette
                // the ground is already near-black, so the shadow there is a
                // true darkness and can be stronger without showing a colour.
                shadow={th.isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(74, 54, 20, 0.30)'}
              />
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(STEP * 2).duration(DUR)}>
          <Text style={[styles.monthYear, big && { fontSize: fig(17), letterSpacing: fig(1) }]}>
            {monthYear}
          </Text>
        </Animated.View>
      </View>

      {/* ═══ THE SIX LITURGICAL MARKS ═══
          Drawn LARGE and gilded, not cropped into 22pt circles: these hand-drawn
          marks are the answer to the question people actually open a calendar
          with — does today fast, what may I eat, which liturgy is served. They
          wrap, and each carries its name, because a drawing alone is not an
          answer and a screen reader gets nothing from it. */}
      {marks.length > 0 ? (
        <Animated.View
          style={[styles.marks, big && { paddingTop: sp(spacing.xl), gap: sp(spacing.lg) }]}
          entering={FadeIn.delay(STEP * 2).duration(DUR)}
        >
          {marks.map((mark) => (
            // maxWidth 110 is a fixed box around a drawing that grows with `k`
            // and a label that grows with `kt` — the shape CLAUDE.md warns about.
            // It broke "Divine Liturgy" onto two lines beside a one-line
            // "Fasting", so the row read as ragged rather than as a set.
            <View key={mark.key} style={[styles.mark, big && { maxWidth: fig(110), gap: sp(4) }]}>
              <LiturgicalMark
                source={mark.image}
                size={fig(44)}
                color={mark.key === 'fast' ? th.fastAccent : th.accent}
                label={mark.label}
              />
              <Text
                style={[styles.markLabel, big && { fontSize: disp(12), letterSpacing: disp(0.8) }]}
                numberOfLines={2}
              >
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
          <Text style={[styles.headline, big && { fontSize: disp(24), lineHeight: disp(32) }]}>
            <Text
              style={[
                styles.versal,
                big && { fontSize: disp(38) },
                { color: heroColor },
                headlineKorean ? { fontFamily: th.design.fontKorean } : null,
              ]}
            >
              {capital}
            </Text>
            {headlineRest}
          </Text>
          {headlineEntry ? (
            <View style={styles.headlineMeta}>
              <Meta entry={headlineEntry} labels={labels} style={styles.meta} />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.bands,
          wide && styles.bandsWide,
          big && { gap: sp(spacing.xl), columnGap: sp(spacing.xl) },
        ]}
      >
        {/* ═══ READINGS ═══ */}
        <Band title={labels.readings} delay={STEP * 4} style={wide ? styles.bandColumn : undefined}>
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
        {restSaints.length ? (
          <Band title={labels.saints} delay={STEP * 5} style={wide ? styles.bandColumn : undefined}>
            {restSaints.map((c, i) => (
              <View key={`${c.id}-${i}`} style={styles.commemorationBlock}>
                <SelectableText style={styles.commemoration}>
                  {localized(c.title, language)}
                </SelectableText>
                <Meta entry={c} labels={labels} style={styles.meta} />
              </View>
            ))}
          </Band>
        ) : null}

        {/* ═══ CIVIL OBSERVANCES ═══
            National Liberation Day, Independence Movement Day and the like. They
            belong on the calendar and they are NOT saints, so they get their own
            band rather than being appended to the commemorations — which is what
            the Elegant layout has always done. */}
        {restObservances.length ? (
          <Band
            title={labels.celebrations}
            delay={STEP * 5.5}
            style={wide ? styles.bandColumn : undefined}
          >
            {restObservances.map((c, i) => (
              <View key={`${c.id}-${i}`} style={styles.commemorationBlock}>
                <SelectableText style={styles.commemoration}>
                  {localized(c.title, language)}
                </SelectableText>
                <Meta entry={c} labels={labels} style={styles.meta} />
              </View>
            ))}
          </Band>
        ) : null}

        {/* ═══ PARISH EVENTS ═══ */}
        {events.length ? (
          <Band title={labels.events} delay={STEP * 6} style={wide ? styles.bandColumn : undefined}>
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

      {/* ═══ COLOPHON ═══
          A leaf ends; it does not simply stop. On a sparse day — one name, two
          readings — the page used to run out a third of the way down and leave
          void beneath, which read as unfinished rather than as quiet. A closing
          ornament is how a manuscript actually resolves a page, and it costs no
          invented content: it says nothing, which is exactly why it can sit under
          a day that has little to say. */}
      <Animated.View
        style={styles.colophon}
        entering={FadeIn.delay(STEP * 7).duration(DUR * 1.4)}
        pointerEvents="none"
        accessible={false}
      >
        <OrnamentalRule width={leaf.width * 0.5} color={th.accentDim} scale={k} />
      </Animated.View>
    </View>
  );
}

/**
 * The lines a commemoration carries besides its name: its own appointed
 * readings, its tone, its matins gospel.
 *
 * These exist in the data for most entries and were simply not being rendered,
 * which is a large part of why a day looked empty — the page was showing a title
 * and discarding three fields under it.
 */
function Meta({
  entry,
  labels,
  style,
}: {
  entry: { readings?: string[]; tone?: string; matinsGospel?: string };
  labels: { tone: string; matins: string; itemReadings: string };
  style: object;
}) {
  const lines: string[] = [];
  if (entry.readings?.length) lines.push(`${labels.itemReadings}: ${entry.readings.join(', ')}`);
  if (entry.tone) lines.push(`${labels.tone} ${entry.tone}`);
  if (entry.matinsGospel) lines.push(`${labels.matins} ${entry.matinsGospel}`);
  if (!lines.length) return null;
  return (
    <>
      {lines.map((line) => (
        <SelectableText key={line} style={style}>
          {line}
        </SelectableText>
      ))}
    </>
  );
}

/**
 * A section of the leaf: a RUBRIC and its content.
 *
 * It used to draw an OrnamentalRule of its own, and with three or four sections
 * plus the headpiece and the colophon a single page carried five identical
 * lozenge-and-pips motifs at a near-regular interval. Ornament earns its charge
 * from scarcity; repeated on a fixed pitch it stops being ornament and becomes a
 * border print — and a divider was being asked to do a heading's job, so it
 * carried no meaning either.
 *
 * A manuscript does not divide every section. The page is opened by a headpiece,
 * its parts are marked by RUBRICS — a heading set apart by colour, letterspacing
 * and space — and it is closed by a tailpiece. That is now exactly the structure:
 * the header band above, rubrics here, the colophon at the foot, and no repeated
 * motif in between. The space the rule used to occupy does its separating work
 * instead, which is what space is for.
 *
 * The lozenge survives as a single small mark beside the rubric, so the sections
 * still belong to the same hand as the headpiece without restating it.
 */
function Band({
  title,
  delay,
  style,
  children,
}: {
  title: string;
  delay: number;
  style?: object;
  children: React.ReactNode;
}) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { k, kt, ks } = useLeaf();
  const sp = (base: number) => Math.round(base * ks);
  return (
    <Animated.View
      style={[styles.band, k > 1 && { gap: sp(spacing.md), paddingTop: sp(spacing.lg) }, style]}
      entering={FadeInDown.delay(delay).duration(DUR)}
    >
      <View style={styles.rubric}>
        <RubricMark color={th.accent} size={Math.round(7 * k)} />
        <Text
          style={[
            styles.bandLabel,
            k > 1 && { fontSize: Math.round(11 * kt), letterSpacing: Math.round(4 * kt) },
          ]}
        >
          {title.toUpperCase()}
        </Text>
        <RubricMark color={th.accent} size={Math.round(7 * k)} />
      </View>
      <View style={styles.bandBody}>{children}</View>
    </Animated.View>
  );
}

/** The headpiece's centre lozenge, reduced to a single pip — the same hand at a
 *  quieter volume, and the only ornament a section gets. */
function RubricMark({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8">
      <Path d="M4 0 L8 4 L4 8 L0 4 Z" fill={color} opacity={0.85} />
    </Svg>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    page: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
      // The leaf itself, centred on the desk. 860 keeps the longest reading and
      // the widest saint name on one comfortable line without the measure
      // running away.
      width: '100%',
      maxWidth: MAX_LEAF_WIDTH,
      alignSelf: 'center',
    },
    // Sections stack on a phone and sit two-up on a tablet. minWidth is what
    // makes it fall back to one column rather than crushing both.
    bands: { gap: spacing.xl },
    bandsWide: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      columnGap: spacing.xl,
    },
    bandColumn: { flexGrow: 1, flexBasis: 340, minWidth: 340 },
    pressed: { opacity: 0.6 },

    // ── Hero ────────────────────────────────────────────────────────────────
    hero: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xs },
    weekday: {
      fontFamily: th.design.fontHeading,
      fontSize: 13,
      letterSpacing: 5,
      color: th.accentText,
    },
    numeralStack: { alignItems: 'center', justifyContent: 'center' },
    // Fills the numeral's box and centres whatever it holds, so every light
    // layer is concentric with the figure no matter how large it is.
    ornamentLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numeral: {
      fontFamily: th.design.fontHeading,
      fontSize: NUMERAL_SIZE,
      lineHeight: NUMERAL_LINE_HEIGHT,
    },
    // Transparent, not unmounted: the Text still defines the box the gilded
    // overlay is centred on, so both palettes lay out identically.
    // HIDDEN WITH OPACITY, NOT WITH A TRANSPARENT COLOUR.
    //
    // `color: 'transparent'` hid this on iOS and DID NOT on Android, where the
    // Text kept drawing in the default ink — so a black numeral sat behind the
    // gold one, slightly offset because RN centres a Text by its line box and
    // Skia centres the glyph by its measured bounds. That offset copy is what
    // read as a drop shadow under the date on Android and as nothing at all on
    // iOS.
    //
    // Measured on a Fairphone 5 against an iPhone, same day, same light palette,
    // four frames each: the darkest pixel inside the glyph was 192-253 (a dark
    // gold) on iOS and 0-15 (black) on Android. With `opacity: 0` it is 262 —
    // iOS's own range. Opacity hides the node outright rather than asking the
    // platform to paint invisible ink.
    numeralGilded: { opacity: 0 },
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
    mark: { alignItems: 'center', gap: 4, maxWidth: 110 }, // grows inline — see markBox
    markLabel: {
      fontFamily: th.design.fontBody,
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
      // Centred like everything else on the leaf. It never showed on a phone,
      // where the name fills the measure anyway; at iPad width it sat hard left
      // while the rules and readings above and below it were centred.
      textAlign: 'center',
      flexShrink: 1,
      fontFamily: th.design.fontHeadingStrong,
      fontSize: 24,
      lineHeight: 32,
      color: th.textPrimary,
      // Pulls the first line's cap-height level with the top of the frame.
      paddingTop: 3,
    },

    // Running text is set in the BODY face, display type in the heading face —
    // see DirectionDesign.fontBody for why they are not the same serif.
    // ── Bands ───────────────────────────────────────────────────────────────
    // Generous, because the space IS the separator now. Ornament was doing this
    // job badly; whitespace does it silently.
    band: { gap: spacing.md, alignItems: 'center', paddingTop: spacing.lg },
    rubric: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    bandLabel: {
      fontFamily: th.design.fontHeading,
      fontSize: 11,
      letterSpacing: 4,
      // 11pt letterspaced gold is the smallest type on the page — it needs the
      // text-role gold, not the ornament one. See accentText.
      color: th.accentText,
    },
    bandBody: { gap: spacing.sm, alignSelf: 'stretch' },
    reading: {
      fontFamily: th.design.fontBody,
      fontSize: 21,
      lineHeight: 30,
      color: th.textBody,
      textAlign: 'center',
    },
    colophon: { alignItems: 'center', paddingTop: spacing.md, opacity: 0.55 },
    headlineMeta: { paddingTop: spacing.sm, gap: 2 },
    // A commemoration and its meta are one unit, so the gap between entries is
    // larger than the gap inside one — otherwise the list reads as a flat run of
    // lines with no grouping.
    commemorationBlock: { gap: 2, alignItems: 'center' },
    meta: {
      fontFamily: th.design.fontBody,
      fontSize: 14,
      lineHeight: 21,
      color: th.textSecondary,
      textAlign: 'center',
    },
    commemoration: {
      fontFamily: th.design.fontBody,
      fontSize: 17,
      lineHeight: 26,
      color: th.textBody,
      textAlign: 'center',
    },
    muted: {
      fontFamily: th.design.fontBody,
      fontSize: 15,
      color: th.textFaint,
      textAlign: 'center',
    },
    event: { paddingVertical: spacing.xs },
    eventTitle: {
      fontFamily: th.design.fontBodyStrong,
      fontSize: 17,
      color: th.primary,
      textAlign: 'center',
    },
  }) as const;
