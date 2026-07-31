import { Platform } from 'react-native';

/** Brand name — never translated. */
export const BRAND_TITLE = 'Orthodox Korea';

/**
 * On iPad the PLATFORM owns the top chrome, so the screens must not draw theirs.
 *
 * iPadOS 18+ always renders a UITabBarController's bar at the TOP of the window,
 * and no mode changes that — `tabBarControllerMode: 'tabSidebar'` only adds a
 * sidebar-toggle button beside the same top pill (verified on the iPad Pro 11"
 * simulator, iPadOS 27). That bar lands exactly where each screen draws its own
 * branded ORTHODOX KOREA band, and the two overlap.
 *
 * Rather than stack two bars, iPad gets the native header: the screens skip
 * their branded band and hand the title, Settings and Search to the platform's
 * header instead (each screen sets its own headerLeft/headerRight via
 * `navigation.setOptions`, so the handlers stay local to it).
 *
 * iPhone and Android are untouched — there the toolbar is at the bottom, so the
 * manuscript header has the top of the screen to itself.
 *
 * This lives in its own module rather than in MainTabs because the screens need
 * it and MainTabs imports the screens — importing it back would be a cycle.
 */
export const USES_NATIVE_HEADER = Platform.OS === 'ios' && Platform.isPad;
