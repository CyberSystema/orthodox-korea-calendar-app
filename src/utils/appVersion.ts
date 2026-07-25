import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * App version for display, formatted as "x.x (build)" (e.g. "1.1 (1)").
 *
 * Reads from the embedded Expo app config (app.json is the single source of truth
 * under local versioning) rather than the native binary's Info.plist. A local
 * sideload reuses a generated `ios/` project that can be stale — `expo run:ios`
 * does not always re-sync CFBundleShortVersionString — so `expo-application` would
 * report an old version there. `Constants.expoConfig` is rebundled from the current
 * app.json on every build, so this always tracks the production version. Falls back
 * to the native values if the config is somehow unavailable.
 */
export function getAppVersionLabel(): string {
  const cfg = Constants.expoConfig;

  const version = cfg?.version ?? Application.nativeApplicationVersion ?? '';

  const build =
    Platform.OS === 'ios'
      ? (cfg?.ios?.buildNumber ?? Application.nativeBuildVersion ?? '')
      : cfg?.android?.versionCode != null
        ? String(cfg.android.versionCode)
        : (Application.nativeBuildVersion ?? '');

  return build ? `${version} (${build})` : version;
}
