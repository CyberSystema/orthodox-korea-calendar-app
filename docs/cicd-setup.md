# CI/CD & Developer Experience — setup and runbook

Modern, fully-automated pipeline for OK Calendar, built on **EAS Workflows** (Expo's
first-party CI/CD that runs on Expo's own machines — no GitHub Actions minutes) plus a
thin developer-experience layer. Everything here is current as of **July 2026**.

> **What ships where.** EAS/store builds keep the secret menu **off** and the app ships to
> **both** App Store and Google Play. This pipeline never changes that — it just automates
> build → submit → OTA and adds quality gates.

---

## The shape of it

```
 feature branch ──PR──▶  ┌─ PR checks (EAS Workflow):   typecheck · i18n parity · expo-doctor
                         └─ EAS Update preview (GH Action): QR-code comment on the PR  📱
                                   │
                 merge to main ──▶  Deploy to staging (EAS Workflow, automatic)
                                    fingerprint → native? build(preview) : OTA→preview channel
                                   │
              release (manual) ──▶  Deploy to production (EAS Workflow, workflow_dispatch)
                                    fingerprint → native? build+submit both stores
                                                        : OTA→production channel (~1 min)
```

`fingerprint` = a hash of the native layer (deps, config, **patch-package patches**, plugins).
An OTA update only lands on a binary with a matching fingerprint, so CI can safely choose
"just push JS over-the-air" vs "cut a new native build."

---

## Phase 0 — one-time prerequisites

1. **Install the dev tooling** (activates Husky hooks via the `prepare` script):
   ```bash
   npm install
   ```
   This adds Husky, lint-staged, commitlint, Prettier, and tsx. After it runs, commits are
   auto-formatted and gated locally.

2. **Install the Expo GitHub App** and link this repo: expo.dev → your project → **GitHub**
   settings → install the app, connect `orthodox-korea-calendar-app`. This is what lets
   `push`/`pull_request` events trigger the `.eas/workflows/*.yml` files.

3. **Create an `EXPO_TOKEN`** (expo.dev → Account → **Access Tokens**) and add it as a
   **GitHub repo secret** named `EXPO_TOKEN` (Settings → Secrets and variables → Actions).
   Used only by the PR-preview GitHub Action.

---

## Phase 1 — developer experience (already scaffolded)

| File | What it does |
|---|---|
| `src/i18n/locales/ko.ts` | Typed `const ko: Translations` → **`tsc` fails on any en/ko key gap.** Zero deps. |
| `scripts/check-i18n-parity.ts` | `npm run i18n:check` — readable missing/extra-key diff (both directions). |
| `.husky/pre-commit` | Runs lint-staged (Prettier on staged) → `typecheck` → `i18n:check` before each commit. |
| `.husky/commit-msg` + `commitlint.config.js` | Enforces Conventional Commits (`feat:`, `fix:`, …). |
| `.prettierrc.json` / `.prettierignore` | Formatting: single quotes, trailing commas, width 100. |
| `eslint.config.js` | Flat Expo ESLint config — **optional**, see the comment inside to enable. |
| `renovate.json` | Dependency PRs for JS/dev-deps only; Expo-SDK-pinned packages are left to `expo install --fix`. |

**ESLint is intentionally not in the hot path** so the pipeline is green on day one. To adopt it:
`npx expo install eslint eslint-config-expo --dev`, run `npx expo lint` once to auto-fix, then
add `"*.{ts,tsx}": "eslint --fix"` to the `lint-staged` block and `npm run lint` to `pr.yml`.

**Renovate** requires installing the Renovate GitHub App on the repo; the committed
`renovate.json` configures it. Every dependency PR should pass the `expo-doctor` gate.

---

## Phase 2 — PR workflow

- **`.eas/workflows/pr.yml`** — quality gate on every PR to `main` (typecheck, i18n parity,
  expo-doctor), on EAS infra.
- **`.github/workflows/eas-preview.yml`** — the one small GitHub Action: publishes an EAS
  Update for the PR and comments a **QR code** on it (Expo's documented preview mechanism).

> The QR preview loads on a device that already has a **development or preview build** of the
> app installed — Expo Go can't run this app's custom native code. Build one once with
> `eas build --profile development` (or `preview`) and install it on your phone.

---

## Phase 3 — environment variables (migration)

Move config from `eas.json` `env` blocks into **EAS Environment Variables** (the single source
of truth across build **and** update). The `environment` field has already been added to each
build profile in `eas.json`; run these once, then remove the `env` blocks.

```bash
# Backend URLs — plaintext (they are inlined into the public JS bundle anyway)
eas env:create --name EXPO_PUBLIC_APP_API_BASE_URL \
  --value https://orthodox-korea-calendar-backend-staging.leontg.workers.dev \
  --environment preview --visibility plaintext --type string --non-interactive
eas env:create --name EXPO_PUBLIC_APP_API_BASE_URL \
  --value https://orthodox-korea-calendar-backend-production.leontg.workers.dev \
  --environment production --visibility plaintext --type string --non-interactive

# Owner-only secret-menu flag — false in every cloud build
eas env:create --name EXPO_PUBLIC_ENABLE_SECRET_MENU --value false \
  --environment preview --environment production \
  --visibility plaintext --type string --non-interactive

# Firebase config FILES (var names must match app.config.js exactly)
eas env:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type file \
  --value ./GoogleService-Info.plist \
  --environment preview --environment production --visibility secret --non-interactive
eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file \
  --value ./google-services.json \
  --environment preview --environment production --visibility secret --non-interactive
```

Then delete the `"env": { … }` blocks from the `preview` and `production` profiles in
`eas.json` (the `environment` field now supplies them), and pull them locally when needed:

```bash
eas env:pull --environment development   # writes a gitignored .env.local
eas env:list --environment production    # inspect
```

> **Why this matters (a real latent bug it fixes).** `eas.json` `env` blocks are **build-config
> only** — `eas update` does **not** read them. Since `EXPO_PUBLIC_*` is inlined at export time,
> an OTA update bundled without them could ship an empty backend URL. Moving these into EAS
> Environment Variables makes builds **and** OTA updates resolve the same values.
>
> Never mark an `EXPO_PUBLIC_*` var `secret` — it's public by nature and secret vars can't be
> bundled into updates. The Firebase files are fine as `secret` (build-time only). The API keys
> inside those files are shipped in the binary regardless — restrict them in the Firebase console.

---

## Phase 4 — fingerprint releases

`app.json` now uses `runtimeVersion: { policy: "fingerprint" }`. The production/staging
workflows fingerprint the native layer and pick build-vs-OTA automatically.

**Migration caveats — read before the first release:**

- **One build first.** Apps already installed on the *old* `appVersion` runtime (e.g. existing
  TestFlight installs) will **not** receive fingerprint-policy OTA updates. You must ship one new
  build on the fingerprint policy; only devices on that build onward get OTA. (Ideal to do now,
  pre-launch.)
- **Config-plugin bodies aren't fully hashed.** `@expo/fingerprint` identifies plugins by
  function name, so editing `plugins/withIosSceneLifecycle.js` *internals* without renaming the
  exported function may **not** change the fingerprint — force a rebuild manually when you do.
  Your **patch-package patches, `package.json` deps, and `app.json` are hashed** and behave
  correctly (a patch bump forces a rebuild, as it should).
- Sanity-check locally: `npx expo-updates fingerprint:generate --platform ios` and
  `eas fingerprint:compare`.

Run a production release with:
```bash
eas workflow:run .eas/workflows/deploy-production.yml
```

---

## Phase 5 — Sentry (staged; needs a Sentry project)

Not wired into `app.json`/Metro yet, because it needs your Sentry org/project and adds a
dependency (an incorrect plugin block would break `expo prebuild`). To enable:

```bash
npx expo install @sentry/react-native
```
```jsonc
// app.json plugins:
["@sentry/react-native/expo", { "organization": "<org>", "project": "<slug>" }]
```
```js
// metro.config.js
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
module.exports = getSentryExpoConfig(__dirname);
```
```ts
// wrap the root component: export default Sentry.wrap(RootApp)
```
- Add a `SENTRY_AUTH_TOKEN` **EAS environment variable** (secret) — source maps then upload
  automatically on EAS **Build**.
- **OTA source maps are NOT auto-uploaded.** After an `eas update`, run
  `npx sentry-expo-upload-sourcemaps dist` (add it as a step after the `update` jobs), or
  OTA-shipped JS crashes stay unsymbolicated.

You already get update-adoption / crash / unique-user data via **EAS Insights**
(`eas update:insights`) because the app uses expo-updates.

---

## Phase 6 — Maestro E2E (opt-in)

- `.maestro/smoke.yml` — launch → Today renders → tab to Month.
- `.maestro/deep-link.yml` — open via `okncalendar://` (adjust the path to a real route).
- `.eas/workflows/e2e.yml` — builds a credential-free APK (the `e2e-test` profile in `eas.json`)
  and runs the flows. **Trigger by adding the `e2e` label to a PR** (device minutes are billable).

Make the flows sturdier by adding `testID` props to key views and asserting on `id:` instead of
visible text.

---

## Plan / cost

EAS Workflows is included even on the **Free** plan (1 build concurrency, ~60 CI/CD min/month,
15 iOS + 15 Android builds). For a solo dev doing occasional releases that's usually enough;
**Starter ($19/mo)** adds a priority queue. Maestro E2E and extra concurrency are usage-billed —
keep E2E label-gated. Reconfirm current numbers at expo.dev/pricing.

## Rollback

- Delete any `.eas/workflows/*.yml` to remove that automation; delete `.github/workflows/eas-preview.yml`
  to drop the QR-preview Action entirely.
- Revert `app.json` `runtimeVersion.policy` to `"appVersion"` to undo fingerprint (then cut a build).
- The DX layer is inert without `npm install`; removing the `.husky/` dir + the `prepare` script disables hooks.
