import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

/**
 * ONE GROUND FOR THE WHOLE SCREEN.
 *
 * Each panel used to draw its own parchment. Because a texture field has to be
 * given a size, it ended in a hard rectangle wherever the panel ended, and that
 * edge is what made the day read as a card dropped onto a black page. Ground
 * belongs to the LEAF, not to the boxes on it — so this draws once, behind
 * everything on a screen.
 *
 * NO GRAIN. There was a Skia fractal-noise field here and it was removed on
 * purpose: the owner's word for the result was "noisy". Speckle laid over the
 * whole viewport sits over BODY TEXT as well as over empty space, which costs
 * legibility for exactly the older readers this app is for, and it buys no
 * structure — it is decoration standing in for depth. What replaces it is light:
 * a vertical wash for the page's own tone, and one broad pool near the top so
 * the leaf reads as lit from above rather than uniformly flat. Both are smooth,
 * so type stays crisp on them at any size.
 *
 * If texture ever comes back it must be STRUCTURED (laid lines, a ruled grid)
 * rather than random, and it must stop before it reaches running text.
 *
 * Pointer-transparent and hidden from screen readers; it must be the FIRST child
 * of a screen's container so everything else sits on it.
 */
export function IlluminatedGround({ crown = true }: { crown?: boolean } = {}) {
  const th = useTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {/* The wash. Deep wine at the very top so the headpiece has nothing to butt
          against, then the page, then a slightly deeper foot. */}
      <LinearGradient
        // The wine CROWN exists so the app's own headpiece band has nothing to
        // butt against. Screens carrying the PLATFORM's header — Settings, Staff,
        // Diagnostics, the detail screens — already have wine above them, so a
        // second one only bleeds down over their first rows of content and takes
        // the contrast with it. Those pass crown={false}.
        colors={
          crown
            ? [th.primaryDeep, th.background, th.background, th.backgroundDeep]
            : [th.background, th.background, th.background, th.backgroundDeep]
        }
        // The wine must finish ABOVE the content, not across it. The headpiece
        // occupies roughly the top 13% of the window; ending the transition at
        // 22% left the action pills sitting on a muted #CABAAC rather than the
        // cream page, which measured 3.20:1 for their gold lettering. Ending at
        // 0.15 keeps the band dissolving into the page without tinting the first
        // row of controls.
        locations={[0, 0.15, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The pool of light. A single very wide, very soft warm gradient below the
          headpiece — depth without a single speck of noise. Sized from the
          window so it stays proportionate on a phone and on an iPad. */}
      <LinearGradient
        colors={[th.accentGlow, 'transparent']}
        style={[styles.pool, { height: width * 1.1, borderRadius: width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pool: {
    position: 'absolute',
    // Wider than the screen and pulled up past its own top edge, so what shows is
    // the soft middle of the falloff rather than an arc the eye can trace.
    left: '-25%',
    right: '-25%',
    top: -80,
    opacity: 0.55,
  },
});
