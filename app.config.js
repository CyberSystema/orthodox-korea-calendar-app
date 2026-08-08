const { execFileSync } = require('node:child_process');

const base = require('./app.json');

/**
 * Build numbers, assigned automatically and independently of the version.
 *
 * `version` ("1.3") is a human decision and stays in app.json. The build number
 * and the Android version code are bookkeeping — they only have to increase —
 * and having to remember to bump them by hand is how a build gets rejected at
 * submission, or how two different sideloads end up claiming to be the same one.
 *
 * TWO MECHANISMS, because the two environments genuinely differ:
 *
 *   EAS builds    eas.json sets appVersionSource "remote" with autoIncrement, so
 *                 EAS keeps the counter server-side and raises it per build. That
 *                 is the only scheme that survives a rebuild of the same commit,
 *                 which the App Store rejects if the build number repeats.
 *
 *   LOCAL builds  the count of commits on HEAD. Monotonic, needs no state file,
 *                 no network and no manual step, and it is stable for a given
 *                 commit — so rebuilding the same code twice produces the same
 *                 number rather than inflating it. Sideloads never reach a store,
 *                 so stability is worth more than strict novelty here.
 *
 * These do NOT have to agree, and they will not: nothing compares a sideload's
 * build number with a store build's. They only have to increase within their own
 * world, which each does.
 *
 * The git call is deliberately confined to the local branch. EAS uploads the
 * committed tree WITHOUT `.git`, so `git rev-list` cannot run on a builder — the
 * fallback below is what runs there, and EAS overwrites the value anyway.
 */
function commitCount() {
  try {
    const out = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const n = Number.parseInt(out, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    // No git, no history, or a builder that was handed a bare tree.
    return null;
  }
}

module.exports = () => {
  const expo = { ...base.expo };

  // On EAS, remote versioning owns these; touching them here would fight it.
  if (process.env.EAS_BUILD) return { expo };

  const n = commitCount();
  if (n === null) return { expo };

  return {
    expo: {
      ...expo,
      ios: { ...expo.ios, buildNumber: String(n) },
      android: { ...expo.android, versionCode: n },
    },
  };
};
