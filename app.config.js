const { execFileSync } = require('node:child_process');

const base = require('./app.json');

/**
 * Build numbers are NOT computed here, and that is the point.
 *
 * `version` ("1.3", soon YYYYMM.x) is a human decision and stays in app.json,
 * written by scripts/bump-version.mjs when a store build is cut. The per-build
 * number is written straight into the native projects by
 * scripts/stamp-build-number.mjs before every local build, and by EAS remotely
 * for store builds (appVersionSource "remote" + autoIncrement).
 *
 * THIS FILE MUST BE DETERMINISTIC. runtimeVersion uses the fingerprint policy,
 * and the resolved Expo config is one of the fingerprint's inputs — so anything
 * here that varies between two identical runs makes the fingerprint vary too, and
 * a runtime that changes on its own is a runtime no update can ever match.
 *
 * That is not hypothetical: an earlier version of this file derived the build
 * number from Date.now(), and two consecutive `expo-updates fingerprint:generate`
 * runs seconds apart produced different hashes, with `expoConfig` as the single
 * differing source. Do not put a clock, a random value or a git call in here.
 */

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
  // One shape, always. No branch on EAS_BUILD and no computed numbers: EAS owns
  // its own build numbers remotely, stamp-build-number.mjs owns the local ones,
  // and this file only has to resolve the same way every time it is read.
  return { expo: { ...base.expo, ...firebase(base.expo) } };
};
