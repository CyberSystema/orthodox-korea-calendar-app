import { colors } from './colors';

/* ═══════════════════════════════════════════════════════════
   THEME TOKENS — the same palette, resolved at RENDER time
   ═══════════════════════════════════════════════════════════ */

/**
 * Why this exists: `StyleSheet.create` runs at IMPORT time, so a palette read
 * directly from `theme/colors` is frozen into the stylesheet before the app
 * knows whether the reader wants light or night. That is the identical trap
 * `typography.size.*` hit for font scaling — see the ScaledText note in
 * CLAUDE.md — and it is solved the same way: resolve at render, through a hook.
 *
 * DELIBERATELY THE SAME KEY NAMES as `theme/colors`. Migrating a screen is then
 * a mechanical `colors.accent` → `t.accent`, with no judgement call per site and
 * no chance of silently changing which colour a rule meant. New semantic tokens
 * are added at the end, where they earn their place.
 *
 * `theme/colors` stays the light palette and remains correct for anything that
 * is NOT rendered through the hook — the native splash, config plugins, the
 * navigation container theme.
 */
const lightBase = {
  ...colors,

  /**
   * Two overrides of the base palette, both measured against the page
   * background #F0E8D8 rather than against a card, because the page is the
   * darker ground and therefore the worst case.
   *
   *   textSecondary #8A7C68 -> 3.34:1, below AA for body text
   *   textFaint     #B0A48E -> 2.02:1, below every threshold
   *
   * These are long-standing values, not new ones, but this app is read by older
   * eyes and the Illuminated direction leans on secondary text far more than the
   * previous layout did.
   *
   * The values carry HEADROOM (5.64:1 and 3.07:1 against a bare page) rather
   * than sitting on 4.5, because this type is composited over BOTH the
   * mandorla's halo and the candle pool, each of which lifts the local ground.
   * Every step of that headroom was measured on the simulator, not assumed: at
   * exactly-4.5 tokens the weekday came out 4.39:1 on screen, and it fell to
   * 4.19:1 again once the candle pool was enabled on this palette.
   */
  textSecondary: '#63594A',
  textFaint: '#8D8372',

  // ── Semantic additions (both themes define these) ──
  /** Page background behind cards. */
  canvas: colors.background,
  /** A card sitting on the canvas. */
  card: colors.surface,
  /** A raised element inside a card (input, pill, preview). */
  cardRaised: colors.surfaceWhite,
  /** Hairline rules and card borders. */
  rule: colors.border,
  /** The wine band: headers, the native header, the splash. */
  brandBand: colors.primaryDeep,
  /** Feast/high-rank emphasis (the crimson date circle). */
  feastAccent: colors.crimson,
  /** Saturday / celebration emphasis. */
  restAccent: colors.blue,
  /** Fasting emphasis. */
  fastAccent: colors.pipFast,
  /**
   * A FILLED wine control — the selected month cell, the staff save button.
   *
   * Split from `primary` because that token is used 18x as a text colour and
   * only 3x as a fill, and the two roles need opposite treatment in the dark:
   * text has to lighten to stay legible on near-black, a fill must stay dark
   * enough for cream text to sit on it.
   */
  fillStrong: colors.primary,
  /**
   * Text that sits ON a gold/pale accent surface — the selected pill, a badge.
   *
   * Split from `primaryDeep` for the same reason `fillStrong` was split from
   * `primary`: that token is 16x a SURFACE (the wine header band) and 10x TEXT,
   * and in the dark the two need opposite treatment. The band must stay deep
   * wine; text on a dark gold pill must go light or it is unreadable.
   */
  onAccent: colors.primaryDeep,
  /**
   * GOLD USED AS TEXT — not the same value as gold used as ornament.
   *
   * `accent` (#B8942E) measures 2.36:1 on the light page background: fine for a
   * hairline rule or a drawn ornament, and a failure for lettering. The
   * Illuminated direction sets far more small type in gold than Refined ever did
   * (the letterspaced weekday, the section labels, the mark captions), which
   * turned a latent palette weakness into a real one — measured at 1.76:1 for
   * "SUNDAY" over the halo.
   *
   * So the two roles are split, exactly as `fillStrong`/`onAccent` split their
   * overloaded tokens. This value clears 4.5:1 against the page background, the
   * worst case, with headroom for the halo AND the candle pool it is drawn over
   * — 5.63:1 on a bare page. In the night palette gold on
   * near-black already measures 9:1, so there it simply stays the bright accent.
   */
  accentText: '#6D581C',
};

