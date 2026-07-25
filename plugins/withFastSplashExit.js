const { withAndroidStyles } = require('expo/config-plugins');

// expo-splash-screen writes `android:windowSplashScreenBehavior=icon_preferred` into
// the Android 12+ splash theme, which asks the system to always present the splash
// icon and run its animation before handing off to the app. This app deliberately has
// no splash icon (the drawable is fully transparent — see the expo-splash-screen block
// in app.json), so that request only delays the hand-off to the animated
// ByzantineSplashScreen: measured 645ms -> 612ms time-to-first-frame on a Fairphone 5
// simply by dropping it.
//
// Replace it with an explicit zero-length splash animation so the system exits as soon
// as the app can draw.
//
// Lives in a config plugin because `android/` is gitignored generated output — editing
// android/app/src/main/res/values/styles.xml by hand is wiped by the next prebuild.

const SPLASH_STYLE = 'Theme.App.SplashScreen';
const BEHAVIOR_ITEM = 'android:windowSplashScreenBehavior';
const DURATION_ITEM = 'android:windowSplashScreenAnimationDuration';

// Pure transform (exported for a self-test) so the edit can be validated without a
// full prebuild.
function transformStyles(styles) {
  const target = styles?.resources?.style?.find((s) => s?.$?.name === SPLASH_STYLE);
  if (!target) {
    throw new Error(
      `withFastSplashExit: no <style name="${SPLASH_STYLE}"> in styles.xml. ` +
        'expo-splash-screen changed its output — update this plugin.',
    );
  }

  const items = (target.item ?? []).filter(
    (item) => item?.$?.name !== BEHAVIOR_ITEM && item?.$?.name !== DURATION_ITEM,
  );
  items.push({ $: { name: DURATION_ITEM }, _: '0' });
  target.item = items;

  return styles;
}

module.exports = function withFastSplashExit(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = transformStyles(cfg.modResults);
    return cfg;
  });
};

// Exposed for the self-test; not part of the public plugin API.
module.exports._transformStyles = transformStyles;
