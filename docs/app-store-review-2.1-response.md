# App Store Review — Guideline 2.1 "Information Needed" response

Apple's **Guideline 2.1 – Information Needed** is a metadata/information request, **not a code rejection** — the build is fine. Reply in the **Resolution Center**, attach a screen recording, and paste the text below into **App Store Connect → App Review Information → Notes** (Apple asks you to keep it there for future submissions). **No new build is required** for an information request; changing screenshots is also metadata (no new build).

App facts this is based on (verified): free app, **no user accounts / login / account deletion**, **no in‑app purchases / subscriptions / ads**, **no user‑generated content**, the **only permission is Notifications** (no location/contacts/camera/microphone/photos/tracking, no purpose strings beyond `ITSAppUsesNonExemptEncryption=false`).

---

## Ready‑to‑paste reply (fill in the two `[…]` OS versions)

```
Thank you for the review. This is a free app with no user accounts and no in-app purchases. Answers to each point:

1) SCREEN RECORDING: Attached. It launches the app and walks the typical flow: Today view (daily Orthodox feasts, fasts, saints, Scripture readings) → Month calendar (tap a day for details) → open an event → Search → Settings (switch English/Korean, notifications). There are no account, purchase, user-generated-content, location/contacts/camera, or App Tracking Transparency flows in the app, so none appear.

2) DEVICES & OS TESTED:
- iPhone 13 mini — iOS [FILL EXACT VERSION]
- iPad Pro 11-inch (M4) — iPadOS [FILL EXACT VERSION]
Built with the current iOS SDK.

3) PURPOSE & AUDIENCE: "OK Calendar" (Orthodox Korea Calendar) is a free liturgical calendar for the Orthodox Christian faithful of the Orthodox Metropolis of Korea and Exarchate of Japan, in English and Korean. For each day it shows the Orthodox liturgical information — feasts, fasts, commemorated saints, and the appointed Scripture readings — in a daily "Today" view and a monthly calendar, plus community/parish events. It helps Orthodox Christians (and anyone interested in the Orthodox calendar) follow the Church year. Primary audience: Orthodox Christians in Korea; usable worldwide.

4) ACCESSING MAIN FEATURES / CREDENTIALS: No account, registration, or login is required — every feature is available immediately on launch, so no demo credentials are needed and there is no account-deletion flow (no user accounts exist). Steps: launch the app → "Today" tab shows today's liturgical info; "Month" tab shows the monthly calendar (tap a day for details); the magnifier opens search; Settings switches English/Korean and manages notifications. (Parish events are maintained internally by authorized Metropolis staff through a private admin interface that is not part of the user experience and is not needed to review the app.)

5) EXTERNAL SERVICES used to deliver core functionality:
- GitHub (public repository) — hosts the public Orthodox liturgical calendar reference data the app downloads.
- Cloudflare Workers — our own backend, serving parish events and registering devices for notifications.
- Apple Push Notification service (APNs) — iOS notifications.
- Firebase Cloud Messaging — Android notifications (not used on iOS).
No analytics, advertising, payment, or AI services are used.

6) REGIONAL DIFFERENCES: The app functions consistently across all regions; the liturgical content is the same worldwide. The only variation is language (English/Korean), which follows the device language and is switchable in Settings. No features are region-gated.

7) REGULATED INDUSTRY / PROTECTED MATERIAL: The app presents publicly available Orthodox liturgical calendar data. It is developed by CyberSystema and published on behalf of, and with the authorization of, the Orthodox Metropolis of Korea and Exarchate of Japan. We can provide a letter of authorization from the Metropolis if required.

Permissions: the only permission requested is Notifications (for liturgical reminders and parish announcements), via the standard iOS prompt. The app does not request location, contacts, camera, microphone, photos, or tracking, and does not track users.
```

---

## Screen recording to capture (Apple requires it)

Record on a **physical iPhone** (latest iOS) — Settings → Control Center → Screen Recording, or QuickTime when plugged into a Mac. ~30–60 s, showing the **typical user flow**:

1. **Launch the app** (let the splash finish and the calendar load).
2. **Today** tab — show the day's feasts/fasts/saints/readings; scroll a bit.
3. **Month** tab — tap a day → its details; open an **event**.
4. **Search** (magnifier) — type a query, open a result.
5. **Settings** — switch **English ↔ Korean**; show the notifications row.

Attach the video to the Resolution Center reply. (No login/purchase/UGC/permission segments — the app has none.)

---

## Screenshots — Guideline 2.3.3 (Apple flagged this as a reminder)

App Store screenshots **must show the actual app in use** (Today/Month with real content) — **not the splash screen, title art, or a login page**. If the current `Production/Graphics` shots are splash/branding, replace them with in‑app screens. Metadata change, no new build.

---

## Pre‑resubmit checklist

- [ ] Fill the two OS versions in the reply.
- [ ] Capture + attach the screen recording.
- [ ] Confirm screenshots show the app in use (not splash/title).
- [ ] Privacy Policy URL + Support URL are **live and reachable** (Apple opens them).
- [ ] Paste the reply into the Resolution Center **and** into App Review Information → Notes.
- [ ] (Optional) Have the Metropolis authorization letter ready in case Apple asks (item 7).

> Note: the same set of answers (purpose, no accounts, external services, no tracking) should stay consistent with the **Apple App Privacy** and **Google Data Safety** forms and the hosted **Privacy Policy** (`docs/privacy-policy.md`).
