import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { NativeBottomTabIcon } from '@react-navigation/bottom-tabs/unstable';
import { Image, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnnouncementsScreen } from '../screens/announcements/AnnouncementsScreen';
import { MonthScreen } from '../screens/month/MonthScreen';
import { TodayScreen } from '../screens/today/TodayScreen';
import {
  countUnread,
  useAnnouncementsStore,
} from '../features/announcements/useAnnouncementsStore';
import { useAppStore } from '../store/useAppStore';
import { useDayOfMonth } from '../hooks/useDayOfMonth';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../theme/useTheme';
import { typography } from '../theme/typography';
import { BRAND_TITLE, USES_NATIVE_HEADER } from './nativeHeader';
import type { LaunchScreen } from './launchScreen';
import type { MainTabsParamList } from './types';

/**
 * The bottom toolbar is the PLATFORM'S OWN — a real `UITabBarController` on iOS
 * (so it picks up iOS 26+ Liquid Glass automatically) and a Material
 * `BottomNavigationView` on Android. On iPhone and Android everything above it
 * is still the app's own manuscript chrome: each screen draws its branded
 * ORTHODOX KOREA header, which is why `headerShown` is false there.
 *
 * iPAD IS THE EXCEPTION. iPadOS 18+ puts a UITabBarController's bar at the TOP,
 * where it would overlap that branded band, so iPad shows the platform's header
 * instead and the screens skip their own — see `USES_NATIVE_HEADER` in
 * `./nativeHeader`.
 *
 * This replaced a hand-drawn JS tab bar whose vertical geometry had to be
 * derived by measurement (a trimmed iOS inset, a bar that grew by only the
 * label's line-box gain). None of that applies now — the platform owns the
 * bar's height, its safe-area handling and its font scaling — but the trade is
 * that a native bar no longer takes layout space away from the screen. See
 * `useTabContentBottomPadding` for what every tab screen must now reserve.
 *
 * Icons must be given PER PLATFORM: `tabBarIcon` takes a data object, never a
 * component, and react-navigation maps an `sfSymbol` icon to `undefined` on
 * Android — so an SF-Symbol-only config renders NOTHING there. iOS gets symbols
 * for free; Android gets bitmaps from `npm run sync:tab-icons`.
 */
const Tab = createNativeBottomTabNavigator<MainTabsParamList>();

/**
 * '1.circle' … '31.circle' — SF Symbols' own date-in-a-circle, which is how the
 * app's date-ring motif survives into a native bar. Spelled out rather than
 * built with a template string so the SFSymbol literal union still typechecks.
 */
const TODAY_DATE_SYMBOLS = [
  '1.circle',
  '2.circle',
  '3.circle',
  '4.circle',
  '5.circle',
  '6.circle',
  '7.circle',
  '8.circle',
  '9.circle',
  '10.circle',
  '11.circle',
  '12.circle',
  '13.circle',
  '14.circle',
  '15.circle',
  '16.circle',
  '17.circle',
  '18.circle',
  '19.circle',
  '20.circle',
  '21.circle',
  '22.circle',
  '23.circle',
  '24.circle',
  '25.circle',
  '26.circle',
  '27.circle',
  '28.circle',
  '29.circle',
  '30.circle',
  '31.circle',
] as const;

const isIOS = Platform.OS === 'ios';

/**
 * ANDROID ICONS — passed as a DRAWABLE NAME, not as a require().
 *
 * The obvious `source: require('../../assets/tab-icons/today.png')` does not
 * work in a release build. Verified on device: `Image.resolveAssetSource()`
 * returns `{"__packager_asset":true,"width":72,"height":72,"uri":"","scale":1}`
 * — an EMPTY uri. react-native-screens then asks its ResourceIdHelper for that
 * empty name, whose `if (name.isEmpty()) return -1` guard is only checked
 * against `!= 0` by the caller, so it builds `android.resource://<pkg>/-1` and
 * logs "[RNScreens] Error loading image". The tabs render with labels and no
 * icons.
 *
 * The React Native asset pipeline still COPIES these files into the Android
 * drawable folders (android/app/build/generated/res/react/release/drawable-mdpi/
 * assets_tabicons_*.png) as long as something require()s them — hence the
 * require lists below, which exist purely to keep them in the bundle. Handing
 * the tab bar the drawable name instead sends RNScreens down its
 * `getIdentifier(name, "drawable", packageName)` path, which resolves.
 *
 * The name is derived by the asset pipeline from the file's path:
 * `assets/tab-icons/today.png` → `assets_tabicons_today`. MOVING OR RENAMING
 * THESE FILES CHANGES THE NAME — regenerate with `npm run sync:tab-icons` and
 * update the strings here together.
 */
