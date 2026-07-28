import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AnnouncementDetailScreen } from '../screens/announcements/AnnouncementDetailScreen';
import { EventDetailScreen } from '../screens/event/EventDetailScreen';
import { SecretMenuScreen } from '../screens/secret/SecretMenuScreen';
import { SECRET_MENU_ENABLED } from '../config/features';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { useTextScale } from '../hooks/useTextScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  // Native-stack draws its header title natively, outside our ScaledText — size
  // it here so it follows the reader's setting like the rest of the app.
  const textScale = useTextScale();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDeep },
        headerTitleStyle: {
          fontFamily: typography.family.heading,
          fontSize: typography.size.lg * Math.min(textScale, 1.4),
          color: colors.brandText,
        },
        headerTintColor: colors.brandText,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        // `title` is unused while headerShown is false, but native-stack uses it as the
        // back-button label on pushed screens (Settings, EventDetail) — without it the
        // back button shows the raw route name "MainTabs".
        options={{ headerShown: false, title: t('nav.home') }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: t('nav.eventDetail') }}
      />
      <Stack.Screen
        name="AnnouncementDetail"
        component={AnnouncementDetailScreen}
        options={{ title: t('nav.announcementDetail') }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('nav.settings') }}
      />
      {/* Owner-only secret console: registered ONLY in local sideloads, never in
          EAS/store builds (Apple 2.3.1: no hidden features in the shipped app). */}
      {SECRET_MENU_ENABLED ? (
        <Stack.Screen
          name="SecretMenu"
          component={SecretMenuScreen}
          options={{ title: 'System', headerShown: false }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
