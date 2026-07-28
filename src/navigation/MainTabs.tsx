import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AnnouncementsScreen } from '../screens/announcements/AnnouncementsScreen';
import { MonthScreen } from '../screens/month/MonthScreen';
import { TodayScreen } from '../screens/today/TodayScreen';
import {
  countUnread,
  useAnnouncementsStore,
} from '../features/announcements/useAnnouncementsStore';
import { useTextScale } from '../hooks/useTextScale';
import { useNetworkStore } from '../store/useNetworkStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** Icon + label band, above the safe-area inset. See the geometry note in MainTabs. */
const TAB_BAR_CONTENT_HEIGHT = 58;
/** How much of iOS's home-indicator inset the bar does NOT reserve. */
const IOS_INSET_TRIM = 10;
/** Ceiling on how far the tab labels follow the text-size setting. */
const LABEL_SCALE_CAP = 1.5;

function TodayIcon({ color, size }: { color: string; size: number }) {
  const day = new Date().getDate();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} fill="none" />
        <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={0.5} fill="none" opacity={0.3} />
      </Svg>
      <Text
        // The number is part of the icon: it is sized from the icon's own `size`
        // and must stay inside the drawn ring, so it does not follow font scale.
        allowFontScaling={false}
        style={{
          position: 'absolute',
          fontFamily: typography.family.heading,
          fontSize: size * 0.42,
          fontWeight: '700',
          color,
          lineHeight: size * 0.5,
        }}
      >
        {day}
      </Text>
    </View>
  );
}

function BellIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c-3.31 0-6 2.69-6 6v3.5l-1.5 3h15l-1.5-3V9c0-3.31-2.69-6-6-6z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={3}
        y={4}
        width={18}
        height={18}
        rx={2}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Path d="M3 9 H21" stroke={color} strokeWidth={1.5} />
      <Path d="M8 2 V6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16 2 V6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      {/* Grid dots */}
      <Circle cx={8} cy={14} r={1.2} fill={color} />
      <Circle cx={12} cy={14} r={1.2} fill={color} />
      <Circle cx={16} cy={14} r={1.2} fill={color} />
      <Circle cx={8} cy={18} r={1.2} fill={color} />
      <Circle cx={12} cy={18} r={1.2} fill={color} />
    </Svg>
  );
}

export function MainTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const unreadCount = useAnnouncementsStore((state) =>
    countUnread(state.announcements, state.lastSeenId),
  );
  // React Navigation renders the tab labels itself, so our ScaledText wrapper
  // never sees them — the label size is applied here instead.
  const textScale = useTextScale();
  const labelFontSize = typography.size.xxs * Math.min(textScale, LABEL_SCALE_CAP);

  // Tab items are TOP-aligned inside the bar (react-navigation gives them
  // `justifyContent: 'flex-start'` plus their own 5pt bottom padding), so ALL
  // leftover height falls below the labels and pushes them away from the screen
  // edge. Two consequences drive the numbers below.
  //
  // 1. Reserving iOS's full 34pt home-indicator inset under a content band that
  //    already ends in that 5pt padding put our labels 10pt higher than Apple's
  //    own tab bars — measured on the same device: stock iOS leaves the label's
  //    last ink ~33pt above the screen edge, ours sat at ~43pt. Trimming the
  //    reserved inset slides the whole band down without touching its internal
  //    geometry, so nothing can start clipping. Android reserves its inset in
  //    full — its bar already sits correctly.
  //
  // 2. The bar must grow with the text size or a large label is clipped, but it
  //    must grow by ONLY what the label gained: scaling the whole band turned the
  //    surplus into slack under the labels and floated them back up (at XXXL they
  //    drifted 13pt). 1.35 over-estimates the line box slightly, which errs
  //    towards a hair more room rather than a clipped descender.
  //
  // 3. While the offline banner is up it renders BELOW the whole navigator and
  //    absorbs the safe area itself, so the tab bar is no longer at the screen
  //    edge — reserving anything there would be pure dead space, floating the
  //    labels up exactly as in (1).
  const isOnline = useNetworkStore((state) => state.isOnline);
  const bottomInset = isOnline
    ? Math.max(insets.bottom - (Platform.OS === 'ios' ? IOS_INSET_TRIM : 0), 0)
    : 0;
  const labelGrowth = Math.ceil((labelFontSize - typography.size.xxs) * 1.35);

  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: TAB_BAR_CONTENT_HEIGHT + labelGrowth + bottomInset,
            paddingBottom: bottomInset,
          },
        ],
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: [styles.tabLabel, { fontSize: labelFontSize }],
        // The size above already accounts for the OS scale (useTextScale), so
        // letting RN multiply it again would compound — and uncapped.
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          tabBarLabel: t('nav.today'),
          tabBarIcon: ({ color, size }) => <TodayIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Month"
        component={MonthScreen}
        options={{
          tabBarLabel: t('nav.month'),
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          tabBarLabel: t('nav.announcements'),
          tabBarIcon: ({ color, size }) => <BellIcon color={color} size={size} />,
          // Cap the badge display so a large backlog stays legible.
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: styles.tabBadge,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.accent,
    paddingTop: 4,
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  tabLabel: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: colors.crimson,
    color: colors.surfaceWhite,
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
  },
});
