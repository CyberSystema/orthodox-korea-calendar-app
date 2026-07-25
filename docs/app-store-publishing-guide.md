# Publishing Guide — Apple App Store & Google Play

A meticulous, end‑to‑end guide for shipping a mobile app to both stores. Written
around this project (Expo SDK 56 / React Native, managed via EAS, bundle id
`com.cybersystema.okncalendar`) but structured so it applies to **any** app. Where
a step is specific to this app it's marked **[this app]**.

> Time‑sensitive notes (fees, required API levels, console UIs, policy text) change
> often. Treat exact numbers as "verify on the day"; the _process_ is stable.

---

## 0. Mental model & realistic timeline

Both stores require the same five things, in this order:

1. **An identity** — a developer account (paid) + a permanent app id.
2. **A signed binary** — a release build cryptographically signed with your keys.
3. **Metadata** — name, description, screenshots, icon, category, age rating.
4. **Legal/compliance** — privacy policy, data‑collection disclosures, export
   compliance, content rating.
5. **A submission** — upload the binary, attach metadata, send for review.

**Realistic first‑launch timeline:** 1–2 weeks of prep (accounts, assets, legal),
then review: **Apple** typically 24–48 h (can be longer for a first app or if
flagged); **Google** first review can take **several days to a week** for a brand
new developer account, faster afterward. Build in buffer; do not promise a launch
date until you've passed one review.

**Cost:** Apple Developer Program **$99/year** (recurring). Google Play Console
**$25 one‑time**. Both are per‑account, not per‑app.

---

## 1. Accounts & enrollment (do this first — it has lead time)

### 1.1 Apple

- Create an **Apple ID** with 2FA, then enroll in the **Apple Developer Program**
  at developer.apple.com/programs.
- **Individual vs Organization:**
  - _Individual_ — fastest; your personal/legal name appears as the seller.
  - _Organization_ — requires a **D‑U‑N‑S number** (free, can take days to issue),
    legal entity verification, and authority to bind the company. Your company
    name appears as the seller. Choose this if it's a business/parish entity.
    **[this app]** the bundle id namespace `com.cybersystema.*` implies an org —
    decide whether the seller should be that entity.
- Enrollment includes identity verification and payment; allow 1–3 days.
- You'll also need **App Store Connect** access (appstoreconnect.apple.com) — same
  Apple ID. Set up **Users & Access** roles if a team is involved.
- For paid apps / in‑app purchases you must sign **Paid Apps agreements** and
  enter banking + tax info in _Agreements, Tax, and Banking_. Free apps only need
  the free agreement accepted.

### 1.2 Google

- Create/choose a **Google account**, go to play.google.com/console, pay the $25.
- **Account type:** Personal or Organization. As of recent policy Google requires
  **identity verification** (legal name, address, phone, and for orgs a D‑U‑N‑S
  number) and, for personal accounts created recently, **closed testing with ~12+
  testers for ~14 days** before you can apply for production access. Plan for this
  — it's the single most common surprise delay. Verify the current rule in Console.
- Accept the **Developer Distribution Agreement**.
- For paid apps/IAP, set up a **payments profile** (merchant account).

---

## 2. App identity & versioning (set once, never change casually)

### 2.1 Identifiers (permanent)

- **iOS Bundle Identifier** and **Android applicationId (package)** are the app's
  forever‑identity. Changing them = a brand‑new app (loses reviews, installs,
  rankings). **[this app]** both are `com.cybersystema.okncalendar` — keep them.
- Register the iOS **App ID** + capabilities in the Apple Developer portal (Push
  Notifications, Associated Domains, etc.). EAS/Xcode can auto‑register these.

### 2.2 Versioning model

Two numbers per platform:

- **Version / marketing version** (e.g. `1.0.0`) — user‑visible; same on both
  platforms ideally. Bump for releases.
- **Build number (iOS `CFBundleVersion`) / version code (Android `versionCode`)** —
  an integer that must **strictly increase** for every uploaded binary, even for
  the same marketing version. The store rejects a build whose number isn't higher
  than the last upload.

**[this app]** `eas.json` sets `"appVersionSource": "remote"` and the production
profile has `autoIncrement: true`, so EAS manages build numbers/version codes
server‑side. You only bump `version` in `app.json` for marketing releases.
For local/manual builds you manage these yourself (Xcode build number, Gradle
`versionCode`).

---

## 3. Signing & credentials (the part that trips everyone up)

### 3.1 iOS

