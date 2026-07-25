const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Cold-start optimisation. Expo's default is `inlineRequires: false`, which makes
// Hermes evaluate the whole module graph up front — this app's bundle is ~3.5 MB of
// bytecode and that evaluation is the bulk of the time the bare launch screen is on
// screen before the animated splash can draw. Inlining requires defers each module's
// factory to first use.
//
// `experimentalImportSupport` mirrors Expo's default and must stay true.
//
// NOTE: this changes WHEN module side effects run. The one this app depends on is
// `import '../i18n'` in RootApp (it calls i18next .init()); side-effect-only imports
// keep their top-level require, and this was verified on-device — translations render,
// not raw keys. Re-check that after upgrading Expo/Metro.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});

module.exports = config;
