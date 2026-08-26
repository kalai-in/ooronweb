# Firebase Setup

The storefront uses **Firebase Cloud Messaging (FCM)** to deliver push
notifications — order updates, offers, and delivery status — to customers'
browsers.

This guide covers creating the Firebase project, wiring the credentials into the
app, and verifying that notifications actually arrive.

## Before you start

- Push notifications require **HTTPS**. They will not work over plain HTTP, and
  on `localhost` support varies by browser. Plan to test on a real HTTPS domain.
- FCM web push is unsupported in some browsers (notably iOS Safari below 16.4).
  The app detects this and shows a "install the app instead" note rather than
  failing — see [Unsupported browsers](#unsupported-browsers).

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it (e.g. "MyStore Web"), and follow the wizard.
3. Google Analytics is optional — it is not required for push notifications.

## 2. Register a Web app

1. In the project dashboard, click the **Web** icon (`</>`).
2. Give it a nickname (e.g. "Storefront").
3. Click **Register app**.
4. Firebase shows a `firebaseConfig` object. **Keep this open** — you need all
   seven values twice, in two different files.

```js
// what Firebase shows you
const firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…",
  measurementId: "…",
};
```

## 3. Enable Cloud Messaging and get the VAPID key

1. Go to **Project Settings** (gear icon) → **Cloud Messaging**.
2. Confirm **Firebase Cloud Messaging API (V1)** is **Enabled**. If it shows as
   disabled, use the three-dot menu to enable it in Google Cloud Console.
3. Scroll to **Web configuration → Web Push certificates**.
4. Click **Generate key pair**. The resulting string is your **VAPID key** —
   copy it.

Without the VAPID key the browser cannot mint an FCM token, and no device is
ever registered.

## 4. Add credentials to `.env`

The app reads its Firebase config from environment variables in
`src/utils/firebase.js`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

> `.env` values are inlined at **build time**. After changing them you must
> rebuild (`npm run build`) and restart — a reload is not enough.

## 5. Update the service worker

Background notifications — the ones that arrive when the tab is not focused —
are handled by `public/firebase-messaging-sw.js`.

A service worker runs outside the bundle and **cannot read `NEXT_PUBLIC_`
variables**, so the same credentials have to be written into the file literally.

Open `public/firebase-messaging-sw.js` and replace the config in
`firebase.initializeApp({ … })` with your own:

```js
firebase.initializeApp({
  apiKey: "your-firebase-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id",
});
```

Three things to get right:

- Values **must match `.env` exactly**. If they differ, foreground and background
  notifications register against different Firebase projects and one of them
  silently stops working.
- Use plain values — no `NEXT_PUBLIC_` prefix, no `process.env`.
- Keep the `firebase.initializeApp(...)` **call**. Replacing it with a bare
  config object throws during script evaluation, which fails the entire service
  worker registration.

> ⚠️ **The repository ships with a working development Firebase key committed to
> this file.** Replace it with your own before going live. Web Firebase keys are
> public by design (any visitor can read them), so the protection is a
> restriction, not secrecy: in Google Cloud Console → **APIs & Services →
> Credentials**, restrict the key by **HTTP referrer** to your production domain.

## 6. Backend: send data-only messages

The service worker reads the payload from `payload.data`, not
`payload.notification`:

```js
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

So the Admin Panel must send **data messages** with `title`, `body`, and `icon`
keys inside `data`:

```json
{
  "to": "<device-fcm-token>",
  "data": {
    "title": "Order shipped",
    "body": "Your order #1234 is on its way",
    "icon": "https://your-domain.com/icon.png"
  }
}
```

If the backend sends a `notification` block instead, the browser may still
display it, but `payload.data.title` is `undefined` and the handler above shows
an empty notification. Notifications that "arrive blank" are almost always this.

## 7. How it works in the app

| Piece | File | Role |
| --- | --- | --- |
| Config + token | `src/utils/firebase.js` | Initialises Firebase, requests permission, fetches the FCM token |
| Mount point | `src/components/firebasenotification/PushNotification.jsx` | Registers the worker and subscribes to foreground messages |
| Background handler | `public/firebase-messaging-sw.js` | Shows notifications when the tab is not focused |
| Token storage | `src/redux/slices/userSlice.js` | Holds `fcm_token` |

`PushNotification` wraps the app in `src/components/layout/Layout.jsx`, so the
flow runs on every page:

1. `registerServiceWorker()` registers `/firebase-messaging-sw.js`.
2. `fetchToken(dispatch)` asks for notification permission, mints a token with
   the VAPID key, and stores it in Redux as `fcm_token`.
3. `onMessageListener(callback)` subscribes to **foreground** messages.
4. The token is sent to the backend with login and logout requests so the server
   can target — and later unregister — this specific device.

> `onMessageListener` takes a **callback**, not a Promise. A Promise settles
> once, so the earlier Promise-based version only ever delivered the first
> message of a session. It returns an unsubscribe function; call it on unmount.

## 8. Verify

Deploy to an HTTPS domain, then:

**Service worker registered**

1. Open the site and press <kbd>F12</kbd>.
2. Go to **Application → Service Workers** (Chrome) or **Storage** (Firefox).
3. `firebase-messaging-sw.js` should be listed as **activated and running**.

**Token minted**

1. Accept the notification permission prompt when it appears.
2. In the **Console**, confirm there is no "Unable to get permission" or
   "No registration token available" message.

**Test message**

1. Firebase Console → **Cloud Messaging → Send test message**.
2. Paste the device token and send.
3. Tab focused → foreground handler fires. Tab in the background → the service
   worker shows a system notification.

## Unsupported browsers

`getMessagingInstance()` calls Firebase's `isSupported()` first. When the browser
cannot do web push, the app does **not** error — it calls `createStickyNote()`
(`src/utils/stickynote.js`), which shows a dismissible note pointing the user at
the mobile app. The dismissal is remembered for the session via
`sessionStorage`, key `hide-unsupported-browser-note`.

This is expected behaviour on iOS Safari below 16.4 and in private-browsing
modes — not a misconfiguration.

## Troubleshooting

### No permission prompt appears

The browser only prompts once per origin. If it was previously blocked, reset it
in the site settings (padlock icon → Notifications → Allow) and reload.

### "No registration token available"

Almost always a VAPID problem:

- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` missing or truncated.
- The key belongs to a different Firebase project than the rest of the config.
- The app was built before the variable was added — rebuild and restart.

### Service worker fails to register

- Check the Console for a script-evaluation error. The usual cause is the
  `firebase.initializeApp(...)` call being removed or malformed.
- The worker must be served from the **same origin** as the app, at
  `/firebase-messaging-sw.js`. Confirm by opening that URL directly — it should
  return JavaScript, not an HTML 404 page.
- On a VPS deployment, make sure the web server proxies the request to Node
  rather than mapping it to disk. See
  [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md).

### Foreground works, background does not (or vice-versa)

The two paths use different config sources. Foreground reads `.env`; background
reads the literal values in `firebase-messaging-sw.js`. If only one path works,
the two are out of sync — make them identical and rebuild.

### Notifications arrive but are blank

The backend is sending a `notification` payload instead of `data`. See
[Section 6](#6-backend-send-data-only-messages).

### Works locally, not in production

- HTTPS with a valid certificate is mandatory.
- Confirm `.env` on the **server** has the Firebase variables, and that the site
  was rebuilt after they were added.
- Verify the service worker file made it into the deployed `public/` output.

## Related guides

- [Installation Steps](INSTALLATION.md) — full `.env` reference
- [Deployment Guide (VPS)](DEPLOYMENT_VPS.md) — HTTPS and proxy setup
- [File Structure](FILE_STRUCTURE.md) — where the Firebase code lives
