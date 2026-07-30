#!/usr/bin/env node
/**
 * Fail if package-lock.json is not installable by the npm EAS actually runs.
 *
 *   npm run check:lockfile
 *
 * WHY THIS EXISTS
 * EAS builders run `npm ci --include=dev` on **Node 22 / npm 10**. This machine
 * runs a much newer Node, and **npm 11 writes lockfiles npm 10 rejects**: npm 11
 * dedupes some transitive copies that npm 10 insists on listing, so `npm ci`
 * fails on the builder with
 *
 *   `npm ci` can only install packages when your package.json and
 *   package-lock.json are in sync.
 *   Missing: react-native-worklets@0.10.3 from lock file
 *
 * while `npm ci` passes locally. That exact mismatch errored two iOS production
 * builds — each one after hours of queue time, because the failure only happens
 * once the builder starts. Catching it here costs seconds.
 *
 * THE FIX when this fails:
 *   npx npm@10 install --package-lock-only
 * then commit package-lock.json. The result is installable by BOTH npm majors —
 * npm 11 simply dedupes the extra entries at install time.
 *
 * Any `npm install` run with npm 11 can reintroduce the drift, so this is
 * chained into every `build:*` rather than left to memory.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The npm major EAS builders ship. Bump when EAS's builder image moves. */
const EAS_NPM = '10';

const root = new URL('..', import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), 'okn-lockcheck-'));

try {
  // `npm ci` only reads these two files to decide whether the tree is in sync,
  // and --dry-run stops before it would need patches/ or the network for tarballs.
  for (const f of ['package.json', 'package-lock.json']) {
    copyFileSync(join(root, f), join(work, f));
  }

  try {
    execFileSync(
      'npx',
      ['--yes', `npm@${EAS_NPM}`, 'ci', '--include=dev', '--dry-run', '--ignore-scripts'],
      { cwd: work, stdio: 'pipe', encoding: 'utf8' },
    );
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const missing = [...output.matchAll(/^npm error (Missing|Invalid):.*$/gm)].map((m) => m[0]);

    console.error(`\n✖ package-lock.json is not installable by npm ${EAS_NPM}.`);
    console.error(
      `  EAS runs "npm ci --include=dev" on npm ${EAS_NPM}; your local npm writes a lockfile it rejects,\n` +
        '  so the build fails on the builder AFTER queueing. Details:\n',
    );
    console.error(
      missing.length ? missing.join('\n') : output.trim().split('\n').slice(0, 12).join('\n'),
    );
    console.error(
      '\n  Fix:  npx npm@10 install --package-lock-only   (then commit package-lock.json)\n',
    );
    process.exit(1);
  }

  console.log(`✓ package-lock.json installs cleanly under npm ${EAS_NPM} (the EAS builder's npm).`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
