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

/**
 * True only in the owner's local sideloads — the same switch as the console
 * above, named for the broader thing it now gates.
 *
 * THE PRODUCT RULE: the store app is for parishioners and must show them nothing
 * technical — no backend URLs, no sync state, no build metadata. The owner's
 * sideload is the opposite: it should surface as much as possible about what the
 * app is doing, for debugging. Anything that answers "what is the app doing right
 * now" belongs behind this flag.
 *
 * Because `EXPO_PUBLIC_*` is inlined at build time this folds to a literal, so a
 * store build does not merely hide these screens — their code is dead and the
 * routes are never registered.
 */
export const DIAGNOSTICS_ENABLED = SECRET_MENU_ENABLED;
