# Language SEO — how it works, end to end

How the multi-language URL layer works: `/{lang}/{zone}/{route}`. Companion to
`zone-seo.md` (§12 there is the summary; this is the full walkthrough).

Verified 2026-07-16 against a production build.

---

## 0. The one-line summary

Language lives in the **URL path** (`/ur/bhuj-quick/products`), not a query param.
Google indexes each language as its own page. The language list is **fetched from
the API at runtime** — nothing is hardcoded, so an admin adding a language works
without a redeploy.

---

## 1. Router: this is the PAGES Router (not App Router)

```
src/
├── pages/            ← Pages Router. Each file = a route.
│   ├── _app.js       ← wraps every page (providers, the URL⇄Redux language sync)
│   ├── index.js      ← /
│   ├── products/index.jsx
│   ├── product/[slug]/index.jsx
│   └── sitemap.xml.js
└── middleware.js     ← runs before every request (the URL rewriter)

There is NO src/app/ directory.
```

**Why this matters for language:** the App Router has built-in i18n
(`generateMetadata`, `context.locale`, locale folders). The Pages Router does
too (`next.config` `i18n`), **but it was NOT used** — it manipulates the locale
segment before middleware and doesn't work under `output: "export"`, so it would
fight the zone rewrite. Instead the language layer is **hand-built** on top of
middleware + `getServerSideProps`, so one system stays in control of the URL.

---

## 2. Folder structure — the language layer

```
src/
├── middleware.js                 [MOD]  strips /{lang} segment (outermost), rewrites
│
├── utils/
│   ├── languageRoutes.js         [NEW]  parseLangPath / isLanguagePrefix (pure,
│   │                                    code-set passed in — no hardcoded langs)
│   ├── languageEdge.js           [NEW]  EDGE lang list for middleware (fetch, no axios)
│   └── canonicalUrl.js           [NEW]  buildLocalizedPath / canonicalUrl / hreflangAlternates
│
├── api/
│   └── languageResolver.js       [NEW]  NODE lang list for gSSP (axios, cached)
│
├── hooks/
│   ├── useLanguages.js           [NEW]  client lang codes from Redux, bound parseLangPath
│   ├── useLanguageSwitch.js      [NEW]  user picks a language -> navigate to localized URL
│   ├── useZoneHref.js            [MOD]  links carry /{lang}/{zone}
│   └── useZoneUrlSync.js         [MOD]  mode toggle keeps /{lang}
│
├── pages/
│   ├── _app.js                   [MOD]  URL→Redux language sync + seed langCodes
│   ├── index.js                  [MOD]  lang prop + canonical + hreflang
│   ├── products/index.jsx        [MOD]  same
│   └── product/[slug]/index.jsx  [MOD]  same + Content-Language on the API fetch
│
├── components/
│   ├── layout/Header.jsx         [MOD]  language switcher calls useLanguageSwitch
│   └── metadata-component/MetaData.jsx  [MOD]  emits <link rel="alternate"> hreflang
│
└── redux/slices/languageSlice.js [MOD]  + languageCodes (SSR-seeded, for first paint)
```

**Two copies of the language list, on purpose:**
- `languageEdge.js` — middleware runs on the **edge runtime**, where `axios` and
  Node APIs don't exist. Uses the global `fetch`, imports nothing from `@/api`.
- `languageResolver.js` — `getServerSideProps` runs in **Node**, uses the shared
  axios setup. Same data, different runtime.

---

## 3. The URL shape and the default-language rule

```
/bhuj-quick/product/x        English (default) — NO /en prefix
/ur/bhuj-quick/product/x     Urdu
/fr/products                 French listing
/ur                          Urdu home
```

**The default language is NEVER a segment.** `/en/bhuj-quick` returns 404 — its
canonical is `/bhuj-quick`. Prefixing the default would make `/` and `/en/` two
URLs for one page and split ranking.

Language codes are ISO `code` values (`en`, `ur`, `fr`) from the API — NOT the
API `slug` (`english`, `urdu`, `french`). Google expects ISO codes in the URL and
in hreflang; the slug is an admin display label only.

---

## 4. Request flow — a localized zone URL

