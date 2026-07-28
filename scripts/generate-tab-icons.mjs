#!/usr/bin/env node
/**
 * Generate the Android tab-bar icons for the "native" appearance flavour:
 *
 *   node scripts/generate-tab-icons.mjs           regenerate
 *   node scripts/generate-tab-icons.mjs --check   fail if the assets are stale
 *
 * WHY THIS EXISTS
 * The native flavour uses `@react-navigation/bottom-tabs/unstable` (react-native-
 * screens `Tabs`), which renders a real platform tab bar. On iOS that means the
 * icons are SF Symbols — named, vectorial, free, and tinted by the OS. Android has
 * no equivalent symbol set, so `PlatformIconAndroid` takes a **bitmap** instead: a
 * plain `require()`d PNG. These files are that bitmap set, drawn here rather than
 * checked in as opaque binaries so the geometry stays reviewable in a diff.
 *
 * WHAT IT PRODUCES  (72x72 = 24dp at 3x density, RGBA, transparent background)
 * `assets/tab-icons/today01.png` … `today31.png`
 *                               the date ring with the day of the month set inside
 *                               it — one file per day, the Android stand-in for SF
 *                               Symbols' '1.circle' … '31.circle', which is what
 *                               the iOS tab shows. An empty ring would tell the
 *                               user nothing, so the number is drawn in.
 * `assets/tab-icons/month.png`  a 3x3 grid of rounded dots (iOS 'square.grid.3x3').
 * `assets/tab-icons/news.png`   a bell outline: dome, flared shoulders, lip, clapper
 *                               (iOS 'bell').
 *
 * The day files are zero-padded so the set sorts, and carry NO separator on
 * purpose: the React Native asset pipeline strips non-alphanumerics from the path
 * when it derives the Android drawable name, so `today07.png` becomes
 * `assets_tabicons_today07`. A `today-07.png` would silently map to that same
 * name — the flat spelling keeps file and drawable one-to-one and obvious.
 * The FILE name is padded; the DRAWING is not — day 7 shows '7', not '07'.
 *
 * Android tints tab icons at runtime, so the RGB is irrelevant — the **alpha
 * channel is the icon**. Everything is therefore drawn as pure black with the
 * coverage baked into alpha. Coverage comes from supersampling each pixel on a
 * SUPERSAMPLE x SUPERSAMPLE subgrid; without it the curves come out ragged at the
 * small sizes a tab bar actually uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'tab-icons');

/** 24dp at 3x density — the largest bucket Android will ask for in a tab bar. */
const SIZE = 72;
/** Subsamples per axis. 4 is the floor for clean curves; 8 is free at this size. */
const SUPERSAMPLE = 8;
/** Stroke weight, chosen so the artwork still reads when scaled to 24dp. */
const STROKE = 5;
/** Keep the artwork clear of the edges — the tab bar crops nothing, but it breathes. */
const INSET = 6;

const HALF = STROKE / 2;
const CENTER = SIZE / 2;

/** The date ring's inner edge — the hole the day number has to live in. */
const RING_INNER = CENTER - INSET - STROKE;
/** Digit ink must stay this clear of that edge, or the two read as one blob. */
const MIN_CLEARANCE = 2.5;

/** Superseded by today01…today31 — deleted on regenerate, flagged by --check. */
const OBSOLETE = ['today.png'];

const checkOnly = process.argv.includes('--check');

// ─── minimal PNG encoder (8-bit RGBA, non-interlaced) ───────────────────────
// Same chunk/CRC/encode structure as scripts/sync-android-icon.mjs.
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function encode({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── signed distance fields ─────────────────────────────────────────────────
// Every glyph is a union of primitives expressed as signed distances (negative
// inside). A union is `min`, and a pixel is covered when the union is <= 0 —
// which makes supersampled coverage a plain sample count.

/**
 * Tag an SDF with a conservative bounding box. The rasteriser only evaluates a
 * shape whose box touches the pixel it is working on; a shape is positive
 * everywhere outside its own bounds, so coverage is unchanged — but 31 numbered
 * day icons stay cheap instead of testing every path against every subsample.
 */
function bounded(fn, minX, minY, maxX, maxY) {
  fn.bounds = [minX, minY, maxX, maxY];
  return fn;
}

/** Distance from a point to the segment a→b (used for every stroked path). */
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** A stroked polyline with round joins and caps. */
const strokePolyline = (points, halfWidth = HALF) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return bounded(
    (px, py) => {
      let best = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[i + 1];
        const d = distToSegment(px, py, ax, ay, bx, by);
        if (d < best) best = d;
      }
      return best - halfWidth;
    },
    minX - halfWidth,
    minY - halfWidth,
    maxX + halfWidth,
    maxY + halfWidth,
  );
};

