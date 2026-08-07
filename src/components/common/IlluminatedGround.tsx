import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CornerFlourish } from './IlluminatedOrnaments';
import { ParchmentField } from './IlluminatedSkia';

/**
 * ONE GROUND FOR THE WHOLE SCREEN — the single most important piece of the
 * Illuminated direction, and the fix for the app reading as separate parts
 * pasted together.
 *
 * Before this, each panel drew its own parchment. Because a noise field has to
 * be given a size, it ended in a hard rectangle wherever the panel ended, and
 * that edge is exactly what made the day panel look like a card dropped onto a
 * black page. Ornament belongs to the LEAF, not to the boxes on it.
 *
 * So this draws, once, behind everything on a screen:
 *
 *  1. A continuous vertical wash that starts in the headpiece's own deep wine
 *     and settles into the page. The band therefore has no bottom edge — it
 *     dissolves, and the gold rule becomes the boundary because we drew one,
 *     not because two surfaces met.
 *  2. One parchment field across the full viewport, so the tooth is the same
 *     material everywhere and no panel can end it.
 *  3. Vines at the four true corners of the leaf — the page is framed once,
 *     rather than every card being framed separately.
 *
 * It is pointer-transparent and hidden from screen readers, and it must be the
 * FIRST child of a screen's container so everything else sits on it.
 */
export function IlluminatedGround() {
  const th = useTheme();
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {/* The wash. Deep wine at the very top so the headpiece has nothing to butt
          against, then the page, then a slightly deeper foot so the leaf reads as
          lit from above rather than uniformly flat. */}
      <LinearGradient
        colors={[th.primaryDeep, th.background, th.background, th.backgroundDeep]}
        locations={[0, 0.22, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* One material, whole-viewport. 0.22 was measured, not guessed: the noise
          carries its own alpha, so at 0.5 the page ground sat around #40382D
          against a #14100C background — a visible veil. This lands near #1E1A14,
          which is felt as tooth and not seen as a layer. */}
      <ParchmentField width={width} height={height} tint={th.textFaint} opacity={0.15} />

      <View style={[styles.corner, styles.tl]}>
        <CornerFlourish size={34} color={th.accentDim} />
      </View>
      <View style={[styles.corner, styles.tr]}>
        <CornerFlourish size={34} color={th.accentDim} rotation={90} />
      </View>
      <View style={[styles.corner, styles.bl]}>
        <CornerFlourish size={34} color={th.accentDim} rotation={270} />
      </View>
      <View style={[styles.corner, styles.br]}>
        <CornerFlourish size={34} color={th.accentDim} rotation={180} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', opacity: 0.32 },
  // Inset from the very edge so the vines sit inside the leaf's margin rather
  // than being clipped by the screen or the home indicator.
  tl: { top: 96, left: 6 },
  tr: { top: 96, right: 6 },
  bl: { bottom: 96, left: 6 },
  br: { bottom: 96, right: 6 },
});
