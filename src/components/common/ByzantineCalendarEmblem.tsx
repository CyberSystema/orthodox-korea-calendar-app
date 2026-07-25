import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';

type ByzantineCalendarEmblemProps = {
  size?: number;
  simplified?: boolean;
};

export function ByzantineCalendarEmblem({
  size = 220,
  simplified = false,
}: ByzantineCalendarEmblemProps) {
  const ringStroke = simplified ? colors.accentPale : colors.accentBright;
  const innerRingStroke = simplified ? colors.accentBright : colors.accentPale;

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Defs>
        <LinearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accentPale} />
          <Stop offset="0.52" stopColor={colors.accentBright} />
          <Stop offset="1" stopColor={colors.accent} />
        </LinearGradient>
        <LinearGradient id="calendarFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.surfaceWhite} />
          <Stop offset="1" stopColor={colors.backgroundWarm} />
        </LinearGradient>
        <LinearGradient id="header" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.primaryDeep} />
          <Stop offset="1" stopColor={colors.crimson} />
        </LinearGradient>
        <LinearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.crimson} />
        </LinearGradient>
      </Defs>

      <G>
        <Circle cx="110" cy="110" r="98" fill="none" stroke="url(#ringGold)" strokeWidth="4" />
        <Circle cx="110" cy="110" r="86" fill="none" stroke={innerRingStroke} strokeWidth="1.8" />

        <G
          opacity={simplified ? 0.75 : 0.92}
          stroke="url(#ringGold)"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M110 18 L110 34" />
          <Path d="M110 186 L110 202" />
          <Path d="M18 110 L34 110" />
          <Path d="M186 110 L202 110" />
        </G>

        {!simplified ? (
          <G opacity="0.9" fill={colors.accentPale}>
            <Circle cx="110" cy="24" r="3.4" />
            <Circle cx="196" cy="110" r="3.4" />
            <Circle cx="110" cy="196" r="3.4" />
            <Circle cx="24" cy="110" r="3.4" />
          </G>
        ) : null}

        <G opacity={simplified ? 0.82 : 1}>
          <Rect x="62" y="66" width="96" height="92" rx="20" fill="url(#calendarFace)" />
          <Rect x="62" y="66" width="96" height="24" rx="20" fill="url(#header)" />
          <Line
            x1="84"
            y1="66"
            x2="84"
            y2="46"
            stroke={colors.accentBright}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Line
            x1="136"
            y1="66"
            x2="136"
            y2="46"
            stroke={colors.accentBright}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Rect x="80" y="102" width="60" height="42" rx="12" fill={colors.surface} />

          <G
            stroke="url(#mark)"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <Path d="M110 108 L110 136" />
            <Path d="M96 122 L124 122" />
            <Path d="M93 150 L104 162 L128 138" stroke={colors.accent} />
          </G>

          <G
            opacity={simplified ? 0.7 : 0.92}
            stroke={ringStroke}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          >
            <Path d="M74 83 C80 76, 86 74, 93 76" />
            <Path d="M126 76 C133 74, 139 76, 145 83" />
          </G>
        </G>
      </G>
    </Svg>
  );
}