/**
 * A stroked circular arc, angles in radians and measured with y pointing DOWN
 * (screen space), normalised to [0, 2*PI). Outside the sweep the distance falls
 * back to the endpoints, which gives the round caps for free.
 */
const strokeArc = (cx, cy, r, a0, a1, halfWidth = HALF) =>
  bounded(
    (px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      let theta = Math.atan2(dy, dx);
      if (theta < 0) theta += Math.PI * 2;
      if (theta >= a0 && theta <= a1) return Math.abs(Math.hypot(dx, dy) - r) - halfWidth;
      const ends = [a0, a1].map((a) =>
        Math.hypot(px - (cx + Math.cos(a) * r), py - (cy + Math.sin(a) * r)),
      );
      return Math.min(ends[0], ends[1]) - halfWidth;
    },
    cx - r - halfWidth,
    cy - r - halfWidth,
    cx + r + halfWidth,
    cy + r + halfWidth,
  );

/** A filled circle. */
const fillCircle = (cx, cy, r) =>
  bounded((px, py) => Math.hypot(px - cx, py - cy) - r, cx - r, cy - r, cx + r, cy + r);

/** A filled rounded square, given its top-left corner. */
const fillRoundedSquare = (x, y, size, radius) =>
  bounded(
    (px, py) => {
      const half = size / 2;
      const qx = Math.abs(px - (x + half)) - (half - radius);
      const qy = Math.abs(py - (y + half)) - (half - radius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      return outside + Math.min(Math.max(qx, qy), 0) - radius;
    },
    x,
    y,
    x + size,
    y + size,
  );

/** Sample a quadratic Bezier into a polyline — enough segments to hide the chords. */
function quadratic(p0, p1, p2, steps = 24) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return points;
}

/** The same, cubic — for a curve that has to honour the tangent at BOTH ends. */
function cubic(p0, p1, p2, p3, steps = 24) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return points;
}

/**
 * Sample an ELLIPTICAL arc into a polyline. Angles follow `strokeArc` — radians
 * with y pointing down, so 0 is the right extreme, PI/2 the bottom, PI the left
 * and 1.5*PI the top — but they are raw here, not normalised, so a sweep may run
 * past 2*PI. Ellipses rather than circles because a numeral box is scaled
 * anisotropically (much narrower than it is tall), which turns every circle in
 * it into an oval; sampling to points is the only way `strokePolyline` can carry
 * that. 32 segments per full turn keeps the chord error under a subsample.
 */
function ellipticalArc(cx, cy, rx, ry, a0, a1) {
  const sweep = a1 - a0;
  const steps = Math.max(8, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * 32));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return points;
}

/** Turn a path through half a turn about the centre of the numeral box. */
const halfTurn = (path) => path.map(([x, y]) => [1 - x, 1 - y]);

// ─── the numerals ───────────────────────────────────────────────────────────
/**
 * A day number has to be DRAWN — there is no font in a script with no
 * dependencies. The set below is a geometric sans in the Futura mould: one pen
 * weight throughout, oval bowls, flat terminals; explicitly not a seven-segment
 * LCD, which is what you get if you build digits out of axis-aligned bars.
 *
 * Each numeral is a list of CENTRELINE paths in a normalised box — x 0 (left) →
 * 1 (right), y 0 (cap line) → 1 (baseline). Layout scales that box to the target
 * cap height and width and then strokes it, so one outline set serves both the
 * wide one-digit and the condensed two-digit sizes.
 *
 * `advance` is the slot the glyph takes when digits are spaced, defaulting to
 * the whole box. Only '1' overrides it: its ink is a stem near the middle, so
 * spacing it on the full box would leave a hole beside it in '11' and '31'.
 */