/** One per day of the month — Android's answer to SF Symbols' '1.circle'…'31.circle'. */
const ANDROID_TODAY_ASSETS = [
  require('../../assets/tab-icons/today01.png'),
  require('../../assets/tab-icons/today02.png'),
  require('../../assets/tab-icons/today03.png'),
  require('../../assets/tab-icons/today04.png'),
  require('../../assets/tab-icons/today05.png'),
  require('../../assets/tab-icons/today06.png'),
  require('../../assets/tab-icons/today07.png'),
  require('../../assets/tab-icons/today08.png'),
  require('../../assets/tab-icons/today09.png'),
  require('../../assets/tab-icons/today10.png'),
  require('../../assets/tab-icons/today11.png'),
  require('../../assets/tab-icons/today12.png'),
  require('../../assets/tab-icons/today13.png'),
  require('../../assets/tab-icons/today14.png'),
  require('../../assets/tab-icons/today15.png'),
  require('../../assets/tab-icons/today16.png'),
  require('../../assets/tab-icons/today17.png'),
  require('../../assets/tab-icons/today18.png'),
  require('../../assets/tab-icons/today19.png'),
  require('../../assets/tab-icons/today20.png'),
  require('../../assets/tab-icons/today21.png'),
  require('../../assets/tab-icons/today22.png'),
  require('../../assets/tab-icons/today23.png'),
  require('../../assets/tab-icons/today24.png'),
  require('../../assets/tab-icons/today25.png'),
  require('../../assets/tab-icons/today26.png'),
  require('../../assets/tab-icons/today27.png'),
  require('../../assets/tab-icons/today28.png'),
  require('../../assets/tab-icons/today29.png'),
  require('../../assets/tab-icons/today30.png'),
  require('../../assets/tab-icons/today31.png'),
];

const ANDROID_ICON_ASSETS = {
  month: require('../../assets/tab-icons/month.png'),
  news: require('../../assets/tab-icons/news.png'),
};

/**
 * Dev and release resolve assets differently, and only one of the two paths
 * works in each:
 *   release — the asset is a drawable, and resolveAssetSource returns an EMPTY
 *             uri, so we must pass the drawable name.
 *   dev     — Metro serves the asset over HTTP and NO drawable is written to
 *             res/, so the drawable name would not resolve; the http uri does.
 *
 * OTA CAVEAT: because release resolves these from the APK's drawable folders,
 * CHANGING THE ANDROID TAB ICONS NEEDS A NATIVE BUILD — an `eas update` ships
 * new JS and assets but cannot add a drawable to an already-installed APK, so a
 * renamed or newly-added icon would resolve to nothing on existing installs.
 */
const androidIcon = (drawableName: string, asset: number): NativeBottomTabIcon => {
  if (__DEV__) {
    const resolved = Image.resolveAssetSource(asset);
    if (resolved?.uri) {
      return { type: 'image', source: { uri: resolved.uri } };
    }
  }
  return { type: 'image', source: { uri: `assets_tabicons_${drawableName}` } };
};

const todayIcon = (day: number): NativeBottomTabIcon => {
  return isIOS
    ? { type: 'sfSymbol', name: TODAY_DATE_SYMBOLS[day - 1] }
    : androidIcon(`today${String(day).padStart(2, '0')}`, ANDROID_TODAY_ASSETS[day - 1]);
};

