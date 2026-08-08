import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { useAppStore } from '../store/useAppStore';
import {
  DIRECTION_DESIGN,
  directionPalette,
  displayDirection,
  type Direction,
  type DirectionDesign,
} from './direction';
import {
  lightShadows,
  lightTheme,
  nightShadows,
  nightTheme,
  type Theme,
  type ThemeShadows,
} from './tokens';

export type ThemeMode = 'light' | 'dark' | 'auto';
export const THEME_MODES = ['auto', 'light', 'dark'] as const satisfies ReadonlyArray<ThemeMode>;
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';

/** i18n keys for the Settings picker, beside the values so they cannot drift. */
export const THEME_MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  auto: 'settings.themeAuto',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

/** A persisted value may be anything (older build, hand-edited store). */
export function normalizeThemeMode(raw: string | null | undefined): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as ThemeMode)
    : DEFAULT_THEME_MODE;
}

export type ResolvedTheme = Theme & {
  /** TEMPORARY: the visual direction being trialled. */
  direction: Direction;
  /** Fonts, ornament flags and geometry for that direction. */
  design: DirectionDesign;
  /** True when the night palette is active — for the odd branch a token can't express. */
  isDark: boolean;
  shadows: ThemeShadows;
};

/**
 * The palette for this render.
 *
 * `auto` follows the OS; an explicit light/dark choice overrides it. The store
 * value is hydrated in the same `set()` that flips `isHydrated` (see
 * useAppStore), so the first painted frame already uses the reader's choice
 * rather than flashing the default.
 */
export function useTheme(): ResolvedTheme {
  const mode = useAppStore((state) => state.themeMode);
  // A tablet is held on Elegant until the tablet composition is finished — see
  // displayDirection. This changes what is DRAWN, never what is stored.
  const direction = displayDirection(useAppStore((state) => state.direction));
  const system = useColorScheme();

  return useMemo(() => {
    const dark = mode === 'dark' || (mode === 'auto' && system === 'dark');
    const base = dark ? nightTheme : lightTheme;
    return {
      ...base,
      // A direction may re-tint the palette it is given. Illuminated does, so
      // that every surface in the app lets the leaf through — see
      // directionPalette for why this belongs here and not in the screens.
      ...directionPalette(direction, base, dark),
      isDark: dark,
      shadows: dark ? nightShadows : lightShadows,
      direction,
      design: DIRECTION_DESIGN[direction],
    };
  }, [mode, system, direction]);
}

/**
 * `StyleSheet.create`, but re-created when the theme changes.
 *
 * Screens move from a module-level
 *
 *     const styles = StyleSheet.create({ card: { backgroundColor: colors.surface } })
 *
 * to
 *
 *     const styles = useThemedStyles((t) => ({ card: { backgroundColor: t.card } }))
 *
 * which is the whole migration: same shape, same keys, resolved per render
 * instead of at import. The result is memoised on the theme identity, so a
 * re-render with an unchanged theme reuses the same StyleSheet and RN's style
 * diffing stays as cheap as it was before.
 *
 * The factory must be a pure function of the theme — anything else (font scale,
 * insets, window size) belongs in an inline style, exactly as it does today.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: ResolvedTheme) => T,
): T {
  const theme = useTheme();
  // The factory is intentionally NOT a dependency: callers pass an inline arrow,
  // which is a new identity every render and would defeat the memo entirely. The
  // theme is the only thing a well-formed factory reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
