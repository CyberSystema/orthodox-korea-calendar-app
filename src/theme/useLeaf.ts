import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How large to draw the leaf, derived from the window rather than from a phone.
 *
 * THE PROBLEM THIS SOLVES. The day composition was designed and judged at 393pt
 * and every dimension in it is a phone pixel. Its focal graphic — the mandorla
 * behind the date — is `min(width * 0.56, 232)`: 56% of a phone's width, and the
 * cap binds at 414pt, so on a 1032pt iPad it is 22%. Going from phone to iPad the
 * screen grows 2.6x in width and 4.2x in area while the focal graphic grows 1.05x
 * and every type size, mark and ornament grows not at all. That is the whole of
 * why the tablet looks poor: not the arrangement, the SCALE.
 *
 * THREE CLASSES, AND THEY ARE THE DESIGN.
 *
 *   FIGURE   (k)  the numeral, the halo, the drawn marks, every ornament and
 *                 rule. These are pictures. A picture on a larger page is larger.
 *   DISPLAY  (kt) the day's name, the versal, the band labels. Headings grow, but
 *                 far less than the figure — capped at 1.36 — or they stop being
 *                 headings and become shouting.
 *   READING  (1)  readings, commemorations, meta, event titles. THESE NEVER
 *                 SCALE. A 21pt reading is correct on every device; the measure is
 *                 already bounded, so growing the type only shortens the line.
 *                 Inflating body copy is precisely what makes a tablet layout look
 *                 amateur, and it is the mistake a single blanket multiplier makes.
 *
 * `k` IS EXACTLY 1 ON EVERY PHONE, BY CONSTRUCTION. The ramp is zero at and below
 * 440pt — wider than any supported phone — so `halo` reduces to the original
 * expression and every scalar falls out at 1. The phone path is not protected by
 * an `if` that someone can later move; it is arithmetic.
 */

const PHONE_MAX = 440;
/** Above this the leaf is fully "page-sized"; between the two it ramps. */
const PAGE_MIN = 620;
/** Beyond this a leaf stops being a page and becomes a poster. */
export const MAX_LEAF_WIDTH = 1100;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Hermite smoothstep: 0 below `a`, 1 above `b`, eased between. */
function smoothstep(v: number, a: number, b: number) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export type Leaf = {
  /** Width available to the page's content, gutters removed. */
  width: number;
  /** FIGURE scale — graphics and ornament. 1 on a phone. */
  k: number;
  /** DISPLAY scale — headings. 1 on a phone, capped well below `k`. */
  kt: number;
  /** SPACE scale — gaps and padding between blocks. */
  ks: number;
  /** The mandorla's diameter, already solved against width AND height. */
  halo: number;
  /** True once there is room to set sections side by side. */
  spread: boolean;
};

export function useLeaf(): Leaf {
  const { width: w, height: h } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Round the inputs the memo depends on. A Stage Manager or Split View resize
  // drag emits a continuous stream of widths; keying on the raw value would
  // rebuild this object every frame of the drag.
  const wr = Math.round(w);
  const hr = Math.round(h);
  const chrome = Math.round(insets.top + insets.bottom);

  return useMemo(() => {
    const gutter = wr < 700 ? 16 : clamp(wr * 0.04, 24, 56);
    const width = Math.min(wr - 2 * gutter, MAX_LEAF_WIDTH);

    // What is left for the hero after the platform's chrome and this screen's
    // own navigator and action rows. Height matters as much as width: a tall
    // halo that width alone would allow pushes the day's name off a short
    // window, which is exactly what Split View hands you.
    const usable = Math.max(320, hr - chrome - 240);

    const ramp = smoothstep(wr, PHONE_MAX, PAGE_MIN);

    // The phone's own expression, verbatim, so the ramp interpolates FROM the
    // shipping design rather than from a reconstruction of it.
    const phoneHalo = Math.min(wr * 0.56, 232);
    const pageHalo = Math.min(0.61 * width, 0.4 * usable);
    const halo = phoneHalo + (pageHalo - phoneHalo) * ramp;

    const k = halo / phoneHalo;
    const kt = Math.min(1 + (k - 1) * 0.28, 1.36);
    const ks = Math.sqrt(k * kt);

    // No `facing` spread: the app is portrait-only on every device (see
    // plugins/withPortraitOnly), so a landscape composition would be code that
    // can never run.
    return { width, k, kt, ks, halo, spread: wr >= 820 };
  }, [wr, hr, chrome]);
}
