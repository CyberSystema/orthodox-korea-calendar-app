const { withGradleProperties } = require('expo/config-plugins');

// The Expo/RN template ships `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`.
// That Metaspace ceiling is too small for this app: KSP (Kotlin Symbol Processing) runs
// across ~15 Expo modules with `org.gradle.parallel=true` and four ABIs, and the build
// dies with `e: [ksp] java.lang.OutOfMemoryError: Metaspace`. The Gradle daemon then
// wedges — every worker sits at 0% CPU and the CLI waits forever, so it looks "stuck"
// rather than failing cleanly.
//
// Raise the daemon's Metaspace/heap, and give the Kotlin daemon its own budget (the
// template sets none, so KSP competes for the Gradle daemon's memory).
//
// This lives in a config plugin because `android/` is gitignored, generated output —
// hand-editing android/gradle.properties is wiped by the next prebuild.

const JVM_ARGS = '-Xmx6144m -XX:MaxMetaspaceSize=2048m';
const KOTLIN_DAEMON_JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

const COMMENT =
  'Raised by ./plugins/withAndroidBuildMemory.js — KSP exhausts the default Metaspace.';

const PROPERTIES = [
  ['org.gradle.jvmargs', JVM_ARGS],
  ['kotlin.daemon.jvmargs', KOTLIN_DAEMON_JVM_ARGS],
];

// Pure transform (exported for a self-test) so the edit can be validated without
// running a full prebuild.
function transformProperties(items) {
  let result = [...items];

  for (const [key, value] of PROPERTIES) {
    const index = result.findIndex((item) => item.type === 'property' && item.key === key);

    if (index === -1) {
      result.push({ type: 'comment', value: COMMENT });
      result.push({ type: 'property', key, value });
      continue;
    }

    // Overwrite in place, keeping the property's position in the file.
    result[index] = { type: 'property', key, value };

    // Drop a previously injected comment so repeated prebuilds don't stack them.
    const before = result[index - 1];
    if (before && before.type === 'comment' && before.value === COMMENT) {
      result.splice(index - 1, 1);
    }
    const insertAt = result.findIndex((item) => item.type === 'property' && item.key === key);
    result.splice(insertAt, 0, { type: 'comment', value: COMMENT });
  }

  return result;
}

module.exports = function withAndroidBuildMemory(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = transformProperties(cfg.modResults);
    return cfg;
  });
};

// Exposed for the self-test; not part of the public plugin API.
module.exports._transformProperties = transformProperties;
