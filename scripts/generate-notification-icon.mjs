#!/usr/bin/env node
/**
 * Generate the Android notification small icon:
 *
 *   node scripts/generate-notification-icon.mjs           regenerate
 *   node scripts/generate-notification-icon.mjs --check   fail if the asset is stale
 *
 * WHY THIS EXISTS
 * Android draws a notification's small icon from its ALPHA CHANNEL ALONE — every
 * opaque pixel becomes solid white (or the accent tint), and the RGB is discarded.
 * An icon that looks correct in a file browser can therefore render as a featureless
 * white square in the status bar.
 *
 * That is not hypothetical here: `assets/android-icon-monochrome.png`, the obvious
 * candidate to reuse, measures 1,048,576 fully-opaque pixels and ZERO transparent
 * ones — it is the emblem painted onto an opaque white field. Pointing OneSignal's
 * `smallIcons` at it would produce exactly that white square.
 *
 * WHAT IT PRODUCES  (96x96 RGBA — 24dp at 4x, OneSignal's documented size)
 * `assets/notification-icon.png` — the app's date-ring motif with the cross bar
 * inside it, drawn as coverage in alpha over a transparent field.
 *
 * WHY NOT JUST DOWNSCALE THE EMBLEM
 * `assets/byzantine-calendar-monochrome.svg` is an 18-element line drawing whose
 * strokes are 8-18px at 1024px wide. At 24dp those collapse into an illegible smudge.
 * The ring-and-cross is the same reduction `generate-tab-icons.mjs` already makes for
 * the tab bar, where it reads cleanly at 72px.
 *
 * The generator asserts its own output is mostly transparent before writing, so the
 * white-square failure becomes a build error rather than a field report.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'assets', 'notification-icon.png');

/** 24dp at 4x density. OneSignal documents 96x96 for `smallIcons`. */
const SIZE = 96;
/** Subsamples per axis — free at this size, and the curves need it. */
const SUPERSAMPLE = 8;
/** Stroke weight, scaled from the tab icon's 5px@72 so the two motifs match. */
const STROKE = 6.5;
/** Status-bar icons are cropped to a circle on some OEM skins; keep clear of it. */
const INSET = 8;
/** A small icon that is nearly all ink reads as a blob. Fail rather than ship it. */
const MIN_TRANSPARENT_RATIO = 0.3;

const HALF = STROKE / 2;
const CENTER = SIZE / 2;

const checkOnly = process.argv.includes('--check');

// ─── PNG encoding (same minimal encoder as the tab-icon generator) ───────────

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encode({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // Prefix every scanline with filter type 0 (None) — the image is tiny and this
  // keeps the encoder trivially auditable.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── signed distance fields ─────────────────────────────────────────────────
// Each shape is a function returning <= 0 inside the ink, tagged with the bounds
// it can possibly touch so the rasteriser can skip it per pixel.

function bounded(fn, minX, minY, maxX, maxY) {
  fn.bounds = [minX, minY, maxX, maxY];
  return fn;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const strokeSegment = (ax, ay, bx, by, halfWidth = HALF) =>
  bounded(
    (px, py) => distToSegment(px, py, ax, ay, bx, by) - halfWidth,
    Math.min(ax, bx) - halfWidth,
    Math.min(ay, by) - halfWidth,
    Math.max(ax, bx) + halfWidth,
    Math.max(ay, by) + halfWidth,
  );

const strokeCircle = (cx, cy, r, halfWidth = HALF) =>
  bounded(
    (px, py) => Math.abs(Math.hypot(px - cx, py - cy) - r) - halfWidth,
    cx - r - halfWidth,
    cy - r - halfWidth,
    cx + r + halfWidth,
    cy + r + halfWidth,
  );

// ─── the mark ───────────────────────────────────────────────────────────────

/**
 * The date ring with an Orthodox cross bar set inside it: the upright, the long
 * transverse bar, and the shorter titulus above it. The slanted footrest of the
 * full emblem is deliberately dropped — at 24dp it merges with the transverse bar.
 */
function notificationShapes() {
  const ringRadius = CENTER - INSET - HALF;
  const upright = ringRadius * 0.62;
  const barHalf = ringRadius * 0.42;
  const titulusHalf = ringRadius * 0.24;
  const barY = CENTER + ringRadius * 0.06;
  const titulusY = CENTER - ringRadius * 0.34;
  const thin = HALF * 0.82;

  return [
    strokeCircle(CENTER, CENTER, ringRadius),
    strokeSegment(CENTER, CENTER - upright, CENTER, CENTER + upright, thin),
    strokeSegment(CENTER - barHalf, barY, CENTER + barHalf, barY, thin),
    strokeSegment(CENTER - titulusHalf, titulusY, CENTER + titulusHalf, titulusY, thin),
  ];
}

/**
 * Rasterise the union of the shapes into pixels whose ALPHA is the supersampled
 * coverage. RGB is pure white: Android tints the icon, but white is the honest
 * value for "this is the lit part" and keeps the file readable in a viewer.
 */
function rasterise(shapes) {
  const data = Buffer.alloc(SIZE * SIZE * 4);
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
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
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round((hits / samples) * 255);
    }
  }
  return { width: SIZE, height: SIZE, data };
}

function transparentRatio({ data }) {
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
  }
  return transparent / (data.length / 4);
}

function main() {
  const image = rasterise(notificationShapes());
  const ratio = transparentRatio(image);

  // The guard that makes the white-square failure impossible to ship silently.
  if (ratio < MIN_TRANSPARENT_RATIO) {
    console.error(
      `\n✗ Notification icon is only ${(ratio * 100).toFixed(1)}% transparent ` +
        `(floor ${(MIN_TRANSPARENT_RATIO * 100).toFixed(0)}%).\n` +
        `  Android renders this icon from its ALPHA channel alone, so a mostly-opaque\n` +
        `  image becomes a featureless white square in the status bar.\n`,
    );
    process.exit(1);
  }

  const buf = encode(image);
  const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE) : null;
  const stale = current === null || !current.equals(buf);

  console.log(`Canvas       : ${SIZE}x${SIZE} RGBA (24dp @4x), transparent background`);
  console.log(`Antialiasing : ${SUPERSAMPLE}x${SUPERSAMPLE} supersampling per pixel`);
  console.log(`Transparency : ${(ratio * 100).toFixed(1)}% of pixels fully transparent`);

  if (checkOnly) {
    if (stale) {
      console.error(
        `\n✗ ${path.relative(ROOT, OUT_FILE)} is stale.\n` +
          `  Run: npm run sync:notification-icon\n`,
      );
      process.exit(1);
    }
    console.log('✓ Notification icon is up to date.');
    return;
  }

  if (!stale) {
    console.log('✓ Already up to date.');
    return;
  }
  fs.writeFileSync(OUT_FILE, buf);
  console.log(`✓ Wrote ${path.relative(ROOT, OUT_FILE)} (${buf.length} bytes).`);
}

main();
