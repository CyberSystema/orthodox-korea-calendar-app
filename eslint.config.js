// Flat ESLint config extending Expo's shared config.
//
// OPTIONAL layer — not in the hot path yet. To enable:
//   1) npx expo install eslint eslint-config-expo --dev
//   2) add  "*.{ts,tsx}": "eslint --fix"  to the lint-staged block in package.json
//   3) add  npm run lint  (or `npx expo lint`) as a step in .eas/workflows/pr.yml
//
// Kept out of the default gate so the pipeline is green on day one; adopt after a
// one-time `npx expo lint` cleanup pass on the existing source.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  { ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'node_modules/*', 'patches/*'] },
];
