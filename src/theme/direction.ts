/**
 * The two visual directions being compared before one is chosen.
 *
 * TEMPORARY. Once a direction is picked, the loser and the picker are deleted —
 * this module collapses to whatever won. Nothing outside the theme should branch
 * on `direction` directly; read the design values below instead, so deleting a
 * direction is a change to this file rather than a hunt through screens.
 *
 * SAFE TO SWITCH LIVE, unlike the earlier appearance trial. That one crashed
 * because it toggled `headerShown`, which @react-navigation/bottom-tabs/unstable
 * snapshots and refuses to change on a mounted screen. These directions differ
 * only in colour, type, ornament and geometry — no navigation option changes —
 * so the flip is instant and needs no restart. Keep it that way.
 */
export const DIRECTIONS = ['refined', 'illuminated'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The app as it is today, executed properly — the safe baseline. */
export const DEFAULT_DIRECTION: Direction = 'refined';

export const DIRECTION_LABELS: Record<Direction, string> = {
  refined: 'Refined',
  illuminated: 'Illuminated',
};

export function normalizeDirection(raw: string | null | undefined): Direction {
  return (DIRECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as Direction)
    : DEFAULT_DIRECTION;
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
  refined: {
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
  illuminated: {
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
  if (direction !== 'illuminated') return {};

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