/** 6 — a closed bowl, with a hook sweeping off its left flank up to the cap line. */
const SIX = {
  paths: [
    ellipticalArc(0.5, 0.685, 0.46, 0.315, 0, Math.PI * 2),
    cubic([0.8, 0.03], [0.38, 0.167], [0.06, 0.3], [0.045, 0.6]),
  ],
};

const NUMERALS = [
  // 0 — a plain oval ring, the full box.
  { paths: [ellipticalArc(0.5, 0.5, 0.5, 0.5, 0, Math.PI * 2)] },
  // 1 — a stem with a small flag, set on a narrow advance.
  {
    advance: [0.24, 0.76],
    paths: [
      [
        [0.22, 0.24],
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  },
  // 2 — a top arc running on into the diagonal, over a full-width base bar.
  {
    paths: [
      [...ellipticalArc(0.5, 0.3, 0.5, 0.3, Math.PI * 0.86, Math.PI * 2 + 0.75), [0.06, 1]],
      [
        [0, 1],
        [1, 1],
      ],
    ],
  },
  // 3 — two right-hand bowls stacked on a shared waist, the upper one narrower.
  {
    paths: [
      ellipticalArc(0.5, 0.25, 0.44, 0.25, Math.PI * 1.15, Math.PI * 2.5),
      ellipticalArc(0.5, 0.75, 0.5, 0.25, Math.PI * 1.5, Math.PI * 2.85),
    ],
  },
  // 4 — an open four: apex, diagonal and crossbar, with the stem through it.
  {
    paths: [
      [
        [0.76, 0],
        [0.03, 0.73],
        [1, 0.73],
      ],
      [
        [0.76, 0],
        [0.76, 1],
      ],
    ],
  },
  // 5 — flag bar, short stem, and a bowl that opens at the stem's foot.
  {
    paths: [
      [
        [0.06, 0],
        [0.94, 0],
      ],
      [
        [0.06, 0],
        [0.06, 0.52],
      ],
      ellipticalArc(0.52, 0.665, 0.46, 0.335, Math.PI * 1.1, Math.PI * 2.88),
    ],
  },
  SIX,
  // 7 — bar and diagonal, no crossbar.
  {
    paths: [
      [
        [0.05, 0],
        [0.95, 0],
        [0.33, 1],
      ],
    ],
  },
  // 8 — two ovals crossing at the waist, the upper one narrower.
  {
    paths: [
      ellipticalArc(0.5, 0.26, 0.385, 0.26, 0, Math.PI * 2),
      ellipticalArc(0.5, 0.745, 0.47, 0.255, 0, Math.PI * 2),
    ],
  },
  // 9 — the 6 through half a turn, which is what a geometric sans actually does.
  { paths: SIX.paths.map(halfTurn) },
];

/**
 * Numeral metrics, one set per day-number length. Two digits get a shorter,
 * much narrower and lighter glyph plus tight tracking, so '28' and '31' fill the
 * ring as confidently as '7' does instead of spilling into it. `gap` is the
 * white between the two digits' INK, not between their centrelines.
 */
const ONE_DIGIT = { cap: 31, width: 17.5, stroke: 4.5, gap: 0 };
const TWO_DIGIT = { cap: 27, width: 11.5, stroke: 3.8, gap: 2.2 };

// ─── the glyphs ─────────────────────────────────────────────────────────────

/** The date ring — the app's date-circle motif, and every day icon's frame. */
function dateRing() {
  const outer = CENTER - INSET;
  return strokeArc(CENTER, CENTER, outer - HALF, 0, Math.PI * 2);
}

/**
 * Set a day number inside the ring: scale each numeral from its box to the
 * metrics for that number's length, space the run so the ink (not the
 * centreline) sits `gap` apart, and centre the whole thing on the ring.
 *
 * `reach` comes back with it — the furthest the ink gets from the centre, which
 * is what the clearance check needs. Round caps make it exact: stroking is a
 * Minkowski sum with a disc, so the ink's outer radius is the furthest
 * centreline point plus half the pen.
 */
function numeralShapes(day) {
  const digits = [...String(day)].map((ch) => NUMERALS[Number(ch)]);
  const { cap, width, stroke, gap } = digits.length === 1 ? ONE_DIGIT : TWO_DIGIT;
  const half = stroke / 2;
  const advances = digits.map((glyph) => glyph.advance ?? [0, 1]);

  const run =
    advances.reduce((sum, [l, r]) => sum + (r - l) * width, 0) +
    (digits.length - 1) * (gap + stroke);
  const yTop = CENTER - cap / 2;
  let x = CENTER - run / 2;

  const shapes = [];
  let reach = 0;
  digits.forEach((glyph, i) => {
    const [left, right] = advances[i];
    const originX = x - left * width;
    for (const path of glyph.paths) {
      const points = path.map(([nx, ny]) => [originX + nx * width, yTop + ny * cap]);
      for (const [px, py] of points) {
        reach = Math.max(reach, Math.hypot(px - CENTER, py - CENTER) + half);
      }
      shapes.push(strokePolyline(points, half));
    }
    x += (right - left) * width + gap + stroke;
  });

  return { shapes, reach };
}

/** Today — the date ring with the day of the month set inside it. */
function dayShapes(day) {
  const { shapes, reach } = numeralShapes(day);
  const clearance = RING_INNER - reach;
  if (clearance < MIN_CLEARANCE) {
    throw new Error(
      `Day ${day} leaves only ${clearance.toFixed(2)}px between the numerals and the ring ` +
        `(floor ${MIN_CLEARANCE}px). Shrink cap/width in ONE_DIGIT or TWO_DIGIT.`,
    );
  }
  return { shapes: [dateRing(), ...shapes], clearance };
}

/** Month — 3x3 rounded dots, evenly spaced across the inset box. */
function monthShapes() {
  const span = SIZE - INSET * 2;
  const dot = 12;
  const gap = (span - dot * 3) / 2;
  const radius = 3.5;
  const shapes = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      shapes.push(
        fillRoundedSquare(INSET + col * (dot + gap), INSET + row * (dot + gap), dot, radius),
      );
    }
  }
  return shapes;
}

