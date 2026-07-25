#!/usr/bin/env node
/**
 * Generate the Android adaptive-icon layers from the SINGLE SOURCE OF TRUTH:
 * `assets/icon.png` (the iOS icon). Run after changing that file:
 *
 *   npm run sync:android-icon        regenerate
 *   npm run check:android-icon       fail if the derived asset is stale
 *
 * WHY THIS EXISTS
 * Android adaptive icons are 108dp layers of which only the central 72dp
 * (72/108 = 66.7%) is guaranteed visible — the outer ring is reserved for mask
 * shapes and parallax. Dropping the iOS artwork in unchanged therefore renders it
 * zoomed 1.5x: the emblem went from 49.8% of the icon on iOS to 74.7% on Android.
 * The old setup also used a flat background colour, losing the iOS gradient/waves.
 *
 * WHAT IT PRODUCES
 * `assets/android-icon-background.png` — the complete iOS artwork scaled to 66.7%
 * and centred, so the *visible* area matches iOS exactly, with the surrounding
 * ring filled by radially extending the artwork's own edge pixels. That bleed
 * means no seam and no hard edge if a launcher reveals slightly more than 72dp.
 * The iOS file's light-grey rounded corners (padding that iOS masks away) are
 * replaced by the same extension, so they can never appear under a squircle mask.
 *
 * `assets/android-icon-empty.png` — a fully transparent foreground. All artwork
 * lives in the background layer so the composition is exactly iOS's; splitting the
 * emblem into the foreground would double it under a launcher's parallax effect.
 * (`android-icon-foreground.png` is intentionally left alone — the Android splash
 * screen still uses it.)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'assets', 'icon.png');
const BACKGROUND = path.join(ROOT, 'assets', 'android-icon-background.png');
const EMPTY = path.join(ROOT, 'assets', 'android-icon-empty.png');

/** Fraction of an adaptive-icon layer that is guaranteed visible (72dp of 108dp). */
const VISIBLE_FRACTION = 72 / 108;
const ANGLE_STEPS = 2048;

const checkOnly = process.argv.includes('--check');

// ─── minimal PNG codec (8-bit RGBA, non-interlaced) ─────────────────────────
function decode(file) {
  const b = fs.readFileSync(file);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) {
    throw new Error(`${path.basename(file)}: expected an 8-bit RGBA, non-interlaced PNG`);
  }
  const parts = [];
  let off = 8;
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') parts.push(b.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const out = Buffer.alloc(width * height * 4);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0;
      const bb = prev ? prev[x] : 0;
      const c = prev && x >= 4 ? prev[x - 4] : 0;
      let v;
      switch (filter) {
        case 0:
          v = line[x];
          break;
        case 1:
          v = line[x] + a;
          break;
        case 2:
          v = line[x] + bb;
          break;
        case 3:
          v = line[x] + ((a + bb) >> 1);
          break;
        case 4: {
          const p = a + bb - c;
          const pa = Math.abs(p - a),
            pb = Math.abs(p - bb),
            pc = Math.abs(p - c);
          v = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c);
          break;
        }
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, data: out };
}

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

// ─── generation ─────────────────────────────────────────────────────────────

/**
 * The iOS file pads its rounded-square artwork with a light grey that iOS masks
 * away. Those pixels must never bleed into the Android icon.
 */
const isPadding = (r, g, b, a) => a < 128 || (r > 170 && g > 150 && b > 150);

function bilinear(img, fx, fy) {
  const x = Math.max(0, Math.min(img.width - 1, fx));
  const y = Math.max(0, Math.min(img.height - 1, fy));
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const x1 = Math.min(img.width - 1, x0 + 1),
    y1 = Math.min(img.height - 1, y0 + 1);
  const dx = x - x0,
    dy = y - y0;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const i00 = (y0 * img.width + x0) * 4 + c,
      i10 = (y0 * img.width + x1) * 4 + c;
    const i01 = (y1 * img.width + x0) * 4 + c,
      i11 = (y1 * img.width + x1) * 4 + c;
    out[c] =
      img.data[i00] * (1 - dx) * (1 - dy) +
      img.data[i10] * dx * (1 - dy) +
      img.data[i01] * (1 - dx) * dy +
      img.data[i11] * dx * dy;
  }
  return out;
}

/**
 * For each angle, the furthest radius from centre that is still real artwork.
 *
 * The result is stepped a few pixels inward and smoothed across neighbouring
 * angles: sampling exactly on the squircle's anti-aliased boundary would smear
 * half-transparent edge pixels outward as visible rays.
 */
