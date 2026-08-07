import { DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';

import { useTheme } from './useTheme';

/**
 * React Navigation's theme, derived from ours.
 *
 * THE `dark` FLAG IS LOAD-BEARING, not decoration. React Navigation hands it to
 * react-native-screens, which uses it to set the native container's interface
 * style — and that is what decides the material behind NATIVE chrome we do not
 * draw ourselves: the iOS 26 Liquid Glass tab bar and the native header.
 *
 * Hard-coding `DefaultTheme` (which is `dark: false`) therefore left the tab bar
 * rendering a LIGHT glass capsule while every JS-drawn surface went dark, and the
 * active tab's cream label became nearly invisible on it. Nothing in our own
 * stylesheets could have fixed that: the bar is UIKit's, not ours.
 */
export function useNavigationTheme(): NavTheme {
  const th = useTheme();
  const base = th.isDark ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: th.isDark,
    colors: {
      ...base.colors,
      background: th.canvas,
      card: th.card,
      text: th.textPrimary,
      border: th.rule,
      primary: th.primary,
      notification: th.accent,
    },
  };
}
