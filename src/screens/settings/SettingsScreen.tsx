import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import { Text } from '../../components/common/ScaledText';
import { DIAGNOSTICS_ENABLED } from '../../config/features';
import { getAppVersionLabel } from '../../utils/appVersion';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/colors';
import { FONT_SCALE_STEPS, type FontScale } from '../../theme/fontScale';
import { LAUNCH_SCREENS, LAUNCH_SCREEN_LABEL_KEYS } from '../../navigation/launchScreen';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// One label per step. Typed as a total Record so adding a step to
// FONT_SCALE_STEPS fails typecheck here until it gets a label.
const FONT_SCALE_LABEL_KEYS: Record<FontScale, string> = {
  1: 'settings.fontSizeNormal',
  1.15: 'settings.fontSizeLarge',
  1.3: 'settings.fontSizeLarger',
  1.5: 'settings.fontSizeLargest',
};

function ChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={colors.textFaint}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The reader's own preferences — and NOTHING else.
 *
 * This screen is what a parishioner sees, so it deliberately contains no backend
 * state, no sync status, no build metadata and no passcode field. Staff sign-in
 * moved to its own screen behind one quiet row; the owner's diagnostics are
 * behind `DIAGNOSTICS_ENABLED`, so that row does not exist in a store build at
 * all.
 *
 * Layout rule: one idea per card, `spacing.xl` between cards, and hint text only
 * where it prevents a real question. The screen should feel unhurried rather than
 * complete — anything that is merely informative belongs in Diagnostics.
 */
export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale, setFontScale, launchScreen, setLaunchScreen } = useAppStore();

  const versionLabel = getAppVersionLabel();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
      ]}
    >
      <StatusBar style="light" />

      {/* ═══ TEXT SIZE ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={t('settings.fontSize')} />
        <View style={styles.pillRow}>
          {FONT_SCALE_STEPS.map((step) => {
            const selected = fontScale === step;
            return (
              <Pressable
                key={step}
                style={({ pressed }) => [
                  styles.pill,
                  selected && styles.pillActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setFontScale(step)}
                hitSlop={8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(FONT_SCALE_LABEL_KEYS[step])}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {t(FONT_SCALE_LABEL_KEYS[step])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* The preview is really the whole screen — every label re-renders at the
            chosen size the moment a pill is tapped — but a sample line makes the
            effect obvious without scrolling. */}
        <Text style={styles.preview}>{t('settings.fontSizePreview')}</Text>
      </View>

      {/* ═══ LAUNCH SCREEN ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={t('settings.launchScreen')} />
        <View style={styles.pillRow}>
          {LAUNCH_SCREENS.map((screen) => {
            const selected = launchScreen === screen;
            return (
              <Pressable
                key={screen}
                style={({ pressed }) => [
                  styles.pill,
                  selected && styles.pillActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setLaunchScreen(screen)}
                hitSlop={8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(LAUNCH_SCREEN_LABEL_KEYS[screen])}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {t(LAUNCH_SCREEN_LABEL_KEYS[screen])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ═══ NOTIFICATIONS ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={t('settings.notifications')} />
        <Text style={styles.hint}>{t('settings.notificationsHint')}</Text>
      </View>

      {/* ═══ QUIET ENTRIES ═══
          "Parish staff" is the only door to event editing in a store build. It is
          a plain word rather than a hidden gesture so staff can find it without
          being told a trick, and it says nothing that would puzzle a reader who
          opens it out of curiosity. Diagnostics is owner-only and simply absent
          from store builds. */}
      <View style={styles.linkGroup}>
        <Pressable
          style={({ pressed }) => [
            styles.linkRow,
            // In a store build this is the ONLY row, so it must not draw a
            // divider under itself.
            !DIAGNOSTICS_ENABLED && styles.linkRowLast,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.navigate('Staff')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>{t('settings.staffEntry')}</Text>
          <ChevronRight />
        </Pressable>

        {DIAGNOSTICS_ENABLED ? (
          <Pressable
            style={({ pressed }) => [styles.linkRow, styles.linkRowLast, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Diagnostics')}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{t('settings.diagnosticsEntry')}</Text>
            <ChevronRight />
          </Pressable>
        ) : null}
      </View>

      {versionLabel ? (
        <Text style={styles.versionText}>{t('settings.version', { version: versionLabel })}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    // The whole point of this screen is that it breathes: cards are separated by
    // a full 24pt, not the 12pt used inside them.
    gap: spacing.xl,
  },
  pressed: { opacity: 0.7 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexShrink: 1,
  },
  pillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  pillText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  pillTextActive: {
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
  preview: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textBody,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * 1.5,
  },

  linkGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkText: {
    flexShrink: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },

  versionText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
