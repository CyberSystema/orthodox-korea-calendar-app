import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { fadeOut } from '../../theme/fadeOut';
import { useLeaf } from '../../theme/useLeaf';
import { useTheme } from '../../theme/useTheme';
import { useHeadpieceHeight } from './IlluminatedHeader';

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
  const { width, height } = useWindowDimensions();
  const { page } = useLeaf();
  const headpiece = useHeadpieceHeight();

  // WHERE THE WINE MUST FINISH.
  //
  // 0.15 was measured against a phone and it is right there: the band ends at
  // 121.7pt and the ramp at 131.1pt, so 9.4pt of transition shows and reads as a
  // glow under the band. But it is a fraction of the WINDOW, and the thing it has
  // to finish under is the band — `topInset + body`, which has nothing to do with
  // the window's height. On an iPad the band ends at 91.5pt while the ramp still
  // runs to 206.4pt: 115pt of wine-to-cream smeared across the page, with the
  // action pills sitting on it at 1.94:1 against the 4.5:1 they need.
  //
  // So the stop follows the band, keeping the phone's own 9pt of overhang. The
  // ramp is what makes this safe rather than merely careful: `page` is exactly 0
  // at every width up to 440pt — wider than any phone — so on a phone this whole
  // expression collapses to the literal 0.15 that ships today, bit for bit.
  const crownStop = 0.15 + ((headpiece + 9) / height - 0.15) * page;

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
        // The wine must finish ABOVE the content, not across it — see crownStop.
        locations={[0, crownStop, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The pool of light. A single very wide, very soft warm gradient below the
          headpiece — depth without a single speck of noise. Sized from the
          window so it stays proportionate on a phone and on an iPad. */}
      <LinearGradient
        colors={[th.accentGlow, fadeOut(th.accentGlow)]}
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
