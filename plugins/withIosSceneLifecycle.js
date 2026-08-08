const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

// Expo SDK 56's iOS template still starts React Native from
// `AppDelegate.didFinishLaunchingWithOptions` using an app-delegate-owned window
// and ships no UIScene support (see ExpoAppDelegate.swift "TODO: Configuring and
// Discarding Scenes"). The current iOS SDK *requires* apps to adopt the UIScene
// life cycle (Apple Technote TN3187) or they fail to launch with a runtime issue.
//
// This plugin makes the adoption survive `expo prebuild` / EAS builds by injecting
// BOTH halves together so they can never drift apart:
//   1. the UIApplicationSceneManifest (with a scene configuration) into Info.plist
//   2. a `SceneDelegate` into AppDelegate.swift that creates the window from the
//      connecting UIWindowScene, starts RN in it, and forwards deep links /
//      universal links / the Google Sign-In callback to the existing AppDelegate
//      handlers so expo-linking, associated domains, and OAuth keep working.

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

const SCENE_DELEGATE_SWIFT = `
// Injected by ./plugins/withIosSceneLifecycle.js — adopts the UIScene life cycle
// required by the current iOS SDK (Apple TN3187).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  // Exact launch-splash brand color from the asset catalog (matches the storyboard
  // byte-for-byte; the literal is the precise fallback if the named color fails).
  private static let brandBackground =
    UIColor(named: "SplashScreenBackground")
      ?? UIColor(red: 0.227450980392157, green: 0.0392156862745098, blue: 0.0392156862745098, alpha: 1.0)

  // The launch-screen white flash is React Native's own host view: RCTSurfaceHostingView
  // hardcodes a white layer, and the splash loading view / surface only attach via
  // didMoveToWindow, which runs AFTER window.makeKeyAndVisible() (inside startReactNative).
  // So for >=1 composited frame the white host layer is on screen with nothing over it,
  // and coloring the app window/root view does nothing because that white layer sits on top.
  // Compounding this, expo-updates defers the real RN root view and, after its async update
  // check, REASSIGNS the app window's rootViewController — landing a fresh (white-until-
  // painted) host view above any subview we add to the app window.
  // The fix: a solid brand-color cover hosted in its OWN window at a higher windowLevel,
  // brought up BEFORE makeKeyAndVisible so it paints on frame 0 and stays above both the
  // host view and any later rootViewController swap — then lifted with a single crossfade
  // only after React Native's first real frame has composited.
  private var coverWindow: UIWindow?
  private var coverContentObserver: NSObjectProtocol?

  private func makeCoverWindow(_ windowScene: UIWindowScene) -> UIWindow {
    // A SEPARATE window at a higher windowLevel hosting a plain solid brand-color view
    // (NO emblem). The JS ByzantineSplashScreen starts as a flat #3A0A0A and fades its
    // emblem/rings/gradient up from there, so a solid cover is pixel-identical to the
    // splash's first frame — the cover lifts invisibly and the splash simply materializes.
    // Using its own window (not a subview of the app window) keeps it above ANY
    // rootViewController the app window swaps in.
    let coverWindow = UIWindow(windowScene: windowScene)
    coverWindow.windowLevel = .normal + 1
    coverWindow.backgroundColor = SceneDelegate.brandBackground
    coverWindow.isUserInteractionEnabled = false
    let coverController = UIViewController()
    coverController.view.backgroundColor = SceneDelegate.brandBackground
    coverWindow.rootViewController = coverController
    return coverWindow
  }

  private func scheduleLaunchCoverDismissal() {
    // Lift only after RN's first content mounts AND the next render cycles complete,
    // so the real frame is on screen before the cover crossfades away.
    coverContentObserver = NotificationCenter.default.addObserver(
      forName: NSNotification.Name("RCTContentDidAppearNotification"),
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.dismissLaunchCover()
    }
    // Safety net: never let a missed signal leave the cover stuck.
    DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
      self?.dismissLaunchCover()
    }
  }

  private func dismissLaunchCover() {
    if let observer = coverContentObserver {
      NotificationCenter.default.removeObserver(observer)
      coverContentObserver = nil
    }
    guard let coverWindow = self.coverWindow else { return }
    self.coverWindow = nil
    // Two runloop hops span "content mounted" -> "pixels committed", so the splash
    // is fully painted before we crossfade the cover window away. This is the ONLY
    // transition animation — the React Native splash renders at full opacity
    // underneath, so there is no second fade to desync with.
    DispatchQueue.main.async {
      DispatchQueue.main.async {
        UIView.animate(
          withDuration: 0.35,
          delay: 0,
          options: [.curveEaseInOut],
          animations: { coverWindow.alpha = 0 },
          completion: { _ in
            coverWindow.isHidden = true
            coverWindow.windowScene = nil
          }
        )
      }
    }
  }

  /**
   * WHY THE iPad IS TOLD IT IS NARROW.
   *
   * iPadOS 18 moved a UITabBarController's bar to the TOP of the window. That is
   * not a style we opted into and no option turns it off: 'UITabBarController.mode'
   * offers only automatic / tabBar / tabSidebar, and the sidebar mode merely adds
   * a toggle button beside the very same top pill. The bar lands exactly where
   * every screen draws its branded ORTHODOX KOREA band, so the two collide, and
   * the tablet had to give up its headpiece — gradient, travelling sheen, knots,
   * closing rule — to the platform's plain header.
   *
   * But that top bar is not a property of the iPad, it is a property of a REGULAR
   * width environment. In COMPACT width UIKit renders the classic bottom bar, which
   * is why an iPad Split View window shows its tabs at the foot. react-native-screens
   * already reads 'horizontalSizeClass' for exactly this reason (RNSTabBarController
   * treats compact as the configuration that has a More controller) — it just never
   * writes it.
   *
   * So we write it. This is still the platform's own UITabBarController drawing its
   * own bar with iOS 26 Liquid Glass; only the environment it lays itself out for
   * changes. Nothing is reimplemented, so nothing can look nearly-native.
   *
   * SET ON THE WINDOW, not the root view controller, because expo-updates swaps the
   * root controller out after its update check — the same reason the launch cover
   * needs its own window. Overrides on the window survive that swap.
   *
   * VERTICAL is left alone: compact width + regular height is precisely an iPhone
   * in portrait, which is the arrangement the whole design was drawn for. The app
   * is portrait-only on every device (plugins/withPortraitOnly.js), so this is the
   * only combination that can occur.
   *
   * 'traitOverrides' is iOS 17+, and that is exactly the right floor: the top bar
   * arrived in iPadOS 18, and every earlier iPadOS already draws it at the bottom.
   * So the versions that cannot take the override are the versions that never
   * needed it.
   *
   * This does NOT shrink the layout. React Native sizes from the window, not from
   * the size class, so 'useWindowDimensions' still reports the full iPad width and
   * the tablet composition (src/theme/useLeaf.ts) is untouched.
   */
  private func useCompactWidthOnPad(_ window: UIWindow) {
    guard UIDevice.current.userInterfaceIdiom == .pad else { return }
    if #available(iOS 17.0, *) {
      window.traitOverrides.horizontalSizeClass = .compact
    }
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    window.backgroundColor = SceneDelegate.brandBackground
    self.window = window
    appDelegate.window = window

    // Before React Native builds anything: give the iPad a compact width
    // environment so the platform puts its tab bar at the BOTTOM (see above).
    useCompactWidthOnPad(window)

    // Bring up the cover window BEFORE startReactNative (which calls makeKeyAndVisible on
    // the app window), so brand color is painted on frame 0. Its higher windowLevel keeps
    // it above React Native's white host view AND above any rootViewController the app
    // window later swaps in (expo-updates replaces it asynchronously after its update check).
    let coverWindow = makeCoverWindow(windowScene)
    self.coverWindow = coverWindow
    coverWindow.makeKeyAndVisible()

    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
    window.rootViewController?.view.backgroundColor = SceneDelegate.brandBackground
    // startReactNative makes the app window key; the cover window stays visible above it
    // via its higher windowLevel. Re-assert visibility defensively.
    coverWindow.isHidden = false
    scheduleLaunchCoverDismissal()

    // Replay a deep link / universal link that cold-launched the app.
    for context in connectionOptions.urlContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
    for userActivity in connectionOptions.userActivities {
      _ = appDelegate.application(UIApplication.shared, continue: userActivity) { _ in }
    }
  }

  // Custom-scheme links (okncalendar://) and the Google Sign-In OAuth callback
  // delivered while the app is already running.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal links (associated domains) delivered while the app is running.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}
`;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return cfg;
  });
}