/**
 * Every token widened to `string`. Without this the `as const` literals on
 * `colors` would make each key its own literal type (`'#B8942E'`), and the night
 * palette could not assign a different value to it.
 */
export type Theme = { [K in keyof typeof lightBase]: string };

export const lightTheme: Theme = lightBase;

/**
 * NIGHT — a candlelit manuscript, not a mechanical inversion.
 *
 * Two things do not survive flipping the lightness curve, and both are handled
 * explicitly here:
 *   1. WINE goes muddy on black. `primary` is lifted from #5C1414 to #7A2020 and
 *      `crimson` from #8C1B1B to #B33A3A so a feast still reads as red rather
 *      than as a dark smudge.
 *   2. GOLD at #B8942E is too dim against a near-black ground. The dark theme
 *      promotes the brighter gold to the base `accent`, and lifts the rest to
 *      match, so rules and ornament stay visible without glowing.
 *
 * Surfaces are warm brown-blacks rather than neutral greys — the parchment
 * character has to survive the dark, or it stops being this app.
 */
export const nightTheme: Theme = {
  ...lightTheme,
  // Gold on near-black measures 9:1, so the night palette needs no darkened
  // text-gold: the bright accent IS the legible choice there.
  accentText: colors.accentBright,

  // ── Surfaces: warm, not neutral ──
  background: '#14100C',
  backgroundLight: '#1B1610',
  backgroundWarm: '#221C14',
  backgroundDeep: '#0E0B08',
  surface: '#1E1811',
  surfaceWhite: '#241D15',

  // ── Inks: warm off-white, never pure #FFF ──
  textPrimary: '#F2E8D5',
  textBody: '#E4D8C2',
  textSoft: '#C4B69C',
  textSecondary: '#9C8E76',
  textFaint: '#6E6252',
  textGhost: '#4A4136',

  // ── Structure ──
  border: '#3A3126',
  borderLight: '#2C251C',

  // ── Wine ──
  // `primary` is overwhelmingly a TEXT colour, so on near-black it lightens to a
  // rose rather than darkening. The filled-control role moved to `fillStrong`.
  primary: '#E2A8A2',
  fillStrong: '#7A2020',
  onAccent: '#F0DFA8',
  primaryDeep: '#2A0808',
  primarySoft: '#8E2A2A',
  crimson: '#B33A3A',
  crimsonLight: '#C24A4A',
  crimsonTint: 'rgba(179,58,58,0.12)',
  danger: '#B33A3A',

  // ── Gold: promote the brighter values ──
  accent: '#D4AF52',
  accentBright: '#E8C86A',
  accentPale: '#F0DFA8',
  accentDim: 'rgba(212,175,82,0.30)',
  accentGlow: 'rgba(212,175,82,0.10)',
  accentSubtle: 'rgba(212,175,82,0.14)',
  accentLine: 'rgba(212,175,82,0.28)',
  brandText: '#EEDFAE',

  // ── Indicators: lifted for contrast on dark ──
  blue: '#6A9AE8',
  blueTint: 'rgba(106,154,232,0.14)',
  pipFast: '#9A72D8',
  pipLiturgy: '#D4AF52',
  pipPres: '#6A9AE8',
  pipBasil: '#C88448',
  pipEvent: '#6A9AE8',

  // ── Chrome ──
  tabInactive: '#9C8E76',
  tabActive: '#EEDFAE',
  backdropDark: 'rgba(0,0,0,0.60)',

  // ── Semantic re-points ──
  canvas: '#14100C',
  card: '#1E1811',
  cardRaised: '#241D15',
  rule: '#3A3126',
  brandBand: '#2A0808',
  feastAccent: '#B33A3A',
  restAccent: '#6A9AE8',
  fastAccent: '#9A72D8',
};

/**
 * Shadows read as almost nothing on a dark ground — depth there comes from the
 * raised surface being lighter than the canvas, not from a cast shadow. Keep the
 * same keys so a themed stylesheet can spread `t.shadows.warm` either way.
 */
export type ThemeShadows = {
  warm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  lifted: ThemeShadows['warm'];
};

export const lightShadows: ThemeShadows = {
  warm: {
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
};

export const nightShadows: ThemeShadows = {
  warm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 26,
    elevation: 6,
  },
};
