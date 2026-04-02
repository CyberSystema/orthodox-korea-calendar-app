import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type ByzantineKnotProps = {
  size?: number;
  color?: string;
};

export function ByzantineKnot({ size = 18, color = '#D4AF52' }: ByzantineKnotProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx={2.5} cy={9} r={1.4} fill={color} />
      <Path d="M6 9 L9 6 L12 9 L9 12 Z" fill="none" stroke={color} strokeWidth={1.3} />
      <Circle cx={15.5} cy={9} r={1.4} fill={color} />
    </Svg>
  );
}
