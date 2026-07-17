/**
 * i18n key-parity gate.
 *
 * en.ts and ko.ts must stay at FULL key parity — a key present in one locale but
 * missing from the other renders the raw key string ("settings.title") to users,
 * which is a release blocker. The type-level guard in ko.ts (`const ko: Translations`)
 * already fails `tsc`; this script adds a fast, human-readable diff for local runs
 * and CI, and reports BOTH directions (missing and extra) at once.
 *
 * Run:  npm run i18n:check
 */
import en from '../src/i18n/locales/en';
import ko from '../src/i18n/locales/ko';

type Dict = Record<string, unknown>;

/** Flatten nested keys to dotted paths; arrays (e.g. weekdays) are treated as leaves. */
const flatten = (obj: Dict, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Dict, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const enKeys = new Set(flatten(en as Dict));
const koKeys = new Set(flatten(ko as Dict));

const missingInKo = [...enKeys].filter((k) => !koKeys.has(k)).sort();
const extraInKo = [...koKeys].filter((k) => !enKeys.has(k)).sort();

if (missingInKo.length || extraInKo.length) {
  if (missingInKo.length) {
    console.error(`\n❌ Missing in ko.ts (present in en.ts):\n  ${missingInKo.join('\n  ')}`);
  }
  if (extraInKo.length) {
    console.error(`\n❌ Extra in ko.ts (not in en.ts):\n  ${extraInKo.join('\n  ')}`);
  }
  console.error(
    `\ni18n parity FAILED — ${missingInKo.length} missing, ${extraInKo.length} extra.\n`,
  );
  process.exit(1);
}

console.log(`✅ i18n en/ko key parity OK (${enKeys.size} keys)`);
