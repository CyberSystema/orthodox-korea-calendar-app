const { execFileSync } = require('node:child_process');

const base = require('./app.json');

/**
 * Build numbers, assigned automatically and independently of the version.
 *
 * `version` ("1.3") is a human decision and stays in app.json. The build number
 * and the Android version code are bookkeeping — they only have to increase —
 * and having to remember to bump them by hand is how a build gets rejected at
 * submission, or how two sideloads end up claiming to be the same one.
 *
 *   EAS builds    eas.json sets appVersionSource "remote" with autoIncrement, so
 *                 EAS keeps the counter server-side and raises it per build. That
 *                 is the only scheme that survives a rebuild of the same commit,
 *                 which the App Store rejects if the build number repeats.
 *
 *   LOCAL builds  seconds since 2020, from scripts/buildNumber.js — see the note
 *                 there for why this replaced `git rev-list --count HEAD`, which
 *                 only moved when you committed.
 *
 * This path only runs when a PREBUILD happens. A plain `expo run:*` against an
 * existing ios/ or android/ never reads this file, which is why every local build
 * script also runs scripts/stamp-build-number.mjs first.
 */
const { buildNumber } = require('./scripts/buildNumber.js');

/**
 * Firebase config files are gitignored, and EAS only uploads what git tracks — so
 * a build fails with "GoogleService-Info.plist is missing" unless the file is
 * handed over some other way.
 *
 * iOS DOES NOT NEED ONE. No Firebase package is installed, no plugin asks for it,
 * and iOS push goes to APNs directly (see EXPO_PUBLIC_APNS_ENV). The reference in
 * app.json was vestigial and is dropped here rather than satisfied — supplying a
 * file nothing reads only moves the failure.
 *
 * ANDROID GENUINELY NEEDS ONE: the Google Services Gradle plugin reads the package
 * name out of google-services.json and fails the build without a match, and FCM
 * is how announcements reach Android. On EAS it arrives as a file environment
 * variable, whose path lands in GOOGLE_SERVICES_JSON; locally the checked-out
 * file is used.
 *
 *   eas env:create --name GOOGLE_SERVICES_JSON --type file \
 *     --value ./google-services.json --visibility secret --environment production
 */
function firebase(expo) {
  const ios = { ...expo.ios };
  delete ios.googleServicesFile;
  return {
    ios,
    android: {
      ...expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? expo.android.googleServicesFile,
    },
  };
}

module.exports = () => {
  const expo = { ...base.expo, ...firebase(base.expo) };

  // On EAS, remote versioning owns these; touching them here would fight it.
  if (process.env.EAS_BUILD) return { expo };

  const n = buildNumber();

  return {
    expo: {
      ...expo,
      ios: { ...expo.ios, buildNumber: String(n) },
      android: { ...expo.android, versionCode: n },
    },
  };
};
