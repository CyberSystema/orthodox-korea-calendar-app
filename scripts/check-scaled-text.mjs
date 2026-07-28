#!/usr/bin/env node
/**
 * Guard: user-facing screens must render text through `components/common/ScaledText`,
 * not react-native's `Text` directly — otherwise the reader's Text Size setting
 * (Settings → Text Size) silently does nothing on that screen.
 *
 * There is no ESLint in this repo, so this mirrors the existing
 * `check:calendar-data` / `check:android-icon` drift guards: a tiny script wired
 * into `build:*` and `update:*`.
 *
 * Exits non-zero and names the offending files. Allowlist below is deliberate,
 * not a TODO — read the reason before adding to it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEARCH_DIRS = ['src/screens', 'src/components'];

/** Files that legitimately import react-native's Text. */
const ALLOWLIST = new Set([
  // The wrapper itself.
  'src/components/common/ScaledText.tsx',
  // Renders before hydration, at a fixed size, as a self-contained animation.
  'src/components/common/ByzantineSplashScreen.tsx',
  // Owner-only console: a dense, English-only terminal UI whose alignment
  // depends on a fixed type size. Never shown to readers.
  'src/screens/secret/SecretMenuScreen.tsx',
  'src/screens/secret/AnnouncementLogViewer.tsx',
]);

/** `import { ... Text ... } from 'react-native'`, single or multi-line. */
const RN_IMPORT = /import\s*\{([\s\S]*?)\}\s*from\s*'react-native'/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      yield full;
    }
  }
}

const offenders = [];
for (const dir of SEARCH_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(RN_IMPORT)) {
      const named = match[1].split(',').map((name) => name.trim());
      if (named.includes('Text')) {
        offenders.push(rel);
        break;
      }
    }
  }
}

if (offenders.length > 0) {
  console.error('✖ These files import `Text` from react-native instead of ScaledText:\n');
  for (const file of offenders) console.error(`    ${file}`);
  console.error(
    '\n  Fix: drop `Text` from the react-native import and add\n' +
      "      import { Text } from '<path>/components/common/ScaledText';\n" +
      "  so the screen follows the reader's Text Size setting.\n" +
      '  (If the file genuinely must not scale, add it to ALLOWLIST in this script\n' +
      '   with a reason.)',
  );
  process.exit(1);
}

console.log('✓ All user-facing screens render text through ScaledText.');
