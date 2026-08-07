#!/usr/bin/env node
/**
 * Fail if a rendered screen reads the STATIC palette instead of the theme.
 *
 *   npm run check:theme-tokens
 *
 * WHY THIS EXISTS
 * `theme/colors` is the LIGHT palette, and `StyleSheet.create` freezes whatever
 * it reads at import time. A screen that imports it directly therefore renders
 * light forever — it silently ignores Settings → Appearance and the system dark
 * setting, and the bug looks like "one card didn't turn dark", which is easy to
 * miss in review and easy to reintroduce.
 *
 * The fix is always the same: take colours from `useThemedStyles((t) => …)` or
 * `useTheme()` instead. See `src/theme/useTheme.ts`.
 *
 * This mirrors `check-scaled-text.mjs`, which guards the same class of mistake
 * for font sizes.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Files that legitimately read the static light palette.
 *
 * The splash and its emblem paint BEFORE the store has hydrated, so no theme
 * exists yet and the brand colours are the right answer. `otaUpdates` builds a
 * native reload screen outside React, so it cannot call a hook. `tokens` is the
 * light palette's own definition.
 */
const ALLOWED = new Set([
  'src/components/common/ByzantineSplashScreen.tsx',
  'src/components/common/ByzantineCalendarEmblem.tsx',
  'src/services/updates/otaUpdates.ts',
  'src/theme/tokens.ts',
  'src/theme/navigationTheme.ts',
]);

const files = globSync('src/**/*.{ts,tsx}', { cwd: ROOT });
const offenders = [];

for (const rel of files) {
  if (ALLOWED.has(rel)) continue;
  const source = readFileSync(join(ROOT, rel), 'utf8');
  if (/from '[^']*theme\/colors'/.test(source)) offenders.push(rel);
}

if (offenders.length) {
  console.error('\n✖ These files read the static light palette instead of the theme:\n');
  for (const f of offenders) console.error(`    ${f}`);
  console.error(
    '\n  They will stay light in dark mode. Use useThemedStyles((t) => …) or useTheme()\n' +
      '  from src/theme/useTheme.ts. If a file genuinely paints before hydration,\n' +
      '  add it to ALLOWED in this script with a reason.\n',
  );
  process.exit(1);
}

console.log(`✓ No screen reads the static palette (${files.length} files checked).`);
