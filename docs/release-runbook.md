# Orthodox Korea Calendar: Release Runbook

## 1. Prerequisites

Run these once on your machine:

```bash
npm install
npm run doctor
```

If doctor fails, resolve issues before continuing.

For web admin sync (remote event CRUD), set this environment variable in your shell:

```bash
export EXPO_PUBLIC_APP_API_BASE_URL="https://<your-cloudflare-worker-domain>"
```

## 2. Local validation before any build

```bash
npm run typecheck
npm run doctor
npm run start:clear
```

## 3. First-time EAS setup

```bash
npx eas login
npx eas build:configure
```

If asked about Android credentials, choose managed unless you already maintain your own keystore.
If asked about iOS credentials, choose managed unless your team already owns cert/profile setup.

## 4. Internal preview builds

Android internal APK/AAB:

```bash
npm run build:android:preview
```

iOS internal build:

```bash
npm run build:ios:preview
```

Use these builds for QA and device testing.

## 5. Production builds

Android production:

```bash
npm run build:android:production
```

iOS production:

```bash
npm run build:ios:production
```

## 6. Submit to stores

Android Play Store submit:

```bash
npm run submit:android
```

iOS App Store Connect submit:

```bash
npm run submit:ios
```

## 7. Common failure diagnosis

### A. Build fails with dependency/version conflict

```bash
npm install
npm run doctor
npx expo install --fix
npm run doctor
```

### B. Android build fails with SDK or permission issues

```bash
echo $ANDROID_HOME
adb --version
```

Then verify `ANDROID_HOME` and `ANDROID_SDK_ROOT` are set in `.zshrc`.

### C. iOS build fails with signing/cert problems

Run:

```bash
npx eas credentials
```

Then regenerate credentials in managed mode.

### D. App opens but deep links do not route

Run locally and test:

```bash
npx uri-scheme open okncalendar://event/pascha-2026 --ios
npx uri-scheme open okncalendar://event/pascha-2026 --android
```

### E. Notifications not shown

Check permissions in Settings screen first, then:

```bash
npm run start:clear
```

For iOS physical device testing, ensure notifications are allowed in system settings.
