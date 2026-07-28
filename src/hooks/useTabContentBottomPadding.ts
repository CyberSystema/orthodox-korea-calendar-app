import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStore } from '../store/useNetworkStore';
import { spacing } from '../theme/spacing';

/**
 * UIKit's tab-bar content height, above the safe-area inset — the same constant
 * react-navigation hard-codes as `TABBAR_HEIGHT_UIKIT`. On iOS 26/27 the visible
 * Liquid Glass capsule is a 62pt pill inside this same 83pt (49 + 34) band, so
 * clearing 49 + inset clears the capsule too.
 */
const UIKIT_TAB_BAR_CONTENT_HEIGHT = 49;

/**
 * Material 3's bottom navigation bar height. MEASURED on a Fairphone 5 (gesture
 * navigation, density 480): the bar occupies exactly the bottom 80dp of the
 * screen. It is added to the safe-area inset rather than assumed to contain it,
 * so a 3-button-navigation device — where the bar sits above a ~48dp system nav
 * bar — still clears. That errs towards a little extra scroll padding rather
 * than content stranded under the bar.
 */
const MATERIAL_BOTTOM_NAV_HEIGHT = 80;

/**
 * Bottom padding for the scrollable content of a TAB screen (Today, Month,
 * Announcements). Root-stack screens pushed over the tabs — Event detail,
 * Announcement detail, Settings — have no tab bar below them and must not use
 * this.
 *
 * The toolbar is native in BOTH appearances, and a native bar does not take
 * layout space away from the screen: on iOS 26+ it is a floating translucent
 * capsule that content scrolls UNDER, and react-native-safe-area-context does
 * NOT account for it — probed on iOS 27, a tab screen still reports
 * `insets.bottom === 34`, the bare home-indicator inset. So every tab screen has
 * to reserve the bar itself, or its last row of content is stranded behind the
 * glass.
 *
 * NOT a double count with `contentInsetAdjustmentBehavior="automatic"`, which the
 * tab screens also set (they need it to clear the native HEADER). Measured on an
 * iOS 27 simulator by scrolling Month to its end: the gap between the last
 * content and the tab bar is 14pt against the 16pt intended here, so `automatic`
 * contributes nothing at the bottom — the native bar is not part of the scroll
 * view's safe area, which is the same reason this hook has to exist at all.
 * Removing `insets.bottom` from the sum would put ~18pt of content back under
 * the bar.
 */
export function useTabContentBottomPadding(): number {
  const insets = useSafeAreaInsets();
  // While the offline banner is up it renders BELOW the whole navigator and
  // absorbs the home-indicator inset itself, so the tab bar is no longer at the
  // screen edge and reserving the inset again would be dead space.
  const isOnline = useNetworkStore((state) => state.isOnline);
  const barHeight =
    Platform.OS === 'ios' ? UIKIT_TAB_BAR_CONTENT_HEIGHT : MATERIAL_BOTTOM_NAV_HEIGHT;

  return (isOnline ? insets.bottom : 0) + barHeight + spacing.lg;
}
