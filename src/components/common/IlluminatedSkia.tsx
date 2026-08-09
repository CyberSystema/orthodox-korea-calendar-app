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

import { fadeOut } from '../../theme/fadeOut';
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
/**
 * THE GILDED NUMERAL — rewritten from scratch.
 *
 * Three layers, and each one is a separate idea:
 *
 *   1. THE FIGURE   the numeral in gilt, with a soft cast shadow beneath it so
 *                   it sits ON the leaf rather than in it, and a wide glow so it
 *                   sits IN light rather than on top of it. Entirely static —
 *                   nothing here changes between frames.
 *   2. THE GLEAM    a narrow specular stripe that crosses the figure and then
 *                   rests. This is the only animated thing.
 *   3. NOTHING ELSE.
 *
 * FOUR THINGS THE PREVIOUS VERSION GOT WRONG, all of which made the gleam read
 * as the whole numeral pulsing rather than as light crossing metal. They are
 * written down because each one is invisible in a still frame and each one was
 * separately convincing:
 *
 *   THE AXIS. The gradient ran from (x, 0) to (x + band, canvasHeight) — 29px
 *   across against 307px down, an axis 84.6 degrees from horizontal. Colour
 *   therefore varied DOWN the figure, not across it, and sliding the start
 *   barely rotated it. No band width could have fixed that. Both ends now share
 *   y, so the axis is horizontal and the band is a vertical stripe that travels.
 *
 *   THE MEASURE. The band was a fraction of the CANVAS, which is as wide as the
 *   halo (232pt on a phone) while the glyph inside it is about 130. A band of
 *   0.42 x 232 covered three quarters of the actual figure. Everything is now a
 *   fraction of the GLYPH, measured from the font.
 *
 *   THE WRAP. The band overlapped the glyph at the start of the cycle but not at
 *   the end, so the clock's wrap stepped the brightness. The sweep now finishes
 *   clear of the figure and the envelope is zero outside it, so the wrap happens
 *   while nothing is drawn.
 *
 *   THE COLOUR. Gradient stops of 'transparent' are transparent BLACK, so the
 *   ramp carried black and the figure DARKENED as the gleam passed. Stops now
 *   fade a colour to its own zero-alpha form (see theme/fadeOut).
 */
export function GoldLeafNumeral({
  value,
  box,
  fontSize,
  base,
  highlight,
  spark,
  shadow,
}: {
  value: string;
  box: { width: number; height: number };
  fontSize: number;
  /** The gilt itself. */
  base: string;
  /** The glow the figure sits in. */
  highlight: string;
  /** The specular core of the travelling gleam — paler than the gilt. */
  spark: string;
  /** The shadow it casts on the leaf. */
  shadow: string;
}) {
  const clock = useClock();
  const font = useFont(require('../../../assets/fonts/EBGaramond-Regular.ttf'), fontSize);

  // Where the glyph actually sits, and how wide it actually is. Everything the
  // gleam does is expressed against THIS, never against the canvas.
  const glyph = useMemo(() => {
    if (!font) return null;
    const b = font.measureText(value);
    const x = box.width / 2 - b.x - b.width / 2;
    return {
      x,
      y: box.height / 2 - b.y - b.height / 2,
      left: x + b.x,
      width: b.width,
    };
  }, [font, value, box.width, box.height]);

  // THE GLEAM'S SHAPE, in fractions of the glyph.
  //   BAND   a fifth of the figure — narrow enough to read as a stripe
  //   CROSS  the share of the cycle spent sweeping; the remainder is dark, so
  //          the highlight returns rather than never stopping
  //   RAMP   how much of the sweep fades in and out, so it neither snaps on nor
  //          cuts off
  const BAND = 0.2;
  const CROSS = 0.42;
  const RAMP = 0.16;
  const PERIOD = 5000;

  const width = glyph?.width ?? 0;
  const band = BAND * width;
  // Start one band clear of the left edge, finish one clear of the right.
  const from = (glyph?.left ?? 0) - band;
  const span = width + 2 * band;

  const head = useDerivedValue(() => {
    const u = Math.min(1, (clock.value % PERIOD) / PERIOD / CROSS);
    return from + u * span;
  }, [clock, from, span]);

  const gleamStart = useDerivedValue(() => vec(head.value, 0), [head]);
  const gleamEnd = useDerivedValue(() => vec(head.value + band, 0), [head, band]);

  const gleamOpacity = useDerivedValue(() => {
    const t = (clock.value % PERIOD) / PERIOD;
    if (t >= CROSS) return 0;
    const u = t / CROSS;
    const e = u < RAMP ? u / RAMP : u > 1 - RAMP ? (1 - u) / RAMP : 1;
    return e * e * (3 - 2 * e);
  }, [clock]);

  if (!font || !glyph) return null;

  return (
    <Canvas style={{ width: box.width, height: box.height }}>
      {/* 1. THE FIGURE — static. */}
      <SkText x={glyph.x} y={glyph.y} text={value} font={font} color={base}>
        <Shadow
          dx={0}
          dy={Math.max(1, Math.round(fontSize * 0.035))}
          blur={Math.max(3, Math.round(fontSize * 0.085))}
          color={shadow}
          inner={false}
        />
        <Shadow dx={0} dy={0} blur={18} color={highlight} inner={false} />
      </SkText>

      {/* 2. THE GLEAM — the same glyph drawn again, painted with a narrow
          horizontal gradient, inside a group whose opacity is the envelope. */}
      <Group opacity={gleamOpacity}>
        <SkText x={glyph.x} y={glyph.y} text={value} font={font}>
          <LinearGradient
            start={gleamStart}
            end={gleamEnd}
            colors={[fadeOut(spark), spark, fadeOut(spark)]}
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
        <RadialGradient c={vec(c, c)} r={c} colors={[color, fadeOut(color)]} positions={[0, 1]} />
      </Circle>
    </Canvas>
  );
}

export const skiaAvailable = Boolean(Skia);
