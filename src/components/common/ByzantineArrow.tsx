import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * Byzantine manuscript-style navigation glyph.
 *
 * Inspired by Byzantine calligraphic marginal markers (diplai) and the
 * ornamental arm terminals found in Byzantine metalwork crosses.
 *
 * Shape anatomy (left arrow):
 *   - Two calligraphic wings taper from a thick right opening to a sharp left tip.
 *   - Circular knob terminations at each right wing-end (cross arm decoration).
 *   - A small jewel circle nestled in the fork of the notch between the wings.
 *   - A fine accent dot pressed at the pointed tip.
 */
interface ByzantineArrowProps {
  direction: 'left' | 'right';
  size?: number;
  color?: string;
}

export const ByzantineArrow: React.FC<ByzantineArrowProps> = ({
  direction,
  size = 20,
  color = '#B8942E',
}) => {
  /*
   * LEFT ARROW — viewBox 0 0 24 24
   *
   * Outer arms: both outer bezier curves arc from the right wing terminals
   *   to the sharp left tip at (5, 12).
   * Inner arms: bezier curves from the inner fork junction at (8, 12) back
   *   to the inner right edges at y=6 and y=18.
   * The Z close-path draws the 2px vertical gap on the right between (18,6)
   *   and (18,4), and likewise (18,18)→(18,20) — these are the wing "slits"
   *   that give the calligraphic bifurcated feel.
   */
  const leftPath =
    'M 18,4 C 12,7 8,10 5,12 C 8,14 12,17 18,20 L 18,18 C 13,15.5 9.5,13.5 8,12 C 9.5,10.5 13,8.5 18,6 Z';

  /*
   * RIGHT ARROW — horizontal mirror of left across x=12.
   */
  const rightPath =
    'M 6,4 C 12,7 16,10 19,12 C 16,14 12,17 6,20 L 6,18 C 11,15.5 14.5,13.5 16,12 C 14.5,10.5 11,8.5 6,6 Z';

  const isLeft = direction === 'left';
  const path = isLeft ? leftPath : rightPath;

  // Wing terminal knobs: outer corners of each arm end.
  const termX = isLeft ? 18 : 6;
  // Sharp tip accent.
  const tipX = isLeft ? 5 : 19;
  // Jewel in the fork notch (sits just beyond the bifurcation in the open air).
  const notchX = isLeft ? 20.5 : 3.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Main calligraphic body */}
      <Path d={path} fill={color} />

      {/* Knob terminations at each wing tip — Byzantine cross arm ornaments */}
      <Circle cx={termX} cy={4} r={1.9} fill={color} />
      <Circle cx={termX} cy={20} r={1.9} fill={color} />

      {/* Fine accent at the pointed tip */}
      <Circle cx={tipX} cy={12} r={1.1} fill={color} />

      {/* Jewel nestled in the notch between the two wings */}
      <Circle cx={notchX} cy={12} r={1.4} fill={color} />
    </Svg>
  );
};