- **Distribution certificate** (your team's signing identity) + an **App Store
  provisioning profile** for the app id.
- **Push:** an **APNs Auth Key (.p8)** (preferred — one key per team, no expiry) or
  per‑app APNs certificates. Needed for production push.
- **Easiest path:** let **EAS manage credentials** (`eas credentials` or during
  `eas build`) — it creates/stores the cert, profile, and APNs key for you.
- **Manual path:** Xcode → Signing & Capabilities → automatic signing with your
  team; archive and let Xcode manage the profile. Upload the APNs key in the
  developer portal.
- **[this app]** `app.json` sets `ios.appleTeamId: "4S3VW22A8G"`, so prebuilds keep
  the team. Add the **Push Notifications** capability (the app uses APNs via the
  Cloudflare backend).

### 3.2 Android

- A **release signing keystore** (a `.jks`/`.keystore` with a private key). **Back
  it up forever** — lose it and you can't update the app (unless on Play App
  Signing, see below).
- **Play App Signing (strongly recommended, default for new apps):** you keep an
  **upload key**; Google holds the actual **app signing key** and re‑signs your
  AAB. If you lose the upload key, Google can reset it. Generate an upload key once:
  ```bash
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore upload-keystore.jks -alias upload \
    -keyalg RSA -keysize 2048 -validity 10000
  ```
- **EAS path:** `eas build -p android` will offer to generate & store the keystore.
- **Manual path:** wire the keystore into `android/gradle.properties` +
  `android/app/build.gradle` release `signingConfig`.
- **SHA‑256 of your signing key** is needed for: Android **App Links** (assetlinks),
  Firebase, Google Sign‑In. Get it from `eas credentials`, Play Console (App
  integrity), or `keytool -list -v -keystore ...`.

---

## 4. Build tooling — pick your path

### 4.1 EAS (cloud) — recommended for Expo apps

- Install + log in: `npm i -g eas-cli` (already done **[this app]**), `eas login`,
  `eas build:configure`.
- Builds run in the cloud, credentials managed for you, no local Xcode/Android SDK
  needed. **[this app]** scripts exist:
  `npm run build:ios:production`, `build:android:production`,
  `submit:ios`, `submit:android` (the preview profiles point at the staging API).
- **Secrets/files:** `GoogleService-Info.plist` and `google-services.json` are
  gitignored — upload them to EAS as **file env secrets** (`eas secret:create
--type file`) or commit references resolved at build, or they'll be missing in
  cloud builds. The transparent splash/UIScene plugins regenerate native code on
  every EAS build, so the no‑flash splash is reproducible with zero manual steps.

### 4.2 Local builds (no EAS)

- You already have native `ios/` and `android/` from `expo prebuild`.
- **iOS:** open `ios/OKCalendar.xcworkspace` in Xcode → set Team → **Product →
  Archive** → **Distribute App → App Store Connect → Upload**. (Or `xcodebuild` +
  Transporter.) Build in **Release** for a Metro‑free binary.
- **Android:** `cd android && ./gradlew bundleRelease` → produces
  `android/app/build/outputs/bundle/release/app-release.aab` → upload in Play
  Console.
- **Caveat:** `expo prebuild --clean` regenerates `ios/`/`android/` and wipes local
  signing tweaks. Persist signing via `app.json` (`ios.appleTeamId`) and EAS, or
  re‑apply after prebuild.

### 4.3 Build format requirements

- **iOS:** an **`.ipa`** (App Store distribution), uploaded to App Store Connect.
- **Android:** an **`.aab` (Android App Bundle)** — APKs are **not** accepted for
  new Play submissions. Google generates per‑device APKs from your AAB.
- **Target API/SDK levels:** Google requires apps to **target a recent Android API
  level** (updated yearly — verify the current minimum). iOS requires building with
  a **recent Xcode/iOS SDK**. **[this app]** SDK 56 sets compliant targets; just
  keep the SDK current.

---

## 5. Metadata & store assets (prepare before you submit)

### 5.1 Shared

- **App name** (App Store ≤30 chars; Play ≤30 chars) — must be unique enough to be
  accepted; trademark‑safe. **[this app]** on‑device name is "OK Calendar"; the
  _store listing_ name is set separately in each console and can differ.
- **Subtitle (Apple, ≤30)** / **Short description (Play, ≤80)**.
- **Description** (Apple ≤4000; Play ≤4000). Clear, honest, no keyword stuffing.
- **Keywords (Apple only, ≤100 chars, comma‑separated)** — Play uses the
  description for indexing instead.