/**
 * News — a bell outline. Nudged down by DY because the clapper is narrow:
 * geometric centring would read as bottom-heavy, optical centring does not.
 */
function newsShapes() {
  const DY = 1.5;
  const domeCy = 23.5 + DY;
  const domeR = 15;
  const shoulderY = domeCy;
  const lipY = 50 + DY;

  // Dome: the upper half of a circle, shoulders at its 9 and 3 o'clock ends.
  const dome = strokeArc(CENTER, domeCy, domeR, Math.PI, Math.PI * 2);

  // Sides: from each shoulder, curving outward into the lip.
  const left = strokePolyline(
    quadratic([CENTER - domeR, shoulderY], [CENTER - 17, lipY - 10], [CENTER - 20, lipY]),
  );
  const right = strokePolyline(
    quadratic([CENTER + domeR, shoulderY], [CENTER + 17, lipY - 10], [CENTER + 20, lipY]),
  );

  // Lip: a straight rim overhanging the sides on both ends.
  const lip = strokePolyline([
    [CENTER - 24, lipY],
    [CENTER + 24, lipY],
  ]);

  // Clapper: a dot hanging free below the lip.
  const clapper = fillCircle(CENTER, 58.5 + DY, 4);

  return [dome, left, right, lip, clapper];
}

// ─── rasterisation ──────────────────────────────────────────────────────────

/**
 * Rasterise a union of SDFs to black pixels whose ALPHA is the supersampled
 * coverage — that alpha channel is the whole icon as far as Android is concerned.
 */
function rasterise(shapes) {
  const data = Buffer.alloc(SIZE * SIZE * 4);
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Only the shapes whose bounds touch this pixel can contribute to it.
      const near = shapes.filter(
        ({ bounds }) => bounds[0] < x + 1 && bounds[2] > x && bounds[1] < y + 1 && bounds[3] > y,
      );
      if (near.length === 0) continue;

      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const py = y + (sy + 0.5) * step;
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) * step;
          for (const shape of near) {
            if (shape(px, py) <= 0) {
              hits++;
              break;
            }
          }
        }
      }
      if (hits === 0) continue;
      const i = (y * SIZE + x) * 4;
      data[i] = 0; // pure black: Android tints the icon, only alpha matters
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round((hits / samples) * 255);
    }
  }
  return { width: SIZE, height: SIZE, data };
}

