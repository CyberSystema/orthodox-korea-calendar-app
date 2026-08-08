import Svg, {
  Circle,
  Defs,
  G,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

/**
 * The Illuminated direction's drawn ornament.
 *
 * ALL SVG, deliberately. expo-linear-gradient and expo-blur are not installed,
 * and adding either would make this whole look a NATIVE change — it could then
 * only ship in a store build. Drawing gradients, rays and textures with
 * react-native-svg (already a dependency) keeps every pixel of this OTA-able,
 * which matters because this is the part of the app most likely to be revised
 * after people see it.
 *
 * Everything here is decoration: each piece is pointer-transparent and hidden
 * from screen readers by its caller, so none of it stands between the reader and
 * the day's text.
 */

/**
 * The mandorla — the almond of light behind a holy figure in Byzantine work.
 * Here it sits behind the date numeral and is the app's way of saying "this day
 * is a feast" without a badge: rays only appear when the day earns them.
 */
export function Mandorla({
  size,
  color,
  rays = 16,
  intense = false,
  wash = 1,
}: {
  size: number;
  color: string;
  rays?: number;
  intense?: boolean;
  /**
   * Strength of the radial halo behind the rays, 0..1.
   *
   * The rays are lines and cost the text under them almost nothing; the radial
   * is a WASH, and on a pale ground it lifts the local background under the
   * weekday and the month-year — measured as the difference between 4.3:1 and
   * AA. Light palettes pass a fraction here; the dark palette passes 1, where
   * the same wash is what makes the halo read at all.
   */
  wash?: number;
}) {
  const c = size / 2;
  const inner = size * 0.17;
  const outer = size * 0.47;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={(intense ? 0.34 : 0.18) * wash} />
          <Stop offset="55%" stopColor={color} stopOpacity={(intense ? 0.12 : 0.06) * wash} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Circle cx={c} cy={c} r={c} fill="url(#halo)" />

      {/* Rays. Alternating long/short is what stops it reading as a bicycle wheel. */}
      {/* 0.55, not 0.85: at feast intensity with 24 rays the mandorla read as a
          starburst competing with the numeral rather than haloing it. */}
      <G opacity={intense ? 0.55 : 0.32}>
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (i / rays) * Math.PI * 2;
          const long = i % 2 === 0;
          const r2 = long ? outer : outer * 0.72;
          return (
            <Path
              key={i}
              d={`M ${c + Math.cos(angle) * inner} ${c + Math.sin(angle) * inner} L ${
                c + Math.cos(angle) * r2
              } ${c + Math.sin(angle) * r2}`}
              stroke={color}
              strokeWidth={long ? 1.4 : 0.8}
              strokeLinecap="round"
              opacity={long ? 1 : 0.7}
            />
          );
        })}
      </G>

      <Circle
        cx={c}
        cy={c}
        r={inner * 1.5}
        stroke={color}
        strokeWidth={0.8}
        opacity={0.5}
        fill="none"
      />
    </Svg>
  );
}

/**
 * A ruled section divider with a lozenge at its centre — the manuscript's way of
 * starting a new part, in place of a 1px grey line.
 */
export function OrnamentalRule({ width, color }: { width: number; color: string }) {
  const h = 14;
  const mid = width / 2;
  const gap = 26;

  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <SvgLinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={color} stopOpacity={0} />
          <Stop offset="35%" stopColor={color} stopOpacity={0.85} />
          <Stop offset="65%" stopColor={color} stopOpacity={0.85} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>

      {/* The rule fades at both ends so it never collides with the screen edge. */}
      <Path d={`M 0 ${h / 2} L ${mid - gap} ${h / 2}`} stroke="url(#fade)" strokeWidth={1} />
      <Path d={`M ${mid + gap} ${h / 2} L ${width} ${h / 2}`} stroke="url(#fade)" strokeWidth={1} />

      {/* Centre lozenge, flanked by two pips. */}
      <Path
        d={`M ${mid} ${h / 2 - 6} L ${mid + 6} ${h / 2} L ${mid} ${h / 2 + 6} L ${mid - 6} ${h / 2} Z`}
        fill={color}
        opacity={0.9}
      />
      <Circle cx={mid - 14} cy={h / 2} r={2} fill={color} opacity={0.65} />
      <Circle cx={mid + 14} cy={h / 2} r={2} fill={color} opacity={0.65} />
    </Svg>
  );
}

/**
 * A corner vine. Four of these frame the page and are the cheapest way to make a
 * screen read as a bordered leaf rather than a scroll view.
 */
export function CornerFlourish({
  size,
  color,
  rotation = 0,
}: {
  size: number;
  color: string;
  rotation?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <G rotation={rotation} origin="20, 20" opacity={0.75}>
        <Path
          d="M2 2 L2 14 M2 2 L14 2"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M2 8 C 10 8, 14 12, 14 20 C 14 26, 18 28, 24 28"
          stroke={color}
          strokeWidth={1}
          fill="none"
          opacity={0.8}
        />
        <Circle cx={14} cy={20} r={1.8} fill={color} opacity={0.9} />
        <Path d="M6 6 L10 10" stroke={color} strokeWidth={0.8} opacity={0.6} />
      </G>
    </Svg>
  );
}

/**
 * The illuminated capital's frame: a gold-ruled square with a lattice inside it,
 * the letter itself drawn by the caller on top.
 */
export function DropCapFrame({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Defs>
        <Pattern id="lattice" width="10" height="10" patternUnits="userSpaceOnUse">
          <Path
            d="M0 10 L10 0 M-2 2 L2 -2 M8 12 L12 8"
            stroke={color}
            strokeWidth={0.5}
            opacity={0.35}
          />
        </Pattern>
      </Defs>
      <Rect x={1} y={1} width={58} height={58} fill="url(#lattice)" />
      <Rect x={1} y={1} width={58} height={58} stroke={color} strokeWidth={1.6} fill="none" />
      <Rect
        x={5}
        y={5}
        width={50}
        height={50}
        stroke={color}
        strokeWidth={0.6}
        opacity={0.6}
        fill="none"
      />
      {/* Corner studs, as on a tooled binding. */}
      {[
        [5, 5],
        [55, 5],
        [5, 55],
        [55, 55],
      ].map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={1.6} fill={color} opacity={0.8} />
      ))}
    </Svg>
  );
}

/**
 * Parchment tooth. A very low-contrast speckle laid over the page — invisible as
 * a pattern, but it stops large flat areas looking like plastic.
 */
export function ParchmentTexture({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="tooth" width="24" height="24" patternUnits="userSpaceOnUse">
          <Circle cx={3} cy={5} r={0.7} fill={color} opacity={0.5} />
          <Circle cx={17} cy={11} r={0.5} fill={color} opacity={0.4} />
          <Circle cx={9} cy={19} r={0.6} fill={color} opacity={0.45} />
          <Circle cx={21} cy={2} r={0.4} fill={color} opacity={0.3} />
        </Pattern>
      </Defs>
      <Rect width={width} height={height} fill="url(#tooth)" />
    </Svg>
  );
}
