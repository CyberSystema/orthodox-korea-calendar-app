import { Dimensions, Platform } from 'react-native';

/**
 * The app's two visual designs — what Settings calls the Theme.
 *
 * GILDED is the default: the manuscript leaf, with the gilded numeral, the
 * drawn liturgical marks and the ruled sections. ELEGANT is the earlier layout,
 * kept because it is quieter and some readers will prefer it, and because a
 * design nobody can escape from is a worse design.
 *
 * Nothing outside the theme should branch on `direction` directly; read the
 * design values below instead.
 *
 * SAFE TO SWITCH LIVE, unlike the earlier appearance trial. That one crashed
 * because it toggled `headerShown`, which @react-navigation/bottom-tabs/unstable
 * snapshots and refuses to change on a mounted screen. These directions differ
 * only in colour, type, ornament and geometry — no navigation option changes —
 * so the flip is instant and needs no restart. Keep it that way.
 */
export const DIRECTIONS = ['gilded', 'elegant'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Gilded is what the app looks like unless a reader says otherwise. */
export const DEFAULT_DIRECTION: Direction = 'gilded';

/**
 * TABLETS ARE HELD ON ELEGANT — TEMPORARY, AND MEANT TO BE DELETED.
 *
 * Gilded was drawn for a 393pt phone and it is genuinely good there. On a 1032pt
 * page it is not finished: the wine crown fades over a fraction of the WINDOW, so
 * it overshoots a tablet's shorter band by ~115pt and lays a mauve smear across
 * the leaf; the branded band is 6.6% of a tablet window against 13.9% of a
 * phone's, so the headpiece reads as a strip; and the day navigator's hairlines
 * are flex:1 inside an uncapped row, which flings its two arrows ~900pt apart.
 * (All three measured on an iPad Pro 13" against an iPhone 17, same build.)
 *
 * Elegant has none of those problems, because it never assumed a phone-sized
 * page: it is rows and cards that simply get wider. So until the tablet
 * composition is finished, a tablet gets Elegant and the Theme picker is not
 * offered there — one wrong-looking design is worse than one design.
 *
 * WHEN THE REDESIGN LANDS: delete this constant and the two places that read it
 * (useTheme's `direction` resolution and the Settings Theme card). Nothing else
 * knows about it, which is the point of putting it here.
 *
 * A reader's SAVED CHOICE IS NOT TOUCHED. This overrides what is shown, not what
 * is stored, so someone who picked Gilded on their phone still has Gilded on
 * their phone, and gets it back on the tablet the day this is removed.
 *
 * WHAT COUNTS AS A TABLET: iPadOS answers directly. Android has no such flag, so
 * this uses the conventional 600dp shortest-side threshold — read from `screen`
 * rather than `window`, since a window can be a fraction of the display, and the
 * app is portrait-only on every device so the shortest side is the width.
 */
const { width: screenW, height: screenH } = Dimensions.get('screen');
export const IS_TABLET = Platform.OS === 'ios' ? Platform.isPad : Math.min(screenW, screenH) >= 600;

/** The designs a reader may actually choose on this device. */
export const AVAILABLE_DIRECTIONS: readonly Direction[] = IS_TABLET ? ['elegant'] : DIRECTIONS;

/** What `direction` resolves to for rendering, whatever is stored. */
export function displayDirection(stored: Direction): Direction {
  return IS_TABLET ? 'elegant' : stored;
}

/** i18n keys, beside the values so they cannot drift. */
export const DIRECTION_LABEL_KEYS: Record<Direction, string> = {
  gilded: 'settings.directionGilded',
  elegant: 'settings.directionElegant',
};

/**
 * Names these designs went by while they were an unnamed trial.
 *
 * A phone that has already run this app has one of them written to secure
 * storage. Without this the reader's saved choice would be silently discarded on
 * upgrade — they would open the app one morning and find it had changed its mind.
 */
const LEGACY_NAMES: Record<string, Direction> = {
  illuminated: 'gilded',
  refined: 'elegant',
};

export function normalizeDirection(raw: string | null | undefined): Direction {
  const value = raw ?? '';
  if ((DIRECTIONS as readonly string[]).includes(value)) return value as Direction;
  return LEGACY_NAMES[value] ?? DEFAULT_DIRECTION;
}

/**
 * Font family names as registered with `expo-font` in RootApp.
 *
 * ScaledText remaps the app's two logical roles (heading / body) onto these, so
 * screens keep saying `typography.family.heading` and get the right face for the
 * active direction without a single stylesheet changing.
 *
 * KOREAN IS A SEPARATE FACE. A serif chosen for English has no Hangul, so
 * Korean would silently fall back to the system and look unrelated. Nanum
 * Myeongjo is the matched partner for both directions — it is the classical
 * Korean serif and sits well beside either English face.
 */
export type DirectionDesign = {
  /** Serif for headings, day names, numerals. */
  fontHeading: string;
  /** The same family at its heavier weight, for emphasis. */
  fontHeadingStrong: string;
  /**
   * Body copy. `undefined` keeps the system sans, which stays the most legible
   * choice at small sizes for older readers — Refined does that deliberately.
   *
   * Illuminated sets a serif here so the page reads as a book rather than a
   * screen, but NOT the same serif it uses for display. EB Garamond is an
   * old-style face with high stroke contrast, fine hairlines and a small
   * x-height: superb at 24pt and up, and exactly the wrong thing at 12–17pt for
   * readers with reduced contrast sensitivity, which is most of this app's
   * audience. Spectral was drawn for screen text — larger x-height, sturdier
   * stems, lower contrast — and sits beside Garamond without argument.
   *
   * So the direction keeps Garamond where it is admired (the numeral, the
   * versal, the day's name) and sets Spectral where it is read.
   */
  fontBody?: string;
  /** The body face at its heavier weight, for an event title or a lead-in. */
  fontBodyStrong?: string;
  /** Korean text of any role. */
  fontKorean: string;
  /** Card corner radius — manuscript pages are squarer than app cards. */
  cardRadius: number;
  /**
   * Corner radius for CONTROLS (choice pills, action buttons, tags).
   *
   * One value so every control in the app agrees. Refined keeps the capsule;
   * Illuminated is nearly square, because a rounded chip is the one shape that
   * instantly reads as "app UI" and breaks the illusion of a ruled page. Screens
   * read `th.design.controlRadius` rather than `radii.full`, so a control on a
   * screen nobody has revisited still matches the rest.
   */
  controlRadius: number;
  /** Card border weight. Illuminated draws a gold rule, refined a hairline. */
  cardBorderWidth: number;
  /** Draw the day card's border in gold rather than the neutral rule colour. */
  goldFrame: boolean;
  /** Enlarge the first letter of a commemoration into an illuminated capital. */
  dropCap: boolean;
  /** Ornamental headpiece above high-rank days. */
  headpiece: boolean;
  /** Subtle parchment texture behind the page. */
  texture: boolean;
};

export const DIRECTION_DESIGN: Record<Direction, DirectionDesign> = {
  elegant: {
    fontHeading: 'Spectral',
    fontHeadingStrong: 'Spectral-SemiBold',
    fontKorean: 'NanumMyeongjo',
    fontBody: undefined,
    fontBodyStrong: undefined,
    cardRadius: 14,
    controlRadius: 999,
    cardBorderWidth: 1,
    goldFrame: false,
    dropCap: false,
    headpiece: false,
    texture: false,
  },
  gilded: {
    fontHeading: 'EBGaramond',
    fontHeadingStrong: 'EBGaramond-SemiBold',
    fontKorean: 'NanumMyeongjo',
    fontBody: 'Spectral',
    fontBodyStrong: 'Spectral-SemiBold',
    cardRadius: 4,
    controlRadius: 6,
    cardBorderWidth: 2,
    goldFrame: true,
    dropCap: true,
    headpiece: true,
    texture: true,
  },
};

/**
 * A direction's overrides ON TOP of the light/night palette.
 *
 * ILLUMINATED MAKES ITS SURFACES TRANSLUCENT, and this is the whole reason the
 * hook exists. The app draws one parchment ground per screen
 * (`IlluminatedGround`); if the cards, bars and rows on top of it stayed opaque,
 * the ground would only ever be visible in the gaps between them, and the screen
 * would go back to reading as separate panels pasted onto a page. Making the
 * surfaces let the leaf through — rather than re-styling every box — is what
 * makes an untouched screen blend too, and it is one edit instead of a hunt
 * through twenty stylesheets.
 *
 * The alpha is deliberately high enough (0.72 / 0.62) that body text keeps its
 * contrast: the ground beneath is a low-contrast wash and noise, not imagery, so
 * what shows through changes the material, not the legibility.
 *
 * Refined returns nothing — it is the palette as authored.
 */
export function directionPalette(
  direction: Direction,
  base: Record<string, string>,
  dark: boolean,
): Record<string, string> {
  if (direction !== 'gilded') return {};

  // Deep wine-black on night, warm ink-on-parchment on light.
  const veil = dark ? '18, 10, 10' : '255, 251, 243';
  return {
    surfaceWhite: `rgba(${veil}, 0.72)`,
    surface: `rgba(${veil}, 0.62)`,
    card: `rgba(${veil}, 0.72)`,
    cardRaised: `rgba(${veil}, 0.82)`,
    // THREE RANKS OF RULE, not one.
    //
    // Pointing all three of these at `accentLine` re-tinted every hairline in
    // the app — 43 sites read `border` alone — so a modal divider, a card edge
    // and a section rule were drawn identically and the eye was given no way to
    // tell structure from ornament. Everything gold is the same as nothing gold.
    //
    //   ornament  drawn explicitly in accent/accentBright by the piece that
    //             means it (the headpiece, the ornamental rules, the grid)
    //   edge      a card or control's own outline: warm, clearly subordinate
    //   structure a divider that is merely there: neutral, and it stays neutral
    border: dark ? 'rgba(212,175,82,0.16)' : 'rgba(184,148,46,0.22)',
    borderLight: base.borderLight,
    rule: base.rule,
  };
}