- **Category** (primary + optional secondary) and **content/age rating**.
- **Support URL** (required) and **Marketing URL** (optional).
- **Localizations** — add metadata per language you support. **[this app]** ships
  English + Korean; provide both store listings.

### 5.2 Icons

- **iOS:** a 1024×1024 PNG, **no alpha, no transparency, no rounded corners** (the
  system rounds it). **[this app]** `assets/icon.png` feeds this.
- **Android:** adaptive icon (foreground + background) — already configured in
  `app.json`. Play also wants a **512×512** "high‑res icon" for the listing.

### 5.3 Screenshots (required, and the most tedious part)

- **iOS:** required for at least the **6.7"/6.9" iPhone** size; iPad screenshots
  required only if the app supports iPad (**[this app]** `supportsTablet: true`, so
  provide iPad shots too — or disable tablet support to avoid it). 1–10 per size.
- **Android:** **phone screenshots (2–8)**, a **512×512 icon**, and a **1024×500
  feature graphic** (mandatory). 7‑inch & 10‑inch tablet shots if you target
  tablets/Chromebooks.
- Capture from a real device or simulator; use exact required pixel dimensions. Add
  captions/framing if you like (optional). **No misleading or placeholder content.**
- **iOS app preview videos** are optional.

### 5.4 Promo text / what's new

- **Apple "Promotional Text"** (≤170, editable without a new build) and
  **"What's New"** (release notes per version).
- **Play "What's new"** per release.

---

## 6. Legal & compliance (a rejection magnet — do it properly)

### 6.1 Privacy Policy (mandatory on both, even for free apps)

- Host a real privacy‑policy URL. Must describe what you collect, why, third
  parties, retention, and contact info. **[this app]** discloses: device **push
  token** (sent to your Cloudflare backend for notifications), and the staff/admin
  **auth token** for admin users. No analytics/ads currently.

### 6.2 Apple "App Privacy" questionnaire (App Store Connect)

- You declare every data type collected, whether it's **linked to the user**, and
  whether used for **tracking**. **[this app]** push token = "Identifiers" (device
  token), not linked to identity, not used for tracking. Be accurate — mismatches
  vs. observed behavior cause rejections.
- **App Tracking Transparency (ATT):** only needed if you track users across other
  companies' apps/sites (you don't). If you ever add ad SDKs, you must show the ATT
  prompt.

### 6.3 Google "Data safety" form (Play Console)

- Parallel to Apple's. Declare data collected/shared, encryption in transit,
  deletion options. **[this app]** push token collected, encrypted in transit
  (HTTPS to the Worker), not shared/sold.
- **Account/data deletion:** Google requires a way for users to request **data and
  account deletion** (in‑app and/or a web URL) if your app has accounts. **[this
  app]** has only a hidden staff/admin login, not user accounts — confirm whether
  Google considers that "accounts"; if so, provide a deletion path/URL.

### 6.4 Content & age rating

- **Apple:** answer the **Age Rating** questionnaire (violence, mature themes,
  etc.). A religious calendar = low rating; answer truthfully.
- **Google:** complete the **content rating questionnaire** (IARC) — generates
  ratings per region. Required before publishing.

### 6.5 iOS Export Compliance (every build)

- Apple asks whether your app uses encryption. Standard HTTPS = exempt. **[this
  app]** `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` is set, so you won't
  be re‑prompted each upload.

### 6.6 Other declarations

- **Apple:** "Sign in with Apple" is required only if you offer **third‑party
  social login** as the sole/primary login — N/A here.
- **Google target audience & content:** declare whether the app targets children
  (Families policy) — **[this app]** general audience, not child‑directed.
- **Permissions justification:** both stores scrutinize sensitive permissions.
  **[this app]** uses only notifications — keep it minimal; remove unused
  permissions to avoid questions.

---

## 7. Push notifications & Firebase (specific to this app)

- **Android (FCM):** `google-services.json` is wired in; ensure the Firebase
  project's **Cloud Messaging** is enabled and your Cloudflare backend has the FCM
  **service account / v1 credentials** to send.
- **iOS (APNs):** upload the **APNs key** to EAS (or the Apple portal) and configure
  the backend to send via APNs (sandbox for dev builds, production for
  store/TestFlight builds — the app already picks the env by build type).
- **Permission UX:** the app requests notification permission on first launch and
  re‑prompts later if denied — that pattern is App‑Store‑friendly. Don't gate core
  functionality behind notifications.
- Test a real push to a **TestFlight/internal‑track** build before launch
  (production APNs only works on store‑signed builds, not local dev).

---

