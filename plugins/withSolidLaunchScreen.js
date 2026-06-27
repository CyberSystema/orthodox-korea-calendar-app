const { withInfoPlist } = require('expo/config-plugins');

// Replace the storyboard-based launch screen with Apple's modern UILaunchScreen
// Info.plist API, configured as a pure SOLID COLOR (no storyboard, no image of
// any kind). expo-splash-screen's storyboard renders white in several cases on
// the New Architecture; UILaunchScreen with a color asset draws nothing but the
// brand color, so iOS shows a flat #3A0A0A launch screen that matches the native
// launch cover and the React-Native splash's first frame exactly.
//
// Requires the `SplashScreenBackground` color asset, which expo-splash-screen
// still generates from its `backgroundColor` config. Apply this plugin FIRST in
// app.json `plugins`: withMod is LIFO (the first-listed plugin's Info.plist action
// runs LAST), so listing it first guarantees our delete of UILaunchStoryboardName
// runs after expo-splash-screen sets it.
module.exports = function withSolidLaunchScreen(config) {
  return withInfoPlist(config, (cfg) => {
    // Remove the storyboard launch screen (it wins over UILaunchScreen if present).
    delete cfg.modResults.UILaunchStoryboardName;
    // Solid brand-color launch screen, no image.
    cfg.modResults.UILaunchScreen = {
      UIColorName: 'SplashScreenBackground',
      UIImageRespectsSafeAreaInsets: false,
    };
    return cfg;
  });
};
