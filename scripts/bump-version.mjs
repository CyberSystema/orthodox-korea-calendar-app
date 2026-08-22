#!/usr/bin/env node
/**
 * Advance the app version to YYYYMM.x — calendar versioning.
 *
 *   202608.1, 202608.2, 202608.3, 202609.1, 202609.2, 202610.1 …
 *
 * YYYYMM is the year and month at the moment of the build; `x` counts builds
 * within that month and restarts at 1 when the month turns. The version then
 * says WHEN a release was cut, which for a liturgical calendar published a few
 * times a year is more useful than a semantic number nobody increments.
 *
 * THE COUNTER IS COMMITTED (.build-counter.json), deliberately. EAS archives the
 * git tree, so a gitignored counter would be invisible to it and every store
 * build would restart at .1 — meaning two different builds could claim the same
 * version. Committed, the sequence is shared across machines and continues
 * correctly on the builders.
 *
 * ONLY STORE BUILDS CALL THIS. Sideloads and simulator runs advance the BUILD
 * NUMBER (scripts/stamp-build-number.mjs) and leave the version alone. Two
 * reasons: a version that moved on every local experiment would read as dozens
 * of releases a month, and — more practically — bumping a committed file on
 * every build would leave the tree permanently dirty, which `check:clean-tree`
 * refuses to publish an OTA from.
 *
 * Run it by hand any time with `npm run bump:version`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNTER = path.join(ROOT, '.build-counter.json');
const APP_JSON = path.join(ROOT, 'app.json');

const now = new Date();
const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

let state = { period: '', x: 0 };
if (fs.existsSync(COUNTER)) {
  try {
    state = JSON.parse(fs.readFileSync(COUNTER, 'utf8'));
  } catch {
    // A corrupt counter must not silently restart the month at 1 and reuse a
    // version string. Fail loudly instead.
    console.error(`✖ ${path.basename(COUNTER)} is not valid JSON. Fix or delete it deliberately.`);
    process.exit(1);
  }
}

const x = state.period === period ? state.x + 1 : 1;
const version = `${period}.${x}`;

fs.writeFileSync(COUNTER, `${JSON.stringify({ period, x }, null, 2)}\n`);

const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
const previous = app.expo.version;
app.expo.version = version;
fs.writeFileSync(APP_JSON, `${JSON.stringify(app, null, 2)}\n`);

console.log(`  version ${previous} -> ${version}`);
if (state.period && state.period !== period) {
  console.log(`  (new month: ${state.period} -> ${period}, counter restarted at 1)`);
}
console.log('  COMMIT app.json and .build-counter.json before the EAS build —');
console.log('  EAS archives the git tree, so uncommitted changes never reach it.');
