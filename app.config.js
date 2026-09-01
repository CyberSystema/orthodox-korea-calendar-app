const base = require('./app.json');

/**
 * Build numbers are NOT computed here, and that is the point.
 *
 * `version` (YYYYMM.x) is a human decision and stays in app.json, written by
 * scripts/bump-version.mjs when a store build is cut. The per-build number is
 * written straight into the native projects by scripts/stamp-build-number.mjs
 * before every local build, and by EAS remotely for store builds
 * (appVersionSource "remote" + autoIncrement).
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
 *
 * It also used to read process.env.GOOGLE_SERVICES_JSON, which resolved to an EAS
 * temp path remotely and a relative path locally — a second, quieter source of
 * nondeterminism. That went away with Firebase: OneSignal builds its own named
 * FirebaseApp from config it fetches at runtime, so the app needs no
 * google-services.json and no GoogleService-Info.plist at all. The FCM service
 * account is uploaded to the OneSignal dashboard instead. This file is now
 * genuinely environment-independent, which is what the fingerprint wanted all along.
 *
 * The same rule is why every onesignal-expo-plugin option in app.json is a LITERAL.
 * An env-driven `mode` would resolve one way inside an EAS build (where the var is
 * set) and another on the machine running `npm run update:*` (where it is not); the
 * two fingerprints diverge and the OTA is published against a runtime no installed
 * binary matches. Nothing crashes — the updates simply never arrive, which is much
 * harder to notice. Same ban on an env-driven smallIcons path or accent colour.
 *
 * WHY THE ONESIGNAL PLUGIN IS SECOND, NOT FIRST
 * OneSignal's docs say "place this plugin first" without saying why. withSolidLaunchScreen
 * has a documented reason to be first: config-plugin mods run LIFO, so the first-listed
 * plugin runs LAST, which is how its solid-colour UILaunchScreen lands after
 * expo-splash-screen has written its storyboard. The conflict is only apparent — with
 * `disableNSE: true` the OneSignal plugin's entire iOS surface is `aps-environment`
 * (entitlements) plus `UIBackgroundModes += remote-notification` (Info.plist). That is
 * zero key overlap with UILaunchStoryboardName/UILaunchScreen, and it never calls
 * withAppDelegate, so it cannot collide with withIosSceneLifecycle either. Second place
 * honours the spirit of "first" without breaking the invariant that has a reason.
 * Verified after prebuild: UILaunchScreen present, UILaunchStoryboardName absent,
 * UIApplicationSceneManifest present, aps-environment = production.
 *
 * `disableNSE` also skips withEasManagedCredentials, which is the concrete mechanism
 * that keeps EAS-managed iOS credentials working exactly as before — no second bundle
 * identifier, no App Groups, no extra provisioning profiles. The app uses no rich
 * media and no badges, and confirmed delivery is a paid OneSignal feature regardless.
 *
 * NOTE: the plugin rejects unknown props outright, including the `"//"` comment key
 * this repo uses elsewhere in app.json — which is why this rationale lives here.
 */
module.exports = () => {
  // One shape, always. No branch on EAS_BUILD and no computed values: EAS owns its
  // own build numbers remotely, stamp-build-number.mjs owns the local ones, and
  // this file only has to resolve the same way every time it is read.
  return { expo: base.expo };
};
