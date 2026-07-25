#!/usr/bin/env node
/**
 * Publish an over-the-air JS update with the SAME environment the matching build
 * profile uses.
 *
 * Why this exists: on SDK 55+ `eas update` does NOT apply the `env` block from an
 * eas.json build profile. Publishing bare would leave EXPO_PUBLIC_* unset, and the app
 * would fall back to its hardcoded defaults — which for the `preview` channel means a
 * staging build silently repointed at the PRODUCTION backend. This reads eas.json (the
 * single source of truth for per-profile env) and passes those values explicitly, so an
 * update always matches the binary it lands on.
 *
 *   npm run update:production -- -m "Fix Korean wording"
 *   npm run update:preview    -- -m "Try new copy"
 *   npm run update:production -- -m "..." --rollout-percentage 10
 *   npm run update:production -- -m "..." --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const profileIdx = argv.indexOf('--profile');
if (profileIdx === -1 || !argv[profileIdx + 1]) {
  fail('Missing --profile <production|preview>');
}
const profileName = argv[profileIdx + 1];
const dryRun = argv.includes('--dry-run');
// Everything except our own flags is forwarded to `eas update` (-m, --rollout-percentage, ...)
const passthrough = argv.filter(
  (a, i) => i !== profileIdx && i !== profileIdx + 1 && a !== '--dry-run',
);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const easJsonPath = path.join(APP_ROOT, 'eas.json');
const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
const profile = easJson?.build?.[profileName];
if (!profile) fail(`eas.json has no build profile "${profileName}".`);

const channel = profile.channel;
if (!channel) {
  fail(
    `Build profile "${profileName}" has no "channel" in eas.json — an update cannot be ` +
      `targeted at builds from a profile without a channel.`,
  );
}

const env = profile.env ?? {};
const publicEnv = Object.fromEntries(
  Object.entries(env).filter(([k]) => k.startsWith('EXPO_PUBLIC_')),
);

// ── Guards ────────────────────────────────────────────────────────────────────
const apiUrl = publicEnv.EXPO_PUBLIC_APP_API_BASE_URL;
if (!apiUrl) {
  fail(
    `Profile "${profileName}" does not define EXPO_PUBLIC_APP_API_BASE_URL in eas.json.\n` +
      `  Publishing without it would fall back to the hardcoded production URL and could\n` +
      `  point ${profileName} users at the wrong backend.`,
  );
}

// The owner console must never be reachable in anything published to a channel.
if (publicEnv.EXPO_PUBLIC_ENABLE_SECRET_MENU !== 'false') {
  fail(
    `Profile "${profileName}" must set EXPO_PUBLIC_ENABLE_SECRET_MENU="false" in eas.json ` +
      `before an update can be published (currently ` +
      `${JSON.stringify(publicEnv.EXPO_PUBLIC_ENABLE_SECRET_MENU)}).`,
  );
}

if (!passthrough.some((a) => a === '-m' || a === '--message')) {
  fail('Provide an update message, e.g.  npm run update:production -- -m "Fix Korean wording"');
}

// ── Report exactly what will be inlined ───────────────────────────────────────
console.log(`Profile   : ${profileName}`);
console.log(`Channel   : ${channel}`);
console.log('Inlined env (from eas.json):');
for (const [k, v] of Object.entries(publicEnv)) console.log(`  ${k}=${v}`);

const easArgs = [
  'eas',
  'update',
  '--channel',
  channel,
  '--environment',
  profileName,
  ...passthrough,
];

if (dryRun) {
  console.log(`\n[dry-run] would run: npx ${easArgs.join(' ')}`);
  process.exit(0);
}

const result = spawnSync('npx', easArgs, {
  cwd: APP_ROOT,
  stdio: 'inherit',
  env: { ...process.env, ...publicEnv },
});
process.exit(result.status ?? 1);