// Override that paints the React Native root view (RCTSurfaceHostingProxyRootView)
// the brand color. Without it the surface is white, which flashes in the frames
// between the native splash being dismissed and JS rendering its first frame.
// `super.customize` is called first so expo-splash-screen's own customizeRootView
// subscriber (which shows the splash loading view) still runs.
const CUSTOMIZE_ROOT_VIEW_SWIFT =
  `  // Injected by ./plugins/withIosSceneLifecycle.js — paint the RN root view the\n` +
  `  // brand background so there is no white flash before the first JS frame.\n` +
  `  override func customize(_ rootView: UIView) {\n` +
  `    super.customize(rootView)\n` +
  `    rootView.backgroundColor = UIColor(red: 0.227, green: 0.039, blue: 0.039, alpha: 1.0)\n` +
  `  }\n\n`;

// Pure transform (exported for testing) so the regex surgery can be validated
// without running a full prebuild.
function transformAppDelegateContents(input) {
  let contents = input;

  // Paint the RN root view brand-colored (idempotent). Anchored on the
  // ReactNativeDelegate extension-point comment the Expo template ships.
  if (!contents.includes('override func customize(')) {
    const anchor = '  // Extension point for config-plugins\n';
    if (!contents.includes(anchor)) {
      throw new Error(
        'withIosSceneLifecycle: could not find the ReactNativeDelegate extension point in ' +
          'AppDelegate.swift. The Expo template changed — update this plugin.',
      );
    }
    contents = contents.replace(anchor, `${anchor}\n${CUSTOMIZE_ROOT_VIEW_SWIFT}`);
  }

  // Idempotent: never inject the SceneDelegate twice.
  if (contents.includes('class SceneDelegate')) {
    return contents;
  }

  // Ensure UIKit is imported (UIWindowScene / UIScene live in UIKit).
  if (!/^import UIKit$/m.test(contents)) {
    contents = contents.replace(/^(import ReactAppDependencyProvider\n)/m, '$1import UIKit\n');
  }

  // Move RN startup out of didFinishLaunching — the SceneDelegate owns the window.
  const startupBlock = /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif\n/;
  if (!startupBlock.test(contents)) {
    throw new Error(
      'withIosSceneLifecycle: could not find the React Native startup block in AppDelegate.swift. ' +
        'The Expo template changed — update this plugin.',
    );
  }
  contents = contents.replace(
    startupBlock,
    '    // React Native is started from SceneDelegate (UIScene life cycle, TN3187).\n',
  );

  // Append the SceneDelegate class.
  return `${contents.trimEnd()}\n${SCENE_DELEGATE_SWIFT}`;
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle expects a Swift AppDelegate (Expo SDK 56+).');
    }
    cfg.modResults.contents = transformAppDelegateContents(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  config = withSceneInfoPlist(config);
  config = withSceneAppDelegate(config);
  return config;
};

// Exposed for the unit check in scripts; not part of the public plugin API.
module.exports._transformAppDelegateContents = transformAppDelegateContents;
