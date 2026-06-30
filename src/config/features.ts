// Build-time feature flags. `EXPO_PUBLIC_*` vars are inlined into the JS bundle at
// build time, so each of these folds to a constant the minifier fully resolves
// (the disabled branch is dead code in that build).

/**
 * The secret admin console is OWNER-ONLY. It must NOT exist in any App Store / EAS
 * build: it is high-privilege (backend terminal, push broadcast, destructive prod
 * commands) and Apple guideline 2.3.1 forbids hidden/undocumented features.
 *
 * - EAS builds (preview/production): `eas.json` sets EXPO_PUBLIC_ENABLE_SECRET_MENU
 *   = "false" -> this is `false` -> the 7-tap trigger does nothing and the SecretMenu
 *   route is not even registered, so the console is unreachable.
 * - Local sideloads on the owner's device (`expo run:ios`): the gitignored `.env.local`
 *   sets EXPO_PUBLIC_ENABLE_SECRET_MENU=true -> this is `true` -> the console works.
 *   (`.env.local` is gitignored, so it never reaches an EAS/cloud build.)
 */
export const SECRET_MENU_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SECRET_MENU === 'true';
