/**
 * What the runtime fingerprint is allowed to notice.
 *
 * runtimeVersion uses the fingerprint policy, so this file decides which builds
 * can receive a given OTA update. It has to notice every change to the NATIVE
 * layer — a JS bundle sent to a build whose native side no longer matches is a
 * crash — and it must ignore everything else, or updates fragment for no reason.
 *
 * ExpoConfigVersions is the one skip that matters here, and without it calendar
 * versioning would not work at all. The resolved Expo config is a fingerprint
 * input, and `version` lives in it — so with YYYYMM.x rewriting the version on
 * every store build, every release would land on its own runtime and an update
 * would reach only the users on that exact release. MEASURED before adding this:
 * changing version 1.3 -> 202608.7 moved the hash from b87d8c8f to 00bff9f6.
 * The skip covers version, ios.buildNumber and android.versionCode, which are
 * bookkeeping and cannot affect native compatibility.
 *
 * Everything else is left ON deliberately. In particular the native directories,
 * the podfile/gradle layer, the config plugins and the dependency set all still
 * count — a change to any of those genuinely can break a JS bundle, and the
 * fingerprint is the only thing standing between that and a crash on launch.
 */
const { SourceSkips } = require('@expo/fingerprint');

module.exports = {
  sourceSkips: SourceSkips.ExpoConfigVersions,
};
