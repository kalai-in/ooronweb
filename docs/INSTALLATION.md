# Installation Steps

This guide walks through installing and configuring the eCommerce Web storefront
for a production deployment.

## Prerequisites

### Required tools

| Tool | Version | Where to get it |
| --- | --- | --- |
| Node.js | 20 LTS or newer | <https://nodejs.org/en/download/prebuilt-installer> |
| npm | ships with Node.js | — |
| VS Code (or any editor) | latest | <https://code.visualstudio.com/> |
| Firebase account | free tier is enough | <https://console.firebase.google.com/> |
| Google Maps API key | — | <https://console.cloud.google.com/google/maps-apis> |

> The project is built on **Next.js 16** and **React 19**. Node 20 is the minimum
> that supports them; older majors fail during `npm install`.

### Required access

- The storefront source code.
- A running **Admin Panel** URL that is reachable from the internet.
- A **VPS** (or any host that can run a Node process). See
  [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md) — shared hosting cannot run the SEO build.

## Step 1 — Extract and open the project

1. Extract the source ZIP to a folder you can reach easily.
2. Open that folder in VS Code (**File → Open Folder**).

## Step 2 — Verify Node.js

Open a terminal in the project root and check both versions:

```bash
node --version   # must print v20.x or newer
npm --version
```

If Node is missing or too old, install Node 20 LTS from the link above, then
reopen the terminal.

## Step 3 — Configure the environment file

All configuration lives in a `.env` file in the project root. Every variable read
by the browser **must** start with `NEXT_PUBLIC_`.

Create `.env` if it does not exist and fill in the sections below.

### Admin panel connection

```env
NEXT_PUBLIC_API_URL=https://your-admin-panel-domain.com
NEXT_PUBLIC_API_SUBURL=/customer
NEXT_PUBLIC_BASE_URL=https://your-storefront-domain.com
```

- `NEXT_PUBLIC_API_URL` — the Admin Panel origin. **No** trailing slash, and do
  not append the API path here.
- `NEXT_PUBLIC_API_SUBURL` — the API path segment, appended to the URL above.
  The two are concatenated, so the example resolves to
  `https://your-admin-panel-domain.com/customer`.
- `NEXT_PUBLIC_BASE_URL` — your own public storefront URL. Used to build
  canonical tags, `sitemap.xml`, and share links, so it must be the real
  production domain for SEO to be correct.

`NEXT_PUBLIC_API_URL` also drives the allowed image hosts in
`next.config.mjs` — the config derives them from that domain's apex, so product
images served from sibling subdomains load without any extra configuration.
**Never hardcode an image host**; change the API URL and the hosts follow.

### Store identity and metadata

```env
NEXT_PUBLIC_WEB_NAME=Your Store Name
NEXT_PUBLIC_META_TITLE=Your Store — Online Shopping
NEXT_PUBLIC_META_DESCRIPTION=Short description used as the default meta description.
NEXT_PUBLIC_META_KEYWORDS=ecommerce,online shopping,delivery
```

### Country and phone defaults

```env
NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=IN
NEXT_PUBLIC_COUNTRY_DIAL_CODE=91
NEXT_PUBLIC_COUNTRY_DROPDOWN=true
```

`NEXT_PUBLIC_COUNTRY_DROPDOWN` toggles the country selector on the login form.
Set it to `false` for a single-country store.

### Google Maps

```env
NEXT_PUBLIC_MAP_API=your-google-maps-api-key
```

Required for delivery-location selection and address autocomplete. Enable **Maps
JavaScript API**, **Places API**, and **Geocoding API** on the key, and restrict
it to your production domain.

### Real-time and analytics (optional)

```env
NEXT_PUBLIC_WS_URL=wss://your-admin-domain.com/app/your-app-key
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Use `wss://` on any HTTPS domain; `ws://` only works for local, non-HTTPS setups.

### Demo credentials (optional)

```env
NEXT_PUBLIC_DEMO_LOGIN_NO=
NEXT_PUBLIC_DEMO_OTP=
```

Prefills the login form for demo builds. **Leave both empty in production.**

### SEO mode

```env
NEXT_PUBLIC_SEO=true
```

This one variable decides how the whole project builds:

| Value | Build output | Hosting required |
| --- | --- | --- |
| `true` (or unset) | Server build — SSR, live `sitemap.xml`, per-page meta tags | VPS / Node host |
| `false` | Static export to `out/` | Any static host (shared hosting, S3, …) |

