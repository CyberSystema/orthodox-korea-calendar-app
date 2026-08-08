import {
  Canvas,
  Circle,
  ColorMatrix,
  FractalNoise,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  Shadow,
  Skia,
  Text as SkText,
  useClock,
  useFont,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

/**
 * The parts of the Illuminated direction that SVG cannot draw.
 *
 * react-native-svg gave us rays and rules, but three things need a real 2D
 * engine: gold that behaves like metal (a specular band that travels across the
 * glyph), parchment that looks like a material rather than a dot screen (real
 * fractal noise), and soft light that bleeds (blurred layers). Skia does all
 * three on the GPU, driven from a Reanimated clock so nothing crosses the JS
 * bridge per frame.
 *
 * These are decorative layers only — no text a reader must be able to select
 * lives here, and every instance is laid behind or under real RN text.
 */

/**
 * GOLD LEAF. A dark base glyph with a bright specular band sweeping across it,
 * which is what makes gilding read as metal instead of yellow paint: real gold
 * leaf has a highlight that MOVES as the page tilts. The sweep is slow and
 * continuous, timed so it reads as light rather than as an animation.
 *
 * GEOMETRY. This draws the SAME face at the SAME size as the plain numeral it
 * stands in for — the app's own EB Garamond, loaded from the bundled file rather
 * than `matchFont('serif')`, which resolved to the system serif and gave the
 * gilded figure a visibly different shape from the ungilded one.
 *
 * The glyph is centred by its INK BOUNDS, not by an advance width.
 * `font.measureText()` returns an SkRect of the ink, whose origin carries the
 * left side bearing and whose `y` is negative (ink rises above the baseline).
 * Centring on `width` alone therefore left the figure off-centre inside its halo
 * by the bearing, and a hand-picked baseline (`height * 0.78`) put it off-centre
 * vertically as well. Solving both from the bounds is exact:
 *
 *     inkCentre = origin + bounds.origin + bounds.size / 2   ==>   box / 2
 *
 * `box` only has to be large enough to contain the ink plus the glow's blur —
 * it takes no part in layout, because the caller draws this as a centred overlay
 * on top of the real text node.
 */
export function GoldLeafNumeral({
  value,
  box,
  fontSize,
  base,
  highlight,
}: {
  value: string;
  box: { width: number; height: number };
  fontSize: number;
  base: string;
  highlight: string;
}) {
  const clock = useClock();
  const font = useFont(require('../../../assets/fonts/EBGaramond-Regular.ttf'), fontSize);

  const placement = useMemo(() => {
    if (!font) return null;
    const b = font.measureText(value);
    return {
      x: box.width / 2 - b.x - b.width / 2,
      y: box.height / 2 - b.y - b.height / 2,
    };
  }, [font, value, box.width, box.height]);

  // The highlight travels a little wider than the glyph so it fully enters and
  // fully leaves rather than popping at the edges.
  const sweep = useDerivedValue(() => {
    const period = 5200;
    const t = (clock.value % period) / period;
    return vec(-box.width * 0.3 + t * (box.width * 1.6), 0);
  }, [clock, box.width]);

  const sweepEnd = useDerivedValue(() => {
    const period = 5200;
    const t = (clock.value % period) / period;
    return vec(-box.width * 0.3 + t * (box.width * 1.6) + box.width * 0.42, box.height);
  }, [clock, box.width, box.height]);

  if (!font || !placement) return null;

  return (
    <Canvas style={{ width: box.width, height: box.height }}>
      <Group>
        <SkText x={placement.x} y={placement.y} text={value} font={font} color={base}>
          {/* Soft outer glow so the figure sits in light rather than on top of it. */}
          <Shadow dx={0} dy={0} blur={18} color={highlight} inner={false} />
        </SkText>
        {/* The travelling specular band, clipped to the glyph by drawing the
            same text again with a moving gradient. */}
        <SkText x={placement.x} y={placement.y} text={value} font={font}>
          <LinearGradient
            start={sweep}
            end={sweepEnd}
            colors={['transparent', highlight, 'transparent']}
          />
        </SkText>
      </Group>
    </Canvas>
  );
}

/**
 * PARCHMENT. Fractal noise at very low opacity, warped and tinted — a material,
 * not a pattern. Static (no clock) because animated grain reads as video noise
 * and would fight the text.
 */
export function ParchmentField({
  width,
  height,
  tint,
  opacity = 0.1,
}: {
  width: number;
  height: number;
  tint: string;
  opacity?: number;
}) {
  // Skia wants 0–1 channels, and the palette speaks hex.
  const [r, g, b] = useMemo(() => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(tint.trim());
    if (!m) return [0.43, 0.38, 0.32];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] as const;
  }, [tint]);

  return (
    <Canvas style={{ width, height }}>
      {/*
        NO <Paint> CHILD HERE, deliberately. A <Paint> element is an ADDITIONAL
        paint pass: with `<Paint color={tint}/>` present the rect was filled with
        flat tint at full strength and the noise attached to the other paint, so
        the whole page rendered as solid #6E6252 and `opacity` did nothing. The
        shader and its colour filter must hang off the rect's OWN paint.
      */}
      <Rect x={0} y={0} width={width} height={height} opacity={opacity}>
        {/* Frequency is in POINTS, so ~0.7 gives cells a little over a point
            across — fine grain, the tooth of a skin. Do not drop it to hundredths
            chasing a flat-looking page: that produces blobby camouflage, and a
            flat page is the <Paint> bug above, not a frequency problem. Two
            octaves keeps the grain even; three starts to clump. */}
        <FractalNoise freqX={0.68} freqY={0.72} octaves={2} seed={7} />
        {/* FractalNoise is RGBA noise — every channel generated independently, so
            raw it is COLOUR static. This maps its luminance into ALPHA and paints
            a constant tint through it, which is the difference between parchment
            tooth and a broken display. */}
        <ColorMatrix
          matrix={[0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0.2126, 0.7152, 0.0722, 0, 0]}
        />
      </Rect>
    </Canvas>
  );
}

/**
 * A soft pool of candlelight behind the hero — a wide, very low-opacity radial
 * that stops the top of the page reading as a flat rectangle.
 */
export function CandleGlow({
  size,
  color,
  intense = false,
  strength = 1,
}: {
  size: number;
  color: string;
  intense?: boolean;
  /**
   * Scales the pool's opacity, 0..1.
   *
   * A pale ground needs far less of it than a dark one: the same alpha that
   * reads as candlelight on near-black merely washes parchment, and it lifts the
   * local background under the type that sits inside the halo. The effect still
   * belongs on both palettes — it just cannot be the same number on both.
   */
  strength?: number;
}) {
  const c = size / 2;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={c} cy={c} r={c} opacity={(intense ? 0.3 : 0.16) * strength}>
        <RadialGradient c={vec(c, c)} r={c} colors={[color, 'transparent']} positions={[0, 1]} />
      </Circle>
    </Canvas>
  );
}

export const skiaAvailable = Boolean(Skia);