const monthIcon = (): NativeBottomTabIcon =>
  isIOS
    ? { type: 'sfSymbol', name: 'square.grid.3x3' }
    : androidIcon('month', ANDROID_ICON_ASSETS.month);

const newsIcon = (): NativeBottomTabIcon =>
  isIOS ? { type: 'sfSymbol', name: 'bell' } : androidIcon('news', ANDROID_ICON_ASSETS.news);

export function MainTabs() {
  const th = useTheme();
  const { t } = useTranslation();
  // The native tab bar has no `tabBarAllowFontScaling`, so whatever size we pass
  // is scaled AGAIN by the OS. Use the app-only multiplier here or the OS scale
  // is applied twice and the 1.5 cap stops meaning anything.
  const appFontScale = useAppStore((state) => state.fontScale);
  // The Today icon IS the date, so it has to survive midnight.
  const dayOfMonth = useDayOfMonth();
  const unreadCount = useAnnouncementsStore((state) =>
    countUnread(state.announcements, state.lastSeenId),
  );
  // Settings → Launch Screen. Read ONLY on mount, which is why the store commits
  // it in the same set() that flips isHydrated (see navigation/launchScreen.ts).
  const launchScreen: LaunchScreen = useAppStore((state) => state.launchScreen);

  return (
    <Tab.Navigator
      initialRouteName={launchScreen}
      screenOptions={{
        // iPhone/Android: each tab screen draws its own branded ORTHODOX KOREA
        // header, which also carries the Settings entry, and only the toolbar is
        // native. iPad: the tab bar sits at the top and would collide with that
        // band, so the platform's header takes over instead — see
        // USES_NATIVE_HEADER above. The screens set their own headerLeft /
        // headerRight, so the button handlers stay local to them.
        headerShown: USES_NATIVE_HEADER,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: th.primaryDeep },
        headerTintColor: th.brandText,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: typography.family.heading,
          fontSize: typography.size.lg * Math.min(appFontScale, 1.4),
          color: th.brandText,
        },
        tabBarActiveTintColor: th.tabActive,
        // iPadOS 18+ renders a UITabBarController's bar at the TOP, and no mode
        // changes that: 'tabSidebar' only adds a sidebar-toggle button beside the
        // same top pill (verified on the iPad Pro 11" simulator, iPadOS 27).
        // On iPad that bar therefore overlaps each screen's branded header.
        tabBarControllerMode: 'tabBar',
        // Android only — on iOS the option IS honoured, but the system grey is
        // what a UIKit tab bar should use, so it is left alone there.
        tabBarInactiveTintColor: isIOS ? undefined : th.tabInactive,
        // NOTE: `tabBarActiveIndicatorColor` is deliberately not set —
        // @react-navigation/bottom-tabs discards it through an
        // operator-precedence bug and always draws the Android pill as the
        // active tint at 10% alpha. Setting it here would be a lie.
        // Only fontFamily/fontSize/fontWeight/fontStyle/color are honoured here,
        // which is enough to keep the serif voice in the labels.
        tabBarLabelStyle: {
          fontFamily: typography.family.heading,
          fontSize: typography.size.xxs * Math.min(appFontScale, 1.5),
        },
        tabBarBadgeStyle: { backgroundColor: th.crimson, color: th.surfaceWhite },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: t('nav.today'),
          headerTitle: BRAND_TITLE,
          tabBarLabel: t('nav.today'),
          tabBarIcon: todayIcon(dayOfMonth),
        }}
      />
      <Tab.Screen
        name="Month"
        component={MonthScreen}
        options={{
          title: t('nav.month'),
          headerTitle: BRAND_TITLE,
          tabBarLabel: t('nav.month'),
          tabBarIcon: monthIcon(),
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          title: t('announcements.title'),
          // Matches what this screen's own band shows on iPhone: the section
          // name, not the brand.
          headerTitle: t('announcements.title'),
          tabBarLabel: t('nav.announcements'),
          tabBarIcon: newsIcon(),
          // Cap the badge display so a large backlog stays legible.
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
