// Dynamic Expo config layered on top of the static app.json.
//
// Why this file exists: the Firebase config files (GoogleService-Info.plist and
// google-services.json) are gitignored, so EAS cloud builds do not receive them
// from the git upload. We provide them to EAS as file-type environment variables
// (`eas env:create --type file --name GOOGLE_SERVICE_INFO_PLIST ...` /
// `... --name GOOGLE_SERVICES_JSON ...`), which the build exposes as a filesystem
// path in process.env. Here we point Expo's `googleServicesFile` at that path,
// falling back to the local file for local builds (`expo prebuild`, `expo run:*`)
// where the env var is not set.
//
// Everything else continues to come from app.json — Expo loads it first and
// passes its contents in as `config`.

export default ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
