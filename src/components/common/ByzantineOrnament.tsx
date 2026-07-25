import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type ByzantineOrnamentProps = {
  width?: number;
  height?: number;
  color?: string;
};

export function ByzantineOrnament({
  width = 96,
  height = 16,
  color = '#B8942E',
}: ByzantineOrnamentProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 96 16">
      <Path d="M2 8 H30" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M66 8 H94" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={34} cy={8} r={2.3} fill={color} opacity={0.9} />
      <Path d="M42 8 L48 2 L54 8 L48 14 Z" fill="none" stroke={color} strokeWidth={1.2} />
      <Circle cx={62} cy={8} r={2.3} fill={color} opacity={0.9} />
    </Svg>
  );
}
