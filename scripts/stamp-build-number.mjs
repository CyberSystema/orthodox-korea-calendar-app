#!/usr/bin/env node
/**
 * Stamp a fresh build number into the NATIVE projects, immediately before a
 * local build.
 *
 * WHY THIS EXISTS AND app.config.js IS NOT ENOUGH. `expo run:ios` and
 * `expo run:android` only run prebuild when the native folder is missing. If
 * ios/ and android/ are already there — which is the normal case — the app
 * config is never consulted, and the build number baked in at the last prebuild
 * is what ships. That is exactly how iOS sat at 120 and Android at 130 across a
 * whole day of sideloads while the config computed 136.
 *
 * So the number is written HERE, into the two files the native builds actually
 * read, every time. Both are gitignored generated output, so stamping them dirties
 * nothing that is tracked.
 *
 * Safe if a prebuild happens anyway: app.config.js calls the same function, so
 * whichever path runs last still produces a current number.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildNumber } = createRequire(import.meta.url)('./buildNumber.js');
const n = buildNumber();

let touched = 0;

// ── iOS ────────────────────────────────────────────────────────────────────
// CFBundleVersion in Info.plist is what the built app reports. PlistBuddy edits
// it in place without reformatting the rest of the file.
const iosDir = path.join(ROOT, 'ios');
if (fs.existsSync(iosDir)) {
  for (const plist of fs
    .readdirSync(iosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(iosDir, d.name, 'Info.plist'))
    .filter((p) => fs.existsSync(p))) {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleVersion ${n}`, plist], {
      stdio: 'ignore',
    });
    console.log(`  iOS      ${path.relative(ROOT, plist)} -> ${n}`);
    touched++;
  }
  // Kept in step so the Xcode target's own setting cannot contradict the plist.
  const pbx = path.join(iosDir, 'OKCalendar.xcodeproj', 'project.pbxproj');
  if (fs.existsSync(pbx)) {
    const before = fs.readFileSync(pbx, 'utf8');
    const after = before.replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${n};`,
    );
    if (after !== before) fs.writeFileSync(pbx, after);
  }
}

// ── Android ────────────────────────────────────────────────────────────────
const gradle = path.join(ROOT, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradle)) {
  const before = fs.readFileSync(gradle, 'utf8');
  const after = before.replace(/versionCode\s+\d+/, `versionCode ${n}`);
  if (after !== before) {
    fs.writeFileSync(gradle, after);
    console.log(`  Android  android/app/build.gradle -> ${n}`);
    touched++;
  }
}

if (!touched) {
  console.log(`  no native project to stamp yet — prebuild will bake ${n} from app.config.js`);
}
