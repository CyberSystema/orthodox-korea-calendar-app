# Privacy Policy — OK Calendar

_Last updated: 29 June 2026_

The **OK Calendar** (the "Service") is offered to the faithful of the **Orthodox Metropolis of Korea and Exarchate of Japan**. It is developed and actively maintained by **CyberSystema** on behalf of the Metropolis.

We respect your privacy. The Service is designed to collect as little information as possible.

## 1. Who we are

**Data controller:** Orthodox Metropolis of Korea and Exarchate of Japan
**Technical operator:** CyberSystema
**Contact:** see the [Support](#7-contact-and-support) section below.

## 2. What we do not collect

The Service does **not**:

- Ask you to create an account, sign up, or sign in — other than staff/administrators who sign in to manage parish events.
- Collect your name, email address, phone number, or postal address.
- Track your location.
- Read your contacts, photos, microphone, or camera.
- Sell, rent, or share any data with advertisers, data brokers, or marketing networks.
- Use third-party advertising or analytics SDKs.
- Profile you for advertising purposes.

## 3. What we do collect

We collect only the minimum needed to operate the calendar.

### 3.1 Calendar data

The liturgical calendar — feasts, fasts, commemorations, and Scripture readings — is **public reference data** hosted in a public repository on **GitHub** (operated by GitHub, Inc.). **Parish events** are delivered from our own backend (hosted on **Cloudflare**). Both are downloaded to your device so you can view the calendar. This data is **public and the same for everyone** — fetching it does not identify you, although the providers that host it receive your device's network request (see [§3.3](#33-technical-request-data)).

### 3.2 Push-notification token (optional)

If you choose to enable notifications, your device generates a **unique push token** — a device identifier issued by the Apple Push Notification service (APNs) or Firebase Cloud Messaging (FCM) — and sends it to our backend, together with:

- the **platform** (iOS, Android, or web),
- the **environment** (production or sandbox).

The token is **not linked to your name or identity**. It is used **only** to deliver liturgical reminders and parish announcements. We never use it for advertising. You can stop notifications at any time by disabling them in the app or in your device settings; the token is then removed from our backend.

### 3.3 Technical request data

To download the calendar and deliver notifications, your device contacts our service providers — **GitHub** (public calendar data), **Cloudflare** (our backend for parish events and notification registration), and **Apple / Google** (push delivery). These providers automatically process standard request information — your **IP address**, the time of the request, and a basic **user-agent** string — in order to:

- deliver the response,
- protect the Service against abuse and denial-of-service attacks (rate limiting),
- diagnose technical errors.

This information is **not used to identify you** and is **not combined** by us with any other data. Logs held by our backend are automatically purged after a short retention period.

### 3.4 Local data on your device

The app stores the following **on your device only**:

- your selected language, your notification preferences, and — if you are a staff administrator who manages parish events — an **administrator session token**, all kept in your device's **secure storage** (iOS Keychain / Android Keystore) where the platform supports it;
- a **cached copy of the public calendar**, kept in the app's private storage area so you can view it offline.

This information never leaves your device unless you explicitly act on it — for example, by enabling notifications, or by tapping **"add to calendar,"** which opens the calendar app or service you choose (such as Google or Outlook).

### 3.5 Service providers

We rely on the following providers purely as technical infrastructure to operate the Service. They act as processors on our behalf or as transport for your requests; we do **not** sell or share data with advertisers or data brokers.

- **Apple** — Apple Push Notification service (notification delivery on iOS).
- **Google / Firebase Cloud Messaging** — notification delivery on Android.
- **Cloudflare** — hosting for our backend (parish events, notification registration).
- **GitHub** — hosting for the public liturgical-calendar data.

## 4. Children's privacy

The Service is suitable for all ages and does not knowingly collect personal information from children. Notifications and calendar data contain no advertising or commercial content.

## 5. How long we keep data

- **Push tokens:** kept while your subscription is active. Removed when you disable notifications or uninstall the app, and pruned automatically when Apple or Google reports the token as invalid.
- **Server logs and rate-limit records:** automatically purged after a short retention window (typically no longer than 180 days).
- **Local data:** stays on your device until you uninstall the app or clear its data.

## 6. Your rights

Because the Service does not maintain personal accounts, we cannot link a specific token to a specific person. You can nevertheless exercise the following rights at any time:

- **Stop notifications:** disable notifications in the app or in your device settings.
- **Delete local data:** uninstall the app, or clear its storage in your device settings.
- **Request information or deletion:** contact us using the channels below.

If you reside in a jurisdiction that grants additional rights (for example, the EU/EEA, the UK, or the Republic of Korea), those rights — including the right to access, correct, or erase your personal data, and the right to lodge a complaint with a supervisory authority — apply.

## 7. Contact and support

If you have questions about this policy, or you wish to exercise any of the rights above, please reach out through the channels listed in the **Support** note that accompanies the Service. Requests received through those channels are forwarded to CyberSystema, the technical operator, on behalf of the Metropolis.

## 8. Changes to this policy

We may update this policy from time to time, for example to reflect changes in technology or in legal requirements. The "Last updated" date at the top of this document will always reflect the most recent revision. Material changes will be announced inside the app and on the website.