function main() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1).map((day) => ({
    day,
    ...dayShapes(day),
  }));
  const tightest = days.reduce((a, b) => (b.clearance < a.clearance ? b : a));

  const outputs = [
    ...days.map(({ day, shapes }) => [`today${String(day).padStart(2, '0')}.png`, shapes]),
    ['month.png', monthShapes()],
    ['news.png', newsShapes()],
  ].map(([name, shapes]) => [path.join(OUT_DIR, name), encode(rasterise(shapes))]);

  console.log(`Canvas          : ${SIZE}x${SIZE} RGBA (24dp @3x), transparent background`);
  console.log(`Antialiasing    : ${SUPERSAMPLE}x${SUPERSAMPLE} supersampling per pixel`);
  console.log(`Stroke / inset  : ${STROKE}px / ${INSET}px`);
  console.log(
    `Day numerals    : 1-digit ${ONE_DIGIT.cap}px cap @${ONE_DIGIT.stroke}px, ` +
      `2-digit ${TWO_DIGIT.cap}px cap @${TWO_DIGIT.stroke}px`,
  );
  console.log(
    `Ring clearance  : ${tightest.clearance.toFixed(2)}px at the tightest ` +
      `(day ${tightest.day}), floor ${MIN_CLEARANCE}px`,
  );

  const leftovers = OBSOLETE.map((name) => path.join(OUT_DIR, name)).filter((file) =>
    fs.existsSync(file),
  );

  if (checkOnly) {
    const stale = outputs
      .filter(([file, buf]) => !fs.existsSync(file) || !fs.readFileSync(file).equals(buf))
      .map(([file]) => path.relative(ROOT, file))
      .concat(leftovers.map((file) => `${path.relative(ROOT, file)} (superseded, delete)`));
    if (stale.length > 0) {
      console.error('\n✗ Tab icon assets are stale:');
      for (const s of stale) console.error(`   - ${s}`);
      console.error('\n  Fix with:  node scripts/generate-tab-icons.mjs\n');
      process.exit(1);
    }
    // The app addresses these on Android by their generated DRAWABLE NAME (see
    // NativeMainTabs). That name is derived from the path by the RN asset
    // pipeline: lowercased, non-alphanumerics stripped, segments joined with
    // '_'. A directory rename would silently produce icons that resolve to
    // nothing in a release build, so assert the mapping the app depends on.
    const expectedPrefix = `${path
      .relative(ROOT, OUT_DIR)
      .toLowerCase()
      .replace(/[^a-z0-9/]/g, '')
      .split('/')
      .join('_')}_`;
    if (expectedPrefix !== 'assets_tabicons_') {
      console.error(
        `\n✗ Android drawable prefix changed: expected "assets_tabicons_", got "${expectedPrefix}".`,
      );
      console.error('  src/navigation/NativeMainTabs.tsx hardcodes the old one — update both.\n');
      process.exit(1);
    }

    // Stray PNGs would ship as dead drawables and, worse, hide a rename: the old
    // name keeps resolving while the new one is missing.
    const expectedNames = new Set(outputs.map(([file]) => path.basename(file)));
    const stray = fs
      .readdirSync(OUT_DIR)
      .filter((name) => name.endsWith('.png') && !expectedNames.has(name));
    if (stray.length > 0) {
      console.error(`\n✗ Unexpected files in ${path.relative(ROOT, OUT_DIR)}:`);
      for (const name of stray) console.error(`   - ${name}`);
      console.error('\n  Delete them, or add them to the generator.\n');
      process.exit(1);
    }

    console.log(
      `✓ Tab icon assets match scripts/generate-tab-icons.mjs (${outputs.length} files).`,
    );
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const [file, buf] of outputs) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) {
      fs.writeFileSync(file, buf);
      console.log(`  wrote ${path.relative(ROOT, file)} (${buf.length} bytes)`);
      written++;
    }
  }
  for (const file of leftovers) {
    fs.unlinkSync(file);
    console.log(`  removed ${path.relative(ROOT, file)} (superseded by today01…today31)`);
  }
  console.log(
    written === 0 && leftovers.length === 0
      ? '✓ Already up to date.'
      : `✓ Regenerated (${written} file(s) written, ${leftovers.length} removed).`,
  );
}

main();
