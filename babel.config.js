module.exports = function (api) {
  api.cache(true);

  return {
    // Reanimated 4 needs the react-native-worklets Babel transform, but
    // babel-preset-expo (SDK 57) auto-injects `react-native-worklets/plugin`
    // (and positions it last) whenever the package is installed, so we must NOT
    // list it manually — doing so double-applies the worklets transform.
    presets: ['babel-preset-expo'],
  };
};