Setting it to `false` switches `next.config.mjs` to `output: "export"`, which
turns off server rendering. **Search engines then receive an empty shell for
dynamic pages**, so keep it `true` for any store that needs to rank. The rest of
this guide assumes `true`.

## Step 4 — Configure Firebase (push notifications)

1. Open the [Firebase Console](https://console.firebase.google.com/) and create
   a project (or pick an existing one).
2. Add a **Web app** (`</>` icon) and copy the `firebaseConfig` values.
3. Go to **Project Settings → Cloud Messaging**, ensure the **Cloud Messaging
   API (V1)** is enabled, then under **Web Push certificates** click
   **Generate key pair** to get the VAPID key.

Add all of it to `.env`:

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

### Step 4.1 — Update the service worker

Background notifications are handled by `public/firebase-messaging-sw.js`. A
service worker cannot read `NEXT_PUBLIC_` variables, so the same credentials must
be written into that file literally, inside its
`firebase.initializeApp({ … })` call.

> ⚠️ **The repository ships with a working development Firebase key committed to
> this file.** Replace it with your own before going live, and restrict the key
> by HTTP referrer in the Google Cloud console.

The values there must match `.env` exactly, or foreground and background
notifications register against different Firebase projects.

**See [FIREBASE_SETUP.md](FIREBASE_SETUP.md)** for the full walkthrough —
creating the project, generating the VAPID key, the required backend payload
shape, and how to verify notifications end to end.

## Step 5 — Install dependencies

```bash
npm install
```

Expect a few minutes and an `added NNN packages` summary with no errors.

## Step 6 — Run locally

```bash
npm run dev
```

Open <http://localhost:3000> and confirm:

- the home page renders with products,
- the delivery-location modal can resolve a city,
- login works against your Admin Panel.

## Step 7 — Production build

```bash
npm run build
```

This produces a `.next/` folder. Serve it with:

```bash
npm start
```

The `start` script pins `NODE_ENV=production` and `NODE_PORT=8004` and boots the
custom `server.js`. Continue with [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md) to put it behind
a real domain.

> **Do not use the static export.** `npm run export` (with
> `NEXT_PUBLIC_SEO=false`) still builds, but the export drops `src/middleware.js`
> entirely — so zone URLs (`/bhuj-quick/...`) and language URLs (`/ur/...`) all
> 404, on top of losing per-page meta and `sitemap.xml`. The build succeeds
> silently, which makes the breakage easy to miss. Keep `NEXT_PUBLIC_SEO=true`
> and deploy the Node server.

## Troubleshooting

### `npm install` fails

Delete the lockfile and cache, then retry:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Build fails

- Confirm every variable in `.env` is prefixed `NEXT_PUBLIC_`.
- No spaces around `=`, and no quotes unless the value itself contains spaces.

  ```env
  # correct
  NEXT_PUBLIC_API_URL=https://example.com

  # wrong
  NEXT_PUBLIC_API_URL = "https://example.com"
  ```

- Restart the dev server after any `.env` change — values are inlined at build
  time and are **not** hot-reloaded.

### Images do not load

`next.config.mjs` derives its allowed image hosts from `NEXT_PUBLIC_API_URL`. If
images 404 or throw a Next.js host error, that variable is wrong or the images
sit on a domain outside the API host's apex.

### "Network Error" / failed API calls

- Check `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_SUBURL` resolve to a real
  endpoint. Open the concatenated URL in a browser — it should return JSON.
- Confirm the Admin Panel allows CORS from your storefront domain.
- Verify the SSL certificate if you are on HTTPS.

### Push notifications never arrive

- Firebase web push requires **HTTPS**; it will not work over plain HTTP.
- Confirm `public/firebase-messaging-sw.js` matches `.env`.
- In DevTools → **Application → Service Workers**, check that
  `firebase-messaging-sw.js` is registered and active.
- Grant notification permission in the browser, then send a test message from
  **Firebase Console → Cloud Messaging**.
- Full diagnosis steps: [FIREBASE_SETUP.md](FIREBASE_SETUP.md#troubleshooting).

## Next steps

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) — push notifications in full.
- [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md) — VPS deployment with PM2.
- [FILE_STRUCTURE.md](FILE_STRUCTURE.md) — where everything lives.
- [CONFIGURATION.md](CONFIGURATION.md) — theming, zones, and translations.