## 8. Deep links / universal links (if you use them)

- **[this app]** scheme `okncalendar://` + associated domain
  `applinks:orthodox-korea-calendar.pages.dev`.
- **iOS Universal Links:** host an **`apple-app-site-association`** file at
  `https://<domain>/.well-known/apple-app-site-association` (JSON, served as
  `application/json`, no redirect) listing your appID (`TeamID.bundleID`).
- **Android App Links:** host **`/.well-known/assetlinks.json`** with your package
  name + the **signing‑cert SHA‑256** (from Play App Signing once uploaded).
- Without these files, tapping a web link won't deep‑link reliably. Add them to the
  pages.dev site. (Offer stands — I can generate both files for you.)

---

## 9. Build the production binary

**EAS:**

```bash
eas login
eas build:configure          # first time; writes the EAS projectId into app.json
npm run build:ios:preview     # internal test build first
npm run build:android:preview
# then:
npm run build:ios:production
npm run build:android:production
```

**Local:** see §4.2 (Xcode Archive / `./gradlew bundleRelease`).

Before building production:

- Confirm `app.json` `version` is the intended marketing version.
- Confirm the **production API base URL** is what ships (`eas.json` production
  `env.EXPO_PUBLIC_APP_API_BASE_URL`).
- Run `npm run typecheck` and `npm run doctor` (expo‑doctor) — both should be clean.

---

## 10. Create the store records & fill everything

### 10.1 App Store Connect

1. **My Apps → +** → New App. Platform iOS, name, primary language, **bundle id**
   (must already be registered), SKU (any unique string).
2. Fill the **version page**: description, keywords, support URL, screenshots,
   promo text, what's new, category, age rating.
3. **App Privacy** questionnaire (§6.2). **App Review Information**: contact details
   - a **demo account** if any part needs login. **[this app]** the public app needs
     no login; if a reviewer might find the hidden staff console, note it's
     admin‑only and not user‑reachable, or leave it — it's gated by a backend password.
4. **Pricing & Availability**: free, choose territories.
5. Attach the uploaded **build** (from EAS submit or Xcode/Transporter). Set the
   **release option** (manual, automatic, or scheduled).

### 10.2 Google Play Console

1. **Create app** → name, language, app/game, free/paid, declarations.
2. **Set up your app** dashboard checklist: privacy policy URL, app access (login
   instructions if any), **ads** declaration, **content rating**, **target
   audience**, **data safety**, **government/financial** declarations as applicable.
3. **Store listing**: short + full description, **icon (512)**, **feature graphic
   (1024×500)**, phone screenshots, category, contact details.
4. **Production → Create release** → upload the **AAB** → release notes → review.
   (First, Google may require you to run **internal/closed testing** — see §11.3.)

### 10.3 `eas submit` (optional automation)

- Fill `submit.production` in `eas.json` so submission is reproducible:
  - Android: a **Google Play service‑account JSON** (`serviceAccountKeyPath`) +
    track.
  - iOS: Apple ID / App Store Connect API key.
- Then `npm run submit:ios` / `submit:android`. **[this app]** these profiles are
  currently empty — fill them with your real credentials before using.

---

## 11. Testing tracks & submitting for review

### 11.1 Apple — TestFlight

- Every build uploaded to App Store Connect is available in **TestFlight**.
- **Internal testers** (up to 100, your team, no review) test immediately.
- **External testers** (up to 10,000) require a **light Beta App Review** first.
- Use TestFlight to validate push, deep links, performance, and the splash on a
  **production‑signed** build before submitting to the App Store.

### 11.2 Apple — submit

- On the version page, **Add for Review → Submit**. Answer export compliance,
  content rights, IDFA/advertising questions. Status flows: _Waiting for Review →
  In Review → Pending Developer Release / Ready for Sale_ (or _Rejected_).

### 11.3 Google — testing tracks (often mandatory now)

- Tracks: **Internal testing** (fast, up to 100 testers), **Closed testing**
  (larger, by email list/Google Group), **Open testing** (public beta),
  **Production**.
- New personal accounts typically must run **closed testing with the required
  tester count for the required days** before production is unlocked. Start this
  early — it's the biggest schedule risk.
- Promote a tested build to **Production → Create release → Review release → Start
  rollout to Production**.

---

## 12. The review process & common rejections

