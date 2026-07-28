/**
 * In-app text size — an accessibility multiplier the reader chooses in Settings,
 * on top of whatever the OS is already doing.
 *
 * WHY an app-level control at all: the OS scale alone is not enough for our
 * readers. Someone on Samsung "Easy Mode" is already at ~1.3 system-wide and
 * still finds the liturgical text small, and raising the system scale further
 * makes every other app unusable for them. This control is scoped to this app.
 *
 * HOW it composes with the OS: multiplicatively, then clamped.
 *
 *     effective = min(appScale * osScale, MAX_TOTAL_FONT_SCALE)
 *
 * `Text` from `components/common/ScaledText` multiplies `fontSize`/`lineHeight`
 * by `appScale` and hands RN a `maxFontSizeMultiplier` of
 * `MAX_TOTAL_FONT_SCALE / appScale`, so the *native* OS multiplication lands on
 * top and the product can never exceed the clamp. The clamp exists because the
 * fixed-geometry parts of the UI (the month grid, the tab bar, the date ring)
 * were only verified to hold together up to 1.8×.
 */
export const FONT_SCALE_STEPS = [1, 1.15, 1.3, 1.5] as const;

export type FontScale = (typeof FONT_SCALE_STEPS)[number];

/** Default is 1 — the OS scale alone, i.e. exactly the pre-setting behaviour. */
export const DEFAULT_FONT_SCALE: FontScale = 1;

/** Hard ceiling on appScale × osScale. Verified on device; see the file header. */
export const MAX_TOTAL_FONT_SCALE = 1.8;

/** Persisted value may be anything (old build, hand-edited store) — snap it back. */
export function normalizeFontScale(raw: string | number | null | undefined): FontScale {
  const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    return DEFAULT_FONT_SCALE;
  }
  return (FONT_SCALE_STEPS as readonly number[]).includes(parsed)
    ? (parsed as FontScale)
    : DEFAULT_FONT_SCALE;
}

/**
 * The multiplier actually applied to a `<Text>`'s fontSize — the app scale and
 * the OS scale combined and clamped. Layout code that must size a *box* around
 * scaling type (the date ring, the tab bar) uses this; plain text does not need
 * it, because ScaledText + `maxFontSizeMultiplier` reproduce the same number.
 */
export function effectiveFontScale(appScale: number, osScale: number): number {
  return Math.min(appScale * osScale, MAX_TOTAL_FONT_SCALE);
}
