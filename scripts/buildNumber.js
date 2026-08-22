/**
 * The build number for a LOCAL build — monotonic, stateless, and different on
 * every build.
 *
 * WHAT WAS WRONG. This used to be `git rev-list --count HEAD`, which fails the
 * requirement twice over. It only changes when you COMMIT, so two builds of the
 * same commit share a number; and it is read by app.config.js, which native
 * projects only consult at PREBUILD time — so the value sat frozen in
 * Info.plist and build.gradle until the next prebuild. In practice iOS was
 * stamped 120 and Android 130 while the config computed 136, and neither moved
 * however many times they were rebuilt.
 *
 * SECONDS SINCE AN EPOCH solves both. It needs no state file (nothing to commit,
 * nothing to get out of step between machines), it always increases, and any two
 * builds more than a second apart differ. It is also always far above the
 * numbers already installed, which matters: Android refuses to install an APK
 * whose versionCode is LOWER than the one on the device, so a counter restarting
 * at 1 would break sideloading onto a phone that already has build 130.
 *
 * Range is not a concern. Android's ceiling is 2,100,000,000; this reads about
 * 208,000,000 today and grows by ~31.5M a year, so it has some sixty years left.
 *
 * STORE BUILDS DO NOT USE THIS. EAS owns its own counter through
 * appVersionSource "remote" + autoIncrement, and app.config.js returns before
 * reaching here when EAS_BUILD is set. The two schemes never have to agree —
 * nothing compares a sideload's number with a store build's.
 */
const EPOCH = Date.UTC(2020, 0, 1);

function buildNumber() {
  return Math.floor((Date.now() - EPOCH) / 1000);
}

module.exports = { buildNumber };