**Be ready for at least one rejection — it's normal.** Read the rejection reason
carefully, fix, resubmit; you can reply to reviewers (Apple's Resolution Center).

Frequent causes:

- **Crashes / broken core flow** on the reviewer's device/network. Test on a clean
  device, airplane‑mode edge cases, and a fresh install.
- **Privacy mismatch** — declared data ≠ observed behavior; missing/invalid privacy
  policy URL.
- **Incomplete metadata** — placeholder screenshots, broken support URL.
- **Permissions without justification** — asking for data you don't use.
- **Login walls** without a demo account / reviewer can't access content.
- **Apple "minimum functionality"** — apps that are just a website wrapper or feel
  unfinished. A real, polished native experience (you have one) passes.
- **Misleading metadata / other apps' trademarks.**
- **Google policy** — Data safety inaccuracies, target‑API too low, missing account
  deletion, or background location/SMS/accessibility misuse.

---

## 13. Release & rollout management

- **Apple release options:** _Manually release_ (you click after approval),
  _Automatically_, or _Scheduled_. For a first launch, **manual** gives control.
- **Apple Phased Release:** roll an update to a growing % of users over 7 days
  (auto‑pauses on spikes in issues). Optional but wise for updates.
- **Google staged rollout:** release to e.g. 5% → 20% → 50% → 100%; **halt** a
  rollout if crash rates spike (Play Console → Android vitals).
- Keep the **first version simple and stable**; iterate after you're live.

---

## 14. Post‑launch operations

- **Monitoring:** Apple **App Store Connect → Analytics** + crash logs; Google
  **Android vitals** (ANRs, crash rate) — watch these closely after each release.
- **Crash reporting:** consider adding Sentry/Crashlytics (a new SDK = re‑review
  your privacy declarations).
- **Updates:** bump `version`, build a new binary (build number auto‑increments via
  EAS), submit. Same review process, usually faster.
- **OTA (Expo Updates):** lets you push **JS‑only** changes without a store review.
  **[this app]** declares `channel`s in `eas.json` but **expo‑updates isn't wired
  up** (no `runtimeVersion`/projectId). To use OTA you'd add `expo-updates`; note
  stores allow JS OTA for bug fixes but **not** to materially change app behavior or
  bypass review. Native changes always require a new store build.
- **Respond to reviews**, keep the privacy policy current, and re‑target Android API
  levels yearly to stay compliant.

---

## 15. This‑app pre‑submission checklist [this app]

- [ ] Apple Developer Program + Google Play Console accounts active & verified.
- [ ] App records created in App Store Connect and Play Console with bundle id /
      package `com.cybersystema.okncalendar`.
- [ ] `eas build:configure` run (writes EAS `projectId` into `app.json`).
- [ ] iOS: APNs key uploaded; Push Notifications capability enabled; signing via
      EAS or Xcode (team `4S3VW22A8G`).
- [ ] Android: upload keystore created & backed up; Play App Signing enabled.
- [ ] `GoogleService-Info.plist` + `google-services.json` provided to the build
      (EAS file secrets for cloud builds).
- [ ] Cloudflare backend has APNs + FCM credentials; a real push verified on a
      TestFlight/internal build.
- [ ] Privacy policy URL live; Apple App Privacy + Google Data Safety filled.
- [ ] Content/age ratings completed on both stores.
- [ ] `apple-app-site-association` + `assetlinks.json` hosted on the pages.dev
      domain (for deep links).
- [ ] Icons + screenshots (iPhone 6.7"/6.9", iPad if tablet stays on, Android phone + 1024×500 feature graphic) prepared in both languages (en + ko).
- [ ] `submit.production` in `eas.json` filled (Play service account / Apple IDs)
      if using `eas submit`.
- [ ] `npm run typecheck` + `npm run doctor` clean; production API URL correct.
- [ ] Tested the production‑signed build on a real device (push, deep links,
      calendar sync, splash, both languages) before submitting.

---

## 16. Quick command reference

```bash
# Tooling
npm i -g eas-cli            # EAS CLI (global)
eas login                   # authenticate
eas build:configure         # one-time project link

# Builds
npm run build:ios:preview / build:android:preview        # internal test
npm run build:ios:production / build:android:production   # store binary
npm run submit:ios / submit:android                       # upload to the store

# Local (no EAS)
npx expo prebuild --clean                                 # regenerate ios/ + android/
open ios/OKCalendar.xcworkspace                           # Xcode → Archive → Upload
cd android && ./gradlew bundleRelease                     # -> app-release.aab

# Credentials / signing
eas credentials                                           # manage iOS/Android keys
keytool -genkeypair -v -storetype PKCS12 \
  -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000               # Android upload key

# Health
npm run typecheck && npm run doctor                       # gate before any build
```
