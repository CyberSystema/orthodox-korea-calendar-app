import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
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
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

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
  // never sees them — the label size is applied here instead. The bar is a
  // fixed-height box around them, so it has to grow too or the label is clipped;
  // capped at 1.3 so a very large setting doesn't eat the screen.
  const textScale = useTextScale();

  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: Math.round(58 * Math.min(textScale, 1.3)) + insets.bottom,
            paddingBottom: insets.bottom,
          },
        ],
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: [
          styles.tabLabel,
          { fontSize: typography.size.xxs * Math.min(textScale, 1.5) },
        ],
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