const EDGE_INSET = 6;
const SMOOTH_WINDOW = 48;

function artworkRadiusByAngle(img) {
  const cx = (img.width - 1) / 2;
  const cy = (img.height - 1) / 2;
  const maxPossible = Math.hypot(cx, cy);
  const radii = new Float64Array(ANGLE_STEPS);

  for (let i = 0; i < ANGLE_STEPS; i++) {
    const theta = (i / ANGLE_STEPS) * Math.PI * 2;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    let best = 0;
    for (let r = maxPossible; r >= 0; r -= 0.5) {
      const x = Math.round(cx + dx * r);
      const y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const idx = (y * img.width + x) * 4;
      const [R, G, B, A] = [img.data[idx], img.data[idx + 1], img.data[idx + 2], img.data[idx + 3]];
      if (!isPadding(R, G, B, A)) {
        best = r;
        break;
      }
    }
    radii[i] = Math.max(0, best - EDGE_INSET);
  }

  // Circular moving average, so adjacent rays can't disagree abruptly.
  const smoothed = new Float64Array(ANGLE_STEPS);
  const half = Math.floor(SMOOTH_WINDOW / 2);
  for (let i = 0; i < ANGLE_STEPS; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) {
      sum += radii[(i + k + ANGLE_STEPS) % ANGLE_STEPS];
    }
    smoothed[i] = sum / (half * 2 + 1);
  }
  return smoothed;
}

function buildBackground(src) {
  const size = src.width;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radii = artworkRadiusByAngle(src);
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Scale about the centre so the artwork fills the visible 72dp region.
      let sx = (x - cx) / VISIBLE_FRACTION + cx;
      let sy = (y - cy) / VISIBLE_FRACTION + cy;

      // Whether a point lies outside the artwork is a GEOMETRIC question — the
      // silhouette radius for its angle. It must not be a colour test: the
      // emblem's cream calendar is as light as the padding, and testing colour
      // would smear the centre of the icon outward.
      //
      // Inside the silhouette: copied pixel-exact. Outside: clamped back along
      // the ray to the edge, so the gradient bleeds outward with no seam and the
      // iOS file's light corners can never appear.
      const vx = sx - cx,
        vy = sy - cy;
      const r = Math.hypot(vx, vy);
      if (r > 0) {
        let theta = Math.atan2(vy, vx);
        if (theta < 0) theta += Math.PI * 2;
        const maxR = radii[Math.round((theta / (Math.PI * 2)) * ANGLE_STEPS) % ANGLE_STEPS];
        if (r > maxR) {
          sx = cx + (vx / r) * maxR;
          sy = cy + (vy / r) * maxR;
        }
      }

      const [R, G, B] = bilinear(src, sx, sy);
      const i = (y * size + x) * 4;
      out[i] = Math.round(R);
      out[i + 1] = Math.round(G);
      out[i + 2] = Math.round(B);
      out[i + 3] = 255; // background layer must be fully opaque
    }
  }
  return { width: size, height: size, data: out };
}

function buildEmpty(size) {
  return { width: size, height: size, data: Buffer.alloc(size * size * 4) };
}

function main() {
  const src = decode(SOURCE);
  const outputs = [
    [BACKGROUND, encode(buildBackground(src))],
    [EMPTY, encode(buildEmpty(src.width))],
  ];

  console.log(`Source of truth : ${path.relative(ROOT, SOURCE)} (${src.width}x${src.height})`);
  console.log(`Visible scale   : ${(VISIBLE_FRACTION * 100).toFixed(1)}% (72dp of a 108dp layer)`);

  if (checkOnly) {
    const stale = outputs
      .filter(([file, buf]) => !fs.existsSync(file) || !fs.readFileSync(file).equals(buf))
      .map(([file]) => path.relative(ROOT, file));
    if (stale.length > 0) {
      console.error('\n✗ Android icon assets are stale:');
      for (const s of stale) console.error(`   - ${s}`);
      console.error('\n  Fix with:  npm run sync:android-icon\n');
      process.exit(1);
    }
    console.log('✓ Android icon assets match assets/icon.png.');
    return;
  }

  let written = 0;
  for (const [file, buf] of outputs) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) {
      fs.writeFileSync(file, buf);
      console.log(`  wrote ${path.relative(ROOT, file)}`);
      written++;
    }
  }
  console.log(written === 0 ? '✓ Already up to date.' : `✓ Regenerated (${written} file(s)).`);
}

main();
