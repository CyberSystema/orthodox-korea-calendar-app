import { Canvas, ColorMatrix, Image as SkImage, useImage } from '@shopify/react-native-skia';
import { Image, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

/**
 * One of the six liturgical marks — fast, cheese, fish, presanctified, the
 * Liturgy of St Basil, the Divine Liturgy — drawn so it can sit on a dark page.
 *
 * WHY THIS IS NOT JUST AN <Image>. The six assets in
 * assets/webapp-source/images are JPEGs: red pen-and-ink drawings on WHITE
 * paper, with no alpha channel. Dropped onto the Illuminated page each one is a
 * white rectangle with a small drawing in it. The existing LiturgicalFlagsRow
 * hides that by cropping them into 22px circles, which also amputates the
 * drawings — the fish is wide, and a circular `cover` crop keeps its middle and
 * throws away its head and tail.
 *
 * So the paper is knocked out instead. A colour matrix maps the image's
 * LUMINANCE INTO ALPHA, inverted: alpha = 1 - luminance. White paper (luminance
 * 1) becomes fully transparent, the dark ink (luminance near 0) becomes fully
 * opaque, and the pen's grey half-tones become partial alpha, so the hatching
 * survives instead of hardening into a cutout. The RGB rows are constants, which
 * repaints the ink in whatever colour the caller asks for — the drawings can
 * therefore be gilded to match the page rather than staying a fixed red that
 * belongs to the webapp's white background.
 *
 * These images are a DERIVED ARTIFACT of the webapp repo's public/data. Do not
 * hand-edit them; see the calendar-data sync rule in CLAUDE.md.
 *
 * `fit="contain"` because the six drawings are not a common aspect ratio.
 */
export function LiturgicalMark({
  source,
  size,
  color,
  label,
}: {
  source: number;
  size: number;
  /** Ink colour. Defaults to the page's accent so marks read as gilding. */
  color?: string;
  /** Screen-reader name. The drawing alone means nothing to a blind reader. */
  label: string;
}) {
  const th = useTheme();
  const image = useImage(source);
  const ink = color ?? th.accent;

  // Skia decodes asynchronously. Fall back to a plain Image rather than a hole:
  // on the light palette the white paper is nearly invisible anyway, and a
  // missing mark would be a content regression, not just a visual one.
  if (!image) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessible
        accessibilityLabel={label}
      />
    );
  }

  const [r, g, b] = hexToUnit(ink);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Canvas style={{ width: size, height: size }}>
        <SkImage image={image} x={0} y={0} width={size} height={size} fit="contain">
          <ColorMatrix
            matrix={[
              // Constant ink colour…
              0,
              0,
              0,
              0,
              r,
              0,
              0,
              0,
              0,
              g,
              0,
              0,
              0,
              0,
              b,
              // …carried by inverted luminance, so the paper disappears.
              -0.2126,
              -0.7152,
              -0.0722,
              0,
              1,
            ]}
          />
        </SkImage>
      </Canvas>
    </View>
  );
}

function hexToUnit(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

/**
 * The six marks, in the order they should always be read: what the day permits
 * or requires first, then which liturgy is served.
 *
 * Exported as data rather than JSX so a composition can lay them out however it
 * likes — a row of badges, a margin column, a single large figure — without each
 * screen re-deriving which flags a day carries.
 */
export const LITURGICAL_MARKS = [
  { key: 'fast', flag: 'fast', image: require('../../../assets/webapp-source/images/fast.jpeg') },
  {
    key: 'cheese',
    flag: 'cheese',
    image: require('../../../assets/webapp-source/images/cheese.jpeg'),
  },
  { key: 'fish', flag: 'fish', image: require('../../../assets/webapp-source/images/fish.jpeg') },
  {
    key: 'pres',
    flag: 'presanctified',
    image: require('../../../assets/webapp-source/images/pres.jpeg'),
  },
  {
    key: 'basil',
    flag: 'saintBasil',
    image: require('../../../assets/webapp-source/images/bas_lit.jpeg'),
  },
  {
    key: 'dl',
    flag: 'divineLiturgy',
    image: require('../../../assets/webapp-source/images/div_lit.jpeg'),
  },
] as const;
