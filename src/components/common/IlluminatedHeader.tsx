import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { radii, spacing } from '../../theme/spacing';
import { useTheme, useThemedStyles } from '../../theme/useTheme';
import { ByzantineKnot } from './ByzantineKnot';
import { OrnamentalRule } from './IlluminatedOrnaments';
import { Text } from './ScaledText';

/**
 * The Illuminated direction's HEADPIECE — the band at the top of an illuminated
 * page, in place of the flat wine bar.
 *
 * This exists because the earlier pass changed the day panel but left every
 * screen's chrome identical, which is why the two directions still read as the
 * same app. The header is the first thing seen on every screen, so it is the
 * single highest-leverage surface in the app.
 *
 * Four layers, back to front: a vertical wine gradient (deep at the edges, lit
 * in the middle, so the band has a light source); a slow horizontal sheen that
 * travels across it like light moving over gilt; corner vines; and a gold rule
 * with a centre lozenge closing the band off from the page.
 *
 * PARALLAX IS OPTIONAL. Pass `scrollY` and the band compresses and the sheen
 * settles as the reader scrolls — but every screen works without it, so a screen
 * that has no scroll offset to give simply gets a static headpiece.
 */
export function IlluminatedHeader({
  title,
  topInset,
  onBrandPress,
  left,
  right,
  scrollY,
}: {
  title: string;
  topInset: number;
  onBrandPress?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  scrollY?: SharedValue<number>;
}) {
  const th = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();

  // The sheen. One long, slow pass — at 9 seconds it reads as ambient light
  // rather than as a loading shimmer, which is the difference between "rich"
  // and "busy".
  const sheen = useSharedValue(0);
  sheen.value = withRepeat(
    withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
    -1,
    true,
  );

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-width * 0.6, width * 0.6]) }],
    opacity: interpolate(sheen.value, [0, 0.5, 1], [0.04, 0.12, 0.04]),
  }));

  // Parallax: the band lifts slightly and its ornament fades as the page moves
  // under it, so the header feels like a physical layer rather than a bar.
  const parallaxStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const y = scrollY.value;
    return {
      transform: [{ translateY: interpolate(y, [0, 120], [0, -10], Extrapolation.CLAMP) }],
    };
  });

  const ornamentStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      opacity: interpolate(scrollY.value, [0, 90], [1, 0.25], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={[styles.band, { paddingTop: topInset + spacing.sm }]}>
      <LinearGradient
        // fillStrong, NOT primary: in the night palette `primary` is the
        // text-role wine (#E2A8A2) and using it as a fill washed the band pink.
        // This is the same overload the tokens split apart — see theme/tokens.
        colors={[th.primaryDeep, th.fillStrong, th.primaryDeep]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The travelling sheen, clipped to the band. */}
      <View style={styles.sheenClip} pointerEvents="none" accessible={false}>
        <Animated.View style={[styles.sheen, sheenStyle]}>
          <LinearGradient
            colors={['transparent', th.accentBright, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.row, parallaxStyle]} entering={FadeInDown.duration(520)}>
        <View style={styles.slot}>{left}</View>

        <View style={styles.center}>
          <ByzantineKnot size={13} color={th.accentBright} />
          <Pressable
            style={styles.brandPress}
            onPress={onBrandPress}
            hitSlop={6}
            accessibilityRole="header"
            accessibilityLabel={title}
          >
            <Text style={styles.brand} numberOfLines={1}>
              {title.toUpperCase()}
            </Text>
          </Pressable>
          <ByzantineKnot size={13} color={th.accentBright} />
        </View>

        <View style={styles.slot}>{right}</View>
      </Animated.View>

      {/* The rule that closes the band. Full-bleed, so it reads as the edge of
          the illuminated panel rather than as a divider inside it. */}
      <Animated.View style={[styles.rule, ornamentStyle]} pointerEvents="none" accessible={false}>
        <OrnamentalRule width={width} color={th.accentBright} />
      </Animated.View>
    </View>
  );
}

/** The icon button shape for the headpiece — squarer and gold-ruled. */
export function HeadpieceButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

const createStyles = (th: ReturnType<typeof useTheme>) => ({
  band: {
    overflow: 'hidden' as const,
    paddingBottom: 10,
  },
  sheenClip: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden' as const,
  },
  sheen: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 130,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  slot: { width: 36, alignItems: 'center' as const },
  center: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  brandPress: { flexShrink: 1 },
  brand: {
    color: th.brandText,
    // The headpiece title is SET IN CAPS AND WIDELY LETTERSPACED, which is the
    // one typographic move that most separates a manuscript band from an app bar.
    fontFamily: 'EBGaramond-SemiBold',
    fontSize: 13,
    letterSpacing: 3.4,
    textAlign: 'center' as const,
  },
  rule: { position: 'absolute' as const, left: 0, right: 0, bottom: -2 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: th.accentSubtle,
    borderWidth: 1,
    borderColor: th.accentLine,
  },
  pressed: { opacity: 0.6 },
});
