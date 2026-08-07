import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import { Text } from '../../components/common/ScaledText';
import { DIAGNOSTICS_ENABLED } from '../../config/features';
import { DIRECTIONS, DIRECTION_LABELS } from '../../theme/direction';
import { getAppVersionLabel } from '../../utils/appVersion';
import { useAppStore } from '../../store/useAppStore';
import {
  useTheme,
  useThemedStyles,
  type ResolvedTheme,
  THEME_MODES,
  THEME_MODE_LABEL_KEYS,
} from '../../theme/useTheme';
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

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
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
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    fontScale,
    setFontScale,
    launchScreen,
    setLaunchScreen,
    themeMode,
    setThemeMode,
    direction,
    setDirection,
  } = useAppStore();
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);

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
        <OrnamentTitle text={tr('settings.fontSize')} />
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
                accessibilityLabel={tr(FONT_SCALE_LABEL_KEYS[step])}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {tr(FONT_SCALE_LABEL_KEYS[step])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* The preview is really the whole screen — every label re-renders at the
            chosen size the moment a pill is tapped — but a sample line makes the
            effect obvious without scrolling. */}
        <Text style={styles.preview}>{tr('settings.fontSizePreview')}</Text>
      </View>

      {/* ═══ LAUNCH SCREEN ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={tr('settings.launchScreen')} />
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
                accessibilityLabel={tr(LAUNCH_SCREEN_LABEL_KEYS[screen])}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {tr(LAUNCH_SCREEN_LABEL_KEYS[screen])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ═══ APPEARANCE ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={tr('settings.theme')} />
        <View style={styles.pillRow}>
          {THEME_MODES.map((mode) => {
            const selected = themeMode === mode;
            return (
              <Pressable
                key={mode}
                style={({ pressed }) => [
                  styles.pill,
                  selected && styles.pillActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setThemeMode(mode)}
                hitSlop={8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={tr(THEME_MODE_LABEL_KEYS[mode])}
              >
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {tr(THEME_MODE_LABEL_KEYS[mode])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{tr('settings.themeHint')}</Text>
      </View>

      {/* ═══ NOTIFICATIONS ═══ */}
      <View style={styles.card}>
        <OrnamentTitle text={tr('settings.notifications')} />
        <Text style={styles.hint}>{tr('settings.notificationsHint')}</Text>
      </View>

      {/* ═══ DIRECTION TRIAL (owner sideloads only) ═══
          TEMPORARY. Delete this card, theme/direction.ts and the losing
          direction once one is chosen. Switching is live and instant because
          these directions change no navigation option — see direction.ts. */}
      {DIAGNOSTICS_ENABLED ? (
        <View style={styles.card}>
          <OrnamentTitle text="Direction (trial)" />
          <View style={styles.pillRow}>
            {DIRECTIONS.map((d) => {
              const selected = direction === d;
              return (
                <Pressable
                  key={d}
                  style={({ pressed }) => [
                    styles.pill,
                    selected && styles.pillActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setDirection(d)}
                  hitSlop={8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={DIRECTION_LABELS[d]}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                    {DIRECTION_LABELS[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

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
          <Text style={styles.linkText}>{tr('settings.staffEntry')}</Text>
          <ChevronRight color={th.textFaint} />
        </Pressable>

        {DIAGNOSTICS_ENABLED ? (
          <Pressable
            style={({ pressed }) => [styles.linkRow, styles.linkRowLast, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Diagnostics')}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{tr('settings.diagnosticsEntry')}</Text>
            <ChevronRight color={th.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {versionLabel ? (
        <Text style={styles.versionText}>{tr('settings.version', { version: versionLabel })}</Text>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: th.background,
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
      borderColor: th.border,
      backgroundColor: th.surface,
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
      borderColor: th.border,
      borderRadius: radii.full,
      backgroundColor: th.surfaceWhite,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      flexShrink: 1,
    },
    pillActive: {
      borderColor: th.accent,
      backgroundColor: th.accentGlow,
    },
    pillText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.primary,
    },
    pillTextActive: {
      color: th.onAccent,
      fontWeight: typography.weight.semibold,
    },
    preview: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: th.textBody,
      borderLeftWidth: 3,
      borderLeftColor: th.accent,
      backgroundColor: th.surfaceWhite,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    hint: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textSecondary,
      lineHeight: typography.size.sm * 1.5,
    },

    linkGroup: {
      borderWidth: 1,
      borderColor: th.border,
      backgroundColor: th.surface,
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
      borderBottomColor: th.border,
    },
    linkRowLast: {
      borderBottomWidth: 0,
    },
    linkText: {
      flexShrink: 1,
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: th.textPrimary,
    },

    versionText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textFaint,
      textAlign: 'center',
    },
  }) as const;
