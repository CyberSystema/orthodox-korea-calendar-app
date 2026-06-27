const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Some CocoaPods (notably `RNSVG-RNSVGFilters` from react-native-svg) hardcode an
// iOS deployment target (12.4) below what the current Xcode accepts (min 15.0).
// `expo-build-properties`'s `ios.deploymentTarget` only sets the Podfile *platform*
// default, which overriding pods ignore — so the build fails on those pods.
//
// This plugin appends a loop to the Podfile's existing `post_install` block that
// force-raises EVERY pod target's IPHONEOS_DEPLOYMENT_TARGET to the app minimum.
// It runs on every prebuild so the fix can never drift away.

const DEPLOYMENT_TARGET = '16.4';
const MARKER = 'withMinIosDeploymentTarget';

const SNIPPET =
  `\n    # Injected by ./plugins/${MARKER}.js — force every pod target to the app's\n` +
  `    # minimum iOS version (some sub-pods hardcode an unsupported lower one).\n` +
  `    installer.pods_project.targets.each do |target|\n` +
  `      target.build_configurations.each do |bc|\n` +
  `        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
  `        if current.nil? || current.to_f < ${DEPLOYMENT_TARGET}\n` +
  `          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'\n` +
  `        end\n` +
  `      end\n` +
  `    end\n`;

// Pure transform (exported for a self-test) so the surgery can be validated
// without running a full prebuild.
function transformPodfile(input) {
  if (input.includes(MARKER)) {
    return input; // idempotent — never inject twice
  }

  // Match the Expo template's post_install block and insert our loop just before
  // its closing `end`.
  const postInstall = /\n  post_install do \|installer\|\n[\s\S]*?\n  end\n/;
  if (!postInstall.test(input)) {
    throw new Error(
      `${MARKER}: could not find the post_install block in the Podfile. ` +
        'The Expo template changed — update this plugin.',
    );
  }

  return input.replace(postInstall, (block) =>
    block.replace(/\n  end\n$/, `\n${SNIPPET}  end\n`),
  );
}

module.exports = function withMinIosDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, transformPodfile(contents));
      return cfg;
    },
  ]);
};

// Exposed for the self-test; not part of the public plugin API.
module.exports._transformPodfile = transformPodfile;
