import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { IlluminatedGround } from '../../components/common/IlluminatedGround';
import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import { Text } from '../../components/common/ScaledText';
import { DIAGNOSTICS_ENABLED, SECRET_MENU_ENABLED } from '../../config/features';
import { useOwnerSurfaces } from '../../config/ownerSurfaces';
import { DIRECTIONS, DIRECTION_LABEL_KEYS } from '../../theme/direction';
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
 * A row of mutually exclusive choices.
 *
 * Every preference on this screen is the same shape, and it was written out
 * three times with only the option list changing. One component means the pills
 * cannot drift apart in padding, wrap behaviour or accessibility — the last of
 * which is the one that silently rots when markup is copied.
 */
function Choice<T extends string | number>({
  options,
  selected,
  onSelect,
  label,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  label: (value: T) => string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const isOn = option === selected;
        return (
          <Pressable
            key={String(option)}
            style={({ pressed }) => [
              styles.pill,
              isOn && styles.pillActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onSelect(option)}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={label(option)}
          >
            <Text style={[styles.pillText, isOn && styles.pillTextActive]}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A quiet heading over a cluster of cards.
 *
 * The screen was a flat run of five near-identical cards, which gives a reader
 * no way to skim: everything looked equally important because everything was
 * drawn the same. Two groups — how the page looks, and what the app does — put
 * one level of structure above the cards without adding a single control.
 *
 * Deliberately quieter than a card's own title: it is a signpost, not a heading
 * competing with the ornamented ones beneath it.
 */
function GroupLabel({ text }: { text: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.groupLabel}>{text.toUpperCase()}</Text>;
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
    setPreviewPublic,
  } = useAppStore();
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ownerSurfaces = useOwnerSurfaces();

  const versionLabel = getAppVersionLabel();

  return (
    <>
      {/* The leaf continues onto pushed screens. A Fragment sibling, not a
          child: these roots are ScrollViews, and a ground inside one would
          scroll away. absoluteFill then resolves against the navigator's own
          screen container, which fills the window. */}
      {th.direction === 'gilded' ? <IlluminatedGround crown={false} /> : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
        ]}
      >
        <StatusBar style="light" />

        {/* ═══ READING — how the page looks ═══ */}
        <GroupLabel text={tr('settings.groupReading')} />

        <View style={styles.card}>
          <OrnamentTitle text={tr('settings.fontSize')} />
          <Choice
            options={FONT_SCALE_STEPS}
            selected={fontScale}
            onSelect={setFontScale}
            label={(step) => tr(FONT_SCALE_LABEL_KEYS[step])}
          />
          {/* The preview is really the whole screen — every label re-renders at
              the chosen size the moment a pill is tapped — but a sample line
              makes the effect obvious without scrolling. */}
          <Text style={styles.preview}>{tr('settings.fontSizePreview')}</Text>
        </View>

        <View style={styles.card}>
          <OrnamentTitle text={tr('settings.theme')} />
          <Choice
            options={THEME_MODES}
            selected={themeMode}
            onSelect={setThemeMode}
            label={(mode) => tr(THEME_MODE_LABEL_KEYS[mode])}
          />
          <Text style={styles.hint}>{tr('settings.themeHint')}</Text>
        </View>

        {/* ═══ THEME ═══
            EVERY reader sees this, not just the owner. Gilded is the default, and
            a default nobody can escape from is not a default — it is an
            imposition. Some readers will want the quieter layout, and older eyes
            in particular may simply find it easier. */}
        <View style={styles.card}>
          <OrnamentTitle text={tr('settings.direction')} />
          <Choice
            options={DIRECTIONS}
            selected={direction}
            onSelect={setDirection}
            label={(d) => tr(DIRECTION_LABEL_KEYS[d])}
          />
          <Text style={styles.hint}>{tr('settings.directionHint')}</Text>
        </View>

        {/* ═══ BEHAVIOUR — what the app does ═══ */}
        <GroupLabel text={tr('settings.groupBehaviour')} />

        <View style={styles.card}>
          <OrnamentTitle text={tr('settings.launchScreen')} />
          <Choice
            options={LAUNCH_SCREENS}
            selected={launchScreen}
            onSelect={setLaunchScreen}
            label={(screen) => tr(LAUNCH_SCREEN_LABEL_KEYS[screen])}
          />
        </View>

        {/* Notifications were a title and a sentence with nothing to press — a
            card that told the reader to go somewhere else and then made them
            find it. It takes them there. */}
        <View style={styles.card}>
          <OrnamentTitle text={tr('settings.notifications')} />
          <Text style={styles.hint}>{tr('settings.notificationsHint')}</Text>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{tr('settings.notificationsOpen')}</Text>
          </Pressable>
        </View>

        <View style={styles.linkGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.linkRow,
              // In a store build this is the ONLY row, so it must not draw a
              // divider under itself.
              !ownerSurfaces && styles.linkRowLast,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Staff')}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{tr('settings.staffEntry')}</Text>
            <ChevronRight color={th.textFaint} />
          </Pressable>

          {ownerSurfaces ? (
            <Pressable
              style={({ pressed }) => [
                styles.linkRow,
                styles.linkRowLast,
                pressed && styles.pressed,
              ]}
              onPress={() => navigation.navigate('Diagnostics')}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>{tr('settings.diagnosticsEntry')}</Text>
              <ChevronRight color={th.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {/* THE WAY BACK OUT OF PREVIEW MODE.
            Preview hides Diagnostics, which is where the toggle lives, so
            without this the owner would have to reinstall to get their own build
            back. A long press on the version string restores it — invisible to a
            parishioner, and inert in a public build because SECRET_MENU_ENABLED
            folds to false there. */}
        {versionLabel ? (
          <Pressable
            onLongPress={() => {
              if (!SECRET_MENU_ENABLED) return;
              setPreviewPublic(false);
            }}
            delayLongPress={900}
            accessibilityRole="text"
          >
            <Text style={styles.versionText}>
              {tr('settings.version', { version: versionLabel })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: th.direction === 'gilded' ? 'transparent' : th.background,
      // Transparent under Illuminated: the ground is a sibling BEHIND this
      // scroll view, so an opaque background here would paint over the leaf.
    },
    content: {
      padding: spacing.lg,
      // The whole point of this screen is that it breathes: cards are separated by
      // a full 24pt, not the 12pt used inside them.
      gap: spacing.xl,
    },
    pressed: { opacity: 0.7 },

    // A signpost over a cluster, deliberately quieter than the cards' own
    // ornamented titles so it reads as one level up rather than as competition.
    groupLabel: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xxs,
      letterSpacing: 2.2,
      // textSecondary, not textFaint: this is 11pt letterspaced type, which needs
      // AA like any other reading text. textFaint measures 3.07:1 on the page and
      // is for ornament and version strings, not labels a reader must parse.
      color: th.textSecondary,
      // Clears the header band's own gradient, which the first label ran into.
      marginTop: spacing.md,
      marginBottom: -spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    // A card's own call to action: ruled, not filled, so it never outweighs the
    // preference pills above it.
    action: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: th.design.controlRadius,
      borderWidth: 1,
      borderColor: th.accentLine,
    },
    actionText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.xs,
      color: th.accentText,
      letterSpacing: 0.4,
    },
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
      borderRadius: th.design.controlRadius,
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
