import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ByzantineCalendarEmblem } from './ByzantineCalendarEmblem';

const AnimatedView = Animated.View;

const PARTICLES = [
  { left: '14%', size: 6, delay: 0, duration: 3600 },
  { left: '24%', size: 4, delay: 1200, duration: 4200 },
  { left: '38%', size: 5, delay: 700, duration: 3900 },
  { left: '51%', size: 3, delay: 2000, duration: 3500 },
  { left: '63%', size: 6, delay: 900, duration: 4400 },
  { left: '76%', size: 4, delay: 1500, duration: 4100 },
  { left: '86%', size: 5, delay: 300, duration: 3700 },
] as const;

function useLoop(from: number, to: number, duration: number, delay = 0) {
  const value = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: to,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: from,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [delay, duration, from, to, value]);

  return value;
}

function RisingParticle({ left, size, delay, duration }: (typeof PARTICLES)[number]) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rise, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [delay, duration, rise]);

  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [140, -160],
  });
  const opacity = rise.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 0.85, 0.3, 0],
  });
  const scale = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.2],
  });

  return (
    <AnimatedView
      style={[
        styles.particle,
        {
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

export function ByzantineSplashScreen() {
  const slowOrbit = useRef(new Animated.Value(0)).current;
  const fastOrbit = useRef(new Animated.Value(0)).current;
  const haloPulse = useLoop(0, 1, 2600);
  const emblemFloat = useLoop(0, 1, 3000, 300);
  const textReveal = useRef(new Animated.Value(0)).current;
  const subtitleReveal = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const slowLoop = Animated.loop(
      Animated.timing(slowOrbit, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const fastLoop = Animated.loop(
      Animated.timing(fastOrbit, {
        toValue: 1,
        duration: 11000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const intro = Animated.parallel([
      Animated.timing(textReveal, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleReveal, {
        toValue: 1,
        duration: 800,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1700,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    slowLoop.start();
    fastLoop.start();
    intro.start();

    return () => {
      slowLoop.stop();
      fastLoop.stop();
      intro.stop();
    };
  }, [fastOrbit, progress, slowOrbit, subtitleReveal, textReveal]);

  const slowRotation = slowOrbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const reverseRotation = fastOrbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const haloScale = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.06],
  });
  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.55],
  });
  const emblemTranslateY = emblemFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [4, -6],
  });
  const progressScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 1],
  });
  const titleOpacity = textReveal;
  const titleTranslateY = textReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const subtitleOpacity = subtitleReveal;
  const subtitleTranslateY = subtitleReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const particles = useMemo(
    () => PARTICLES.map((particle, index) => <RisingParticle key={index} {...particle} />),
    [],
  );

  return (
    <View style={styles.container}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="background" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryDeep} />
            <Stop offset="0.45" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.crimson} />
          </LinearGradient>
          <LinearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryDeep} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.primaryDeep} stopOpacity="0.45" />
          </LinearGradient>
          <LinearGradient id="filigree" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.accentPale} stopOpacity="0.12" />
            <Stop offset="0.5" stopColor={colors.accentBright} stopOpacity="0.32" />
            <Stop offset="1" stopColor={colors.accentPale} stopOpacity="0.12" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="100" height="100" fill="url(#background)" />
        <Path d="M0 18 C14 8, 28 8, 42 18 C56 28, 70 28, 84 18 C91 13, 96 11, 100 12 V0 H0 Z" fill={colors.primarySoft} opacity="0.3" />
        <Path d="M0 82 C14 72, 28 72, 42 82 C56 92, 70 92, 84 82 C91 77, 96 75, 100 76 V100 H0 Z" fill={colors.primaryDeep} opacity="0.24" />

        <G opacity="0.18" stroke="url(#filigree)" strokeWidth="0.5" fill="none">
          <Path d="M0 18 H100" />
          <Path d="M0 82 H100" />
          <Path d="M18 0 V100" />
          <Path d="M82 0 V100" />
          <Path d="M8 50 Q16 42 24 50 T40 50 T56 50 T72 50 T88 50" />
        </G>

        <G opacity="0.7" stroke={colors.accentPale} strokeWidth="0.45" fill="none">
          <Path d="M11 14 C17 7, 25 7, 31 14 C37 21, 45 21, 51 14" />
          <Path d="M49 14 C55 7, 63 7, 69 14 C75 21, 83 21, 89 14" />
          <Path d="M11 86 C17 93, 25 93, 31 86 C37 79, 45 79, 51 86" />
          <Path d="M49 86 C55 93, 63 93, 69 86 C75 79, 83 79, 89 86" />
        </G>

        <Rect x="0" y="0" width="100" height="100" fill="url(#veil)" />
      </Svg>

      {particles}

      <AnimatedView style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />

      <AnimatedView style={[styles.ringLayer, { transform: [{ rotate: slowRotation }] }]}>
        <Svg width={360} height={360} viewBox="0 0 360 360">
          <Circle cx="180" cy="180" r="150" fill="none" stroke={colors.accentDim} strokeWidth="1.2" />
          <Circle cx="180" cy="180" r="128" fill="none" stroke={colors.accentLine} strokeWidth="1.1" strokeDasharray="3 9" />
          <Circle cx="180" cy="30" r="4" fill={colors.accentBright} />
          <Circle cx="330" cy="180" r="4" fill={colors.accentBright} />
          <Circle cx="180" cy="330" r="4" fill={colors.accentBright} />
          <Circle cx="30" cy="180" r="4" fill={colors.accentBright} />
        </Svg>
      </AnimatedView>

      <AnimatedView style={[styles.ringLayer, { transform: [{ rotate: reverseRotation }] }]}>
        <Svg width={300} height={300} viewBox="0 0 300 300">
          <G opacity="0.72" stroke={colors.accentPale} strokeWidth="1.2" fill="none" strokeLinecap="round">
            <Path d="M150 18 L150 48" />
            <Path d="M150 282 L150 252" />
            <Path d="M18 150 L48 150" />
            <Path d="M282 150 L252 150" />
            <Path d="M56 56 L76 76" />
            <Path d="M244 244 L224 224" />
            <Path d="M56 244 L76 224" />
            <Path d="M244 56 L224 76" />
          </G>
          <G opacity="0.34" stroke={colors.accentBright} strokeWidth="1" fill="none">
            <Circle cx="150" cy="150" r="102" />
            <Path d="M150 48 C178 84, 214 122, 252 150 C214 178, 178 216, 150 252 C122 216, 86 178, 48 150 C86 122, 122 84, 150 48 Z" />
          </G>
        </Svg>
      </AnimatedView>

      <AnimatedView style={{ transform: [{ translateY: emblemTranslateY }] }}>
        <ByzantineCalendarEmblem size={246} />
      </AnimatedView>

      <View style={styles.textWrap}>
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          ORTHODOX KOREA
        </Animated.Text>
        <Animated.Text
          style={[
            styles.subtitle,
            { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] },
          ]}
        >
          CALENDAR OF FEASTS, FASTS, AND LITURGICAL MEMORY
        </Animated.Text>
      </View>

      <View style={styles.progressTrack}>
        <AnimatedView style={[styles.progressFill, { transform: [{ scaleX: progressScale }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primaryDeep,
  },
  halo: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: colors.accentSubtle,
  },
  ringLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    bottom: 170,
    backgroundColor: colors.accentPale,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  textWrap: {
    marginTop: spacing.xl + spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 360,
  },
  title: {
    color: colors.brandText,
    fontFamily: typography.family.heading,
    fontSize: 30,
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.accentPale,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.95,
  },
  progressTrack: {
    position: 'absolute',
    bottom: spacing.xxl + spacing.xl,
    width: '76%',
    maxWidth: 320,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(240,232,216,0.18)',
  },
  progressFill: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.accentBright,
  },
});