```
Browser: GET /ur/bhuj-quick/products
   │
   ▼
┌───────────────────────────────────────────────────────────────┐
│ middleware.js  (edge)                                          │
│                                                                │
│  const { codes, defaultCode } = await getEdgeLanguages()      │
│         └─ fetch /system_languages, cached per edge instance   │
│                                                                │
│  segments = ["ur", "bhuj-quick", "products"]                  │
│                                                                │
│  1. lang?  "ur" ≠ default AND codes.has("ur")  -> lang = "ur"  │
│            rest = ["bhuj-quick", "products"]                   │
│  2. zone?  isZoneCandidate("bhuj-quick")       -> zone         │
│            routeSegments = ["products"]                         │
│  3. migrated route shape?  products (len 1)     -> yes         │
│                                                                │
│  REWRITE (public URL unchanged):                               │
│    /ur/bhuj-quick/products                                     │
│         ↓ internally                                           │
│    /products?lang=ur&zone=bhuj-quick                          │
└───────────────────────────────────────────────────────────────┘
   │
   ▼
┌───────────────────────────────────────────────────────────────┐
│ pages/products/index.jsx — getServerSideProps  (Node)         │
│                                                                │
│  lang = context.query.lang            // "ur"                  │
│  zone = resolveZoneBySlug(query.zone) // centroid -> coords    │
│  { codes } = getLanguagesCached()     // ["en","ur","fr"]      │
│                                                                │
│  fetch SEO meta with Content-Language: ur                      │
│  props: { lang, zone, langCodes, ...meta }                    │
└───────────────────────────────────────────────────────────────┘
   │
   ▼
┌───────────────────────────────────────────────────────────────┐
│ Server HTML                                                    │
│   <link rel="canonical" href="…/ur/bhuj-quick/products">      │
│   <link rel="alternate" hreflang="en"        href="…/bhuj-quick/products">
│   <link rel="alternate" hreflang="ur"        href="…/ur/bhuj-quick/products">
│   <link rel="alternate" hreflang="fr"        href="…/fr/bhuj-quick/products">
│   <link rel="alternate" hreflang="x-default" href="…/bhuj-quick/products">
│   (content in Urdu — Content-Language flowed through)          │
└───────────────────────────────────────────────────────────────┘
   │
   ▼
┌───────────────────────────────────────────────────────────────┐
│ Client hydration (_app.js)                                    │
│   seed Redux languageCodes from pageProps.langCodes           │
│     └─ so /ur/... parses as language, not zone, on FIRST paint │
│   URL → Redux: the URL's language wins; Redux adopts it        │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Where the language list comes from — NEVER hardcoded

Admins add languages at runtime, so the code set is always fetched:

| Context | Source | File |
|---|---|---|
| Middleware (edge) | `fetch /system_languages`, cached 30 min per instance | `languageEdge.js` |
| gSSP (Node) | `axios /system_languages`, cached 30 min per process | `languageResolver.js` |
| Client | Redux `availableLanguages` + SSR-seeded `languageCodes` | `useLanguages.js` |

`languageRoutes.js` holds **only** `DEFAULT_LANGUAGE = "en"` and pure functions
that take the code set as an argument. No language list lives in code.

```
GET /customer/system_languages?system_type=3
  -> [ { code:"en", is_default:1 }, { code:"ur", is_default:0 }, { code:"fr", is_default:0 } ]
```

Add a website language in admin → it appears in URLs, hreflang, and the switcher
with no redeploy.

---

## 6. Canonical + hreflang — one source of truth

`utils/canonicalUrl.js`:
- `buildLocalizedPath({lang, zone, path})` — relative path, the segment-order
  authority (`/{lang?}/{zone?}/{route}`, default lang omitted). Used by links.
- `canonicalUrl(...)` — absolute, for `<link rel="canonical">`.
- `hreflangAlternates({zone, path, codes})` — the alternate set; `codes` comes
  from the API so it never hardcodes languages.

Every SEO page (home, products, product) emits a self-referential canonical plus
hreflang for every language + `x-default`. hreflang tells Google the localized
URLs are translations of each other, not duplicates.

---

## 7. The hard part — URL vs Redux, and two bugs found while building

### The rule: the URL wins

A visitor landing on `/ur/...` must SEE Urdu. So the URL is the source of truth:

- **URL → Redux** (`_app.js`): the URL's language wins; Redux adopts it.
- **Redux → URL** is NOT a reactive effect. The language switcher
  (`Header.handleLanguageChange` → `useLanguageSwitch`) navigates to the
  localized path in the same user action.

**Why not a Redux→URL effect** — `Layout` briefly seeds Redux with the default
`en` on a `/ur/...` page before URL→Redux runs. A reactive effect would see that
`en` and strip `/ur`. Measured with the old code:

```
t=400ms   /ur/bhuj-quick/products
t=2000ms  /bhuj-quick/products     <- /ur wrongly stripped
```

Driving the switch from the user action removed the race.

### Bug: double zone on first paint

Symptom: `/ur/bhuj-quick/products` briefly became `/bhuj-quick/bhuj-quick/products`.

Cause: on first paint the client hadn't loaded the language list yet, so
`parseLangPath` didn't recognize `ur` as a language → treated it as a zone →
`useZoneUrlSync` prefixed the zone again.

Fix: `getServerSideProps` passes `langCodes` in pageProps; `_app.js` seeds them
into Redux (`languageSlice.languageCodes`) on first paint, so `parseLangPath`
knows the codes immediately — before `Layout` fetches the full list.

### Bug: FCM 401 on language switch (guest)

`update_fcm_token` is auth-gated. The switcher called it unconditionally, so a
logged-out user switching language got a 401 that surfaced as a runtime error.
Fix: `Header.jsx` only calls it when `user?.jwtToken && fcmToken`, inside its own
try/catch so a token failure can't break the switch.

---

## 8. Not done / notes

- **RTL for Urdu** (`dir="rtl"`) is set from the language `type`, as before —
  not re-verified as part of this work.
- **Sitemap** lists default-language URLs only; language variants are discovered
  via each page's `<head>` hreflang (standard, keeps the sitemap small).
- **Edge cold start**: the first request to a fresh edge instance pays one
  language-list fetch (then 30-min cache). Same trade-off as the zone list.

---

## 9. Verify

```bash
npx next build && npx next start -p 3111

# routing (language from the API, not hardcoded)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/ur/bhuj-quick/products   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/fr/products              # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/en/bhuj-quick            # 404 (default not prefixed)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/xx/products              # 404 (unknown lang)

# hreflang (codes come from the API)
curl -s http://localhost:3111/ur/bhuj-quick/products | grep -oE 'hreflang="[^"]*"'
#  en / ur / fr / x-default

# content is server-rendered in the language
curl -s http://localhost:3111/ur/bhuj-quick/product/tomato-100-gm | grep -c "urdu"
```

Browser (JS on): on `/ur/bhuj-quick/products`, product links must all start with
`/ur/bhuj-quick/product/`, and the URL must stay `/ur/...` (not strip to
`/bhuj-quick/...` or double to `/bhuj-quick/bhuj-quick/...`).
