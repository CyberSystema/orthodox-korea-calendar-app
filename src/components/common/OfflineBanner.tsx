import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useNetworkStore } from '../../store/useNetworkStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// A persistent bottom banner shown only while the device is offline. It explains
// that the calendar is being served from the on-device cache and that online-only
// features (event sync, Staff Mode) are paused until the connection returns.
export function OfflineBanner() {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (isOnline) {
    return null;
  }

  return (
    <View
      style={[styles.banner, { paddingBottom: insets.bottom + spacing.sm }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{t('offline.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primaryDeep,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  text: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.brandText,
    textAlign: 'center',
    lineHeight: 18,
  },
});
