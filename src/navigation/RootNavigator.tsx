import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { EventDetailScreen } from '../screens/event/EventDetailScreen';
import { SecretMenuScreen } from '../screens/secret/SecretMenuScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDeep },
        headerTitleStyle: {
          fontFamily: typography.family.heading,
          fontSize: typography.size.lg,
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: t('nav.eventDetail') }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('nav.settings') }}
      />
      <Stack.Screen
        name="SecretMenu"
        component={SecretMenuScreen}
        options={{ title: 'System', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
