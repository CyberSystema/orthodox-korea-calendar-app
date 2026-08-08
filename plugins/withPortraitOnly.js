const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Locks the app to portrait on iPad as well as iPhone.
 *
 * WHY A PLUGIN IS NEEDED. `app.json`'s `orientation: "portrait"` writes only
 * `UISupportedInterfaceOrientations` — the iPhone key. Expo always writes the
 * iPad key with ALL FOUR orientations, so an iPad build has been rotating to
 * landscape since the first release, undesigned. That is not a setting anyone
 * chose; it is a default nobody saw.
 *
 * TWO KEYS, AND BOTH ARE REQUIRED. iPadOS only honours a restricted orientation
 * list if the app also opts out of multitasking: an app that supports Split View
 * and Slide Over must accept every orientation, because the system can hand it
 * any window shape. So `UIRequiresFullScreen` goes true at the same time. Setting
 * one without the other silently does nothing.
 *
 * WHAT THIS COSTS: no Split View, no Slide Over, no Stage Manager resizing. For a
 * calendar that is read a page at a time this is the right trade, and it is the
 * one the owner asked for.
 *
 * WORTH WATCHING: Apple has been steering iPad apps towards mandatory
 * multitasking, and `UIRequiresFullScreen` is deprecated on recent iPadOS. If a
 * future SDK stops honouring it the app will become resizable again — which is
 * why the layout is still written responsively rather than assuming one width.
 * It will degrade, not break.
 */
module.exports = function withPortraitOnly(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults['UISupportedInterfaceOrientations~ipad'] = [
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
    ];
    cfg.modResults.UIRequiresFullScreen = true;
    return cfg;
  });
};
