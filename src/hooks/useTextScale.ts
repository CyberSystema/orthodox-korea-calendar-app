import { useWindowDimensions } from 'react-native';

import { useAppStore } from '../store/useAppStore';
import { effectiveFontScale } from '../theme/fontScale';

/**
 * The multiplier that text is actually rendered at — the in-app Text Size
 * setting combined with the OS font scale and clamped (see theme/fontScale.ts).
 *
 * Only layout that must size a BOX around growing type needs this: the date
 * ring, the tab bar. Plain `<Text>` doesn't — `components/common/ScaledText`
 * already applies the same number.
 */
export function useTextScale(): number {
  const appScale = useAppStore((state) => state.fontScale);
  const { fontScale: osScale } = useWindowDimensions();
  return effectiveFontScale(appScale, osScale);
}
