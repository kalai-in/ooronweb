# Zone-based SEO — Architecture & Status

Last verified: 2026-07-16, against a production build (`npx next build && npx next start`).

---

## 1. Why (the problem)

Goal: Zomato-style location URLs so Google indexes a page per zone — now also
per language.

```
"snapbuy bhuj"        ->  /bhuj-quick/product/tomato-100-gm
Urdu variant          ->  /ur/bhuj-quick/product/tomato-100-gm
```

URL shape: `/{lang?}/{zone?}/{route}`. The default language (en) is never a
segment; every other language is. See §12 for the language layer.

Two blockers stood in the way, both now resolved:

| # | Blocker | Fix |
|---|---|---|
| 1 | `PersistGate loading={null}` returned `null` on the server, so **no page body ever server-rendered** | `_app.js` switched to the function-child form |
| 2 | Product fetch gated on `city.latitude` from **localStorage** — unreadable by the server | Zone slug in the URL → centroid → coordinates |

Blocker 2 is the key insight: **the URL now carries the location that localStorage used to.**
That is what makes SSR possible at all — and it also fixed a real user bug (a first-time
visitor with no persisted city previously never fetched the product).

---

## 2. Folder structure — what was added

```
src/
├── middleware.js                    [NEW]  zone URL -> internal route rewrite
│
├── api/
│   ├── serverApi.js                 [NEW]  server-only fetches (no Redux singleton)
│   ├── zoneResolver.js              [NEW]  zone slug -> lat/lng, cached
│   ├── apiRoutes.js                 [MOD]  + getCountriesWithDefault()
│   └── apiEndpoints.js                     (unchanged)
│
├── utils/
│   ├── reservedRoutes.js            [NEW]  route-name denylist + slug shape check
│   └── zoneUrl.js                   [NEW]  parseZonePath / buildZoneUrl / buildZonePath
│
├── hooks/
│   ├── useDefaultCountry.js         [NEW]  startup: is_default country -> Redux
│   ├── useZoneHref.js               [NEW]  <Link> href -> zone-prefixed href
│   ├── useZoneUrlSync.js            [NEW]  mode toggle -> swap zone segment
│   └── useHydratedMediaQuery.js     [NEW]  SSR-safe useMediaQuery (no #418)
│
├── pages/
│   ├── _app.js                      [MOD]  PersistGate function-child (THE unblocker)
│   ├── index.js                     [MOD]  zone validate + canonical
│   ├── sitemap.xml.js               [NEW]  dynamic zone-aware sitemap
│   ├── products/index.jsx           [MOD]  zone validate + canonical
│   └── product/[slug]/index.jsx     [MOD]  zone resolve + SSR product fetch
│
├── redux/
│   ├── rootReducer.js               [MOD]  persist selectedZone
│   └── slices/locationModalSlice.js [MOD]  + selectedZone, setDefaultCountry
│
└── components/
    ├── locationmodal/Location.jsx   [MOD]  keep API slug, store zone, swap URL
    ├── productcards/*.jsx           [MOD]  5 cards -> useZoneHref
    ├── cards/SearchProductCard.jsx  [MOD]  -> useZoneHref
    └── homelayout/sections/*.jsx    [MOD]  3 banners -> useZoneHref
```

**No `pages/[zone]/` directory exists — deliberately.** `/[zone]` would match `/cart`,
`/products`, everything. Middleware rewrites instead, so there is exactly ONE product page,
ONE home page, ONE listing page. No duplicated page logic.

---

## 3. How a zone URL works — request flow

```
Browser: GET /bhuj-quick/product/tomato-100-gm
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ middleware.js            NO network calls. Rewrite only.│
│                                                          │
│  segments = ["bhuj-quick", "product", "tomato-100-gm"]  │
│  isZoneCandidate("bhuj-quick")?                          │
│     └─ in RESERVED_ROUTES? ──── yes ──> next() (a route) │
│     └─ matches /^[a-z0-9-]+$/? ─ no ──> next()           │
│     └─ otherwise ─────────────────────> zone candidate   │
│                                                          │
│  REWRITE (never redirect):                               │
│    /bhuj-quick/product/tomato-100-gm                     │
│           ↓ internally                                   │
│    /product/tomato-100-gm?zone=bhuj-quick                │
│                                                          │
│  Browser URL stays /bhuj-quick/product/tomato-100-gm     │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ pages/product/[slug]/index.jsx — getServerSideProps      │
│                                                          │
│  zoneSlug = context.query.zone     // "bhuj-quick"       │
│         │                                                │
│         ▼                                                │
│  resolveZoneBySlug("bhuj-quick")   // zoneResolver.js    │
│         │                                                │
│         ├─ getZonesCached()        // 10-min in-process  │
│         ├─ zones.find(z => z.slug === "bhuj-quick")      │
│         ├─ getPolygonCenter(z.polygon_boundary)          │
│         │      = { lat: 23.24715, lng: 69.67847 }        │
│         │                                                │
│         └─ null? ──> return { notFound: true }  // 404   │
│         │                                                │
│         ▼                                                │
│  getProductByIdServer({ slug, lat, lng, channel })       │
│         │            // serverApi.js — no Redux, no auth │
│         ▼                                                │
│  props: { initialProduct, zone: "bhuj-quick", ...meta }  │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Server HTML  (47 KB — real content)                      │
│   <title>…</title>                                       │
│   <link rel="canonical"                                  │
│         href="…/bhuj-quick/product/tomato-100-gm">       │
│   <h1>Tomato 100 gm</h1>      ← IN THE HTML              │
│   price 120                    ← IN THE HTML             │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Client hydration                                         │
│   ProductDetail gets initialProduct as a prop            │
│   react-query seeds via initialData                      │
│   → product_by_id fires 0× on the client (verified)      │
│   initialDataUpdatedAt: 0 marks it stale, so once the    │
│   real city rehydrates it refetches for THAT location    │
└─────────────────────────────────────────────────────────┘

```

---

## 4. Zone slug — where it comes from, where it goes

**Rule: the slug is always the backend's. Never constructed, never parsed.**
`"Bhuj (Quick)"` → `bhuj-quick`. The name and slug do not correspond, so deriving one
from the other breaks. Admin may rename freely.

```
GET /customer/zones?country_id=1
   └─> { id: 20, name: "Bhuj (Quick)", slug: "bhuj-quick", polygon_boundary: [...] }
                                        │
        ┌───────────────────────────────┴──────────────────────────┐
        ▼                                                          ▼
  Location.jsx zone chips                              zoneResolver (server)
   └─ dispatch(setSelectedZone(zone))                   └─ slug -> centroid -> lat/lng
        │  (whole object, persisted)
        ▼
  Redux: LocationModal.selectedZone
        │
        ├──> useZoneHref()  ── every <Link> -> /bhuj-quick/product/x
        └──> Location.jsx confirm ── router.push(/bhuj-quick/...)
```

### Where `useZoneHref` reads the zone from — and why NOT window.location

```
1. router.query.zone   ← middleware injected it; survives the rewrite
2. Redux selectedZone  ← fallback for non-zone pages (/products, /cart)
```

**window.location does NOT work.** After `next/router` hydrates, the visible path is
replaced by the internal rewritten one — `/bhuj-quick/products` reads back as `/products`.
Verified in a browser. `router.query.zone` survives because middleware sets it explicitly.

---

## 5. Which pages have zone URLs, which have SSR — MEASURED

| Route | Zone URL | HTTP | Server HTML | Canonical |
|---|---|---|---|---|
| `/bhuj-quick/product/{slug}` | yes | 200 | **47 KB — product name + price** | self |
| `/product/{slug}` (legacy) | — | 200 | **41 KB — product name + price** | self |
| `/bhuj-quick` (home) | yes | 200 | 6.5 KB — **shell only** | self |
| `/bhuj-quick/products` | yes | 200 | 6.5 KB — **shell only** | self |
| `/products` (legacy) | — | 200 | 6.4 KB — shell only | self |
| `/` (legacy home) | — | 200 | 6.4 KB — shell only | self |
| `/mumbai-central/*` (no polygon) | — | **404** | — | — |
| `/not-a-zone/*` | — | **404** | — | — |
| `/cart`, `/categories`, … | never | 200 | unchanged | unchanged |

### The honest headline

**Only the product page actually server-renders content.**

Home and products listing have zone URLs and correct canonicals, but their bodies are still
`dynamic(..., { ssr: false })` — Googlebot gets a 6 KB shell. **They will not rank on
content yet.** Routing is done; SSR is not.

The listing is harder than the PDP: `ProductsList.jsx` uses `useInfiniteQuery` keyed on
Redux `ProductFilter` state, `shopMode`, `listing_source` and `category_slug` — none of
which the server has. Seeding it means dehydrating an infinite query AND reproducing filter
state server-side.

---

## 6. Canonical strategy

**Every URL is canonical to itself.**

```
/bhuj-quick/product/tomato  ->  canonical: /bhuj-quick/product/tomato
/surat-zone/product/tomato  ->  canonical: /surat-zone/product/tomato
/product/tomato  (legacy)   ->  canonical: /product/tomato
```

Why not point zone pages at the legacy URL? That tells Google the zone pages aren't worth
indexing — which defeats the entire project. Why not point legacy at a zone? That picks a
city arbitrarily for a visitor who never chose one.

### ✅ The risk this rested on — NOW VERIFIED, and it clears

Self-canonicals are only safe **if zone pages carry genuinely different content**. Identical
content across zone URLs would read as **doorway pages** and be penalised.

Measured against the live API — `capsicum-red-yellow`, same slug, every zone:

```
  zone             channel    price   special  stock
  bhuj-quick       quick      180     None     142
  bhuj-ecommerce   ecommerce  NOT LISTED
  ahmedabad        quick      NOT LISTED
  surat-zone       ecommerce  NOT LISTED
  jaipur-city      ecommerce  NOT LISTED
```

**Listing is per-store, set by admin.** The product admin has a "Store-wise inventory"
section listing every store (11 sales channels), each with its own Listed toggle, purchase
price, selling price, discounted price, stock, and quantity slab pricing. For this product
only "Bhuj Both type" and "Bhuj quick store" are toggled on.

So zone pages differ **structurally**, not incidentally:
- a product listed in one zone 404s / is absent in another
- price, discount, and stock are per-store fields

Doorway-page risk: **cleared**. Self-canonical per zone is the correct strategy.

Caveat worth keeping in mind: admin *may* enter the same price in every store (nothing
forces variation). Same price alone isn't duplicate content — the catalogue membership still
differs — but if a future product were listed in all zones at one price, those pages would
be near-identical. Not the case for any current product.

---

## 7. Zone switching (user picks a different zone)

```
User on /bhuj-quick/product/kiwi, opens modal, picks "Surat Zone", confirms
   │
   ▼
Location.jsx handleConfirmLocation
   │
   ├─ dispatch(setCity(...))                  // existing behaviour
   ├─ setShowLocation(false)
   │
   └─ buildZoneUrl(window.location.pathname, "surat-zone")
        │
        ├─ /bhuj-quick/product/kiwi -> /surat-zone/product/kiwi   ✓ navigate
        ├─ /bhuj-quick/products     -> /surat-zone/products       ✓ navigate
        ├─ /bhuj-quick              -> /surat-zone               ✓ navigate
        ├─ /cart                    -> null                       ✓ STAY PUT
        └─ /categories/all          -> null                       ✓ STAY PUT
             (route not zone-prefixable — navigating would 404)
```

`?zone=` and `slug` are stripped from the query before pushing, or the internal param
would resurface in the public URL.

---

## 8. Known issues / open work

### 8.1 Mode toggle changes the zone — ✅ DONE (backend shipped `zone_slug`)

Backend added `zone_slug` to `home_layout`. Verified live:

```
GET /home_layout?lat=23.24715&lng=69.67847        (Bhuj — two zones)
   channel: quick      ->  zone_id 20, zone_slug "bhuj-quick",     available_modes "both"
   channel: ecommerce  ->  zone_id 19, zone_slug "bhuj-ecommerce", available_modes "both"

GET /home_layout?lat=23.05073&lng=72.55514        (Ahmedabad — one zone)
   channel: quick      ->  zone_id 8, zone_slug "ahmedabad", available_modes "quick"
   channel: ecommerce  ->  zone_id 8, zone_slug "ahmedabad"   (same — no swap)
```

Flow:

```
User presses "Shop all" on /bhuj-quick
   │
   ▼
setShopMode({ mode: "allShop" })
   │
   ▼
Layout.jsx home-layout query refetches      (shopMode is in its queryKey — already was)
   │
   ▼
response.zone_slug = "bhuj-ecommerce"
   │
   ▼
dispatch(setChannel({ ..., zone_slug }))  ->  Redux ShopMode.zoneSlug
   │
   ▼
useZoneUrlSync  (called in Layout, runs on every page)
   ├─ URL has no zone segment?      -> do nothing (user isn't on a zone URL)
   ├─ zoneSlug === URL's zone?      -> do nothing (Ahmedabad: same slug both modes)
   └─ differs                       -> router.replace(/bhuj-ecommerce)
```

Verified in a browser:

| City | Toggle visible | Before | After | Changed |
|---|---|---|---|---|
| Bhuj (`both`) | yes | `/bhuj-quick?lang=en` | `/bhuj-ecommerce?lang=en` | **YES** |
| Ahmedabad (`quick`) | no | `/ahmedabad?lang=en` | `/ahmedabad?lang=en` | no |

Single-zone cities need no special case — `zone_slug` is identical for both channels, so
the guard short-circuits.

Slug parsing (`-quick` / `-ecommerce`) was rejected: admin can name slugs anything, and
`ahmedabad` (quick) / `surat-zone` (ecommerce) carry no suffix at all.

**Files:** `hooks/useZoneUrlSync.js` [NEW], `redux/slices/shopModeSlice.js` (+`zoneSlug`),
`components/layout/Layout.jsx` (pass `zone_slug`, call the hook), `pages/_app.js` (see below).

#### ⚠ Gotcha found while building this: `router.query.zone` is NOT durable

Middleware injects `?zone=` on the rewrite, but the **first client-side `router.replace`
drops it** — `_app.js`'s `?lang=` sync fires within ~3 s of load and rebuilds the query.
Measured:

```
t=500ms   query={"zone":"bhuj-quick"}   asPath=/bhuj-quick
t=3000ms  query={"lang":"en"}           asPath=/bhuj-quick?lang=en    <- zone gone
```

So **both hooks parse the zone out of `router.asPath`**, which keeps the zone segment for
the page's whole life. Do not "simplify" them back to `router.query.zone`.

`window.location` is equally unusable: after hydration the visible path reads back as the
internal rewritten one (`/bhuj-quick/products` → `/products`).

`_app.js` also needed fixing: it spread `...router.query` into `router.replace` with
`pathname: router.pathname`, which flattened `/bhuj-quick` to `/?zone=bhuj-quick` — leaking
the internal param into the public URL. It now strips `zone` and rewrites off `asPath`.

### 8.2 Channel fallback loop — ✅ DONE (backend shipped `channel` on `getZones()`)

`serverApi` used to try `ecommerce`, then `quick` — two API calls on a miss. Backend added
`channel` to the zones list, so the zone slug in the URL now determines the catalogue
directly. **One call, no guessing.**

```
GET /customer/zones?country_id=1
  keys: id, name, slug, channel, polygon_boundary

  ahmedabad       channel='quick'
  bhuj-quick      channel='quick'
  bhuj-ecommerce  channel='ecommerce'
  jaipur-city     channel='ecommerce'
  new-york        channel='quick'
  surat-zone      channel='ecommerce'
```

`resolveZoneBySlug()` returns it; `pages/product/[slug]` passes it straight to
`getProductByIdServer`. Verified — every zone serves its product in one call:

```
/bhuj-quick/product/tomato-100-gm                 200  47.9 KB
/bhuj-ecommerce/product/human-edge-in-the-ai-age  200  47.8 KB
/surat-zone/product/gits-...-rasgulla             200  47.9 KB
/ahmedabad/product/green-kiwi-2-kg                200  56.3 KB
```

**Do NOT derive the channel any other way.** Two approaches were tried and rejected:

- **Slug suffix** (`-quick` / `-ecommerce`): `ahmedabad` is quick and `surat-zone` is
  ecommerce — neither carries a suffix. Admin can name slugs anything.
- **`getZone(lat/lng).sales_channel`**: does not round-trip. Zone polygons overlap, and
  `bhuj-ecommerce`'s spans most of Gujarat, swallowing `bhuj-quick`'s centroid:

```
requested slug   getZone(centroid) returns   match?
bhuj-quick   ->  bhuj-ecommerce              *** NO ***
```
  It would have silently served the wrong channel with a 200.

### 8.3 Hydration mismatch — ✅ FIXED

React error #418 fired on every product page. **Two** independent causes, both fixed:

**1. `useMediaQuery` breakpoint branches.** react-responsive has no `matchMedia` on the
server so it returns `false`; a desktop client returns `true` immediately → the trees
disagree.

```
ProductImageGallery.jsx:219   canHoverZoom ? <ProductZoomImage/> : <ImageWithPlaceholder/>
ProductImageGallery.jsx:34    isLgUp -> VerticalThumbs vs HorizontalThumbs
ProductDetail.jsx:70,73       isMobileScreen, canHoverZoom
```

Fix: `hooks/useHydratedMediaQuery.js` [NEW] — returns `false` until mounted, so the server
and the first client render agree, then settles on the second render. Callers must treat
`false` as "narrow / no hover", which is the safe default at every call site.

**2. `ShareDrawer` portal.** `createPortal(..., document.body)` renders nothing on the
server and something on the client — mismatch on its own, and it was masked by the first
one until that was fixed.

Fix: `ShareDrawer.jsx` holds the portal back behind a `mounted` flag.

Verified with a real browser (dev build, unminified):

```
desktop (1440px)   hydration errors: 0   h1 renders: Tomato 100 gm
mobile  (390px)    hydration errors: 0   h1 renders: Tomato 100 gm
```

Lesson worth keeping: fixing the first mismatch **revealed** the second — React reports
only the first divergence it hits. After any hydration fix, re-test rather than assume.

### 8.4 Only 6 of 21 zones work

Zones without `polygon_boundary` cannot produce a centroid → 404 by design. Backend is
making boundaries compulsory; that widens coverage with no code change.

```
have boundary: ahmedabad, bhuj-quick, bhuj-ecommerce, jaipur-city, new-york, surat-zone
404 today:     mumbai-central, south-delhi, pune-city, + 12 more
```

### 8.5 Sitemap — ✅ NOW ZONE-AWARE AND DYNAMIC

Was: `public/sitemap.xml`, a **committed static file** written by `scripts/generator.js` —
which only runs under `npm run export`, never `npm run build`. Stale (lastmod 2026-07-13),
31 URLs, zero zone URLs.

Now: `src/pages/sitemap.xml.js` [NEW] — a `getServerSideProps` route, cached 1 h in-process
plus `s-maxage=3600, stale-while-revalidate=86400`.

Emits:
- the 15 static marketing/legal routes (what the old file had, minus funnel/error pages)
- per zone **that resolves**: `/{zone}`, `/{zone}/products`, and `/{zone}/product/{slug}`
  for every product **listed in that zone** — fetched with that zone's own `channel`

Verified:

```
GET /sitemap.xml   ->  200, text/xml, 16.5 KB, 95 <loc> entries

  zone homes:              6   (ahmedabad, bhuj-quick, bhuj-ecommerce,
                                jaipur-city, new-york, surat-zone)
  /bhuj-quick/product/*:  29
  /ahmedabad/product/*:    6
  /surat-zone/product/*:   2
  mumbai-central (no boundary):  0   <- correctly excluded

  all 95 URLs curled:  95 checked, 0 failures
```

The per-zone counts differing (29 / 6 / 2) is the per-store catalogue showing through — the
same evidence as §6.

Notes:
- Zones with no `polygon_boundary` are skipped: their routes 404, and listing a 404 burns
  crawl budget. Coverage grows on its own as backend fills boundaries in.
- `MAX_PRODUCTS_PER_ZONE = 500`; hitting the cap logs a warning rather than silently
  truncating.
- `scripts/generator.js` now only writes `public/sitemap.xml` when
  `NEXT_PUBLIC_SEO === "false"` (the `output: "export"` build, where no server exists to
  run the route). Otherwise Next fails the build: *"Conflicting public and page file"*.
- `robots.txt` still points at `/sitemap.xml` — unchanged, still correct.

### 8.6 RESERVED_ROUTES is a maintenance obligation

Any new top-level route MUST be added to `src/utils/reservedRoutes.js`, or it will be
mistaken for a zone and 404.

**Backend must never name a zone after a route** (`cart`, `blog`, `products`…). All 21
current slugs were checked — no collisions.

---

## 9. Verification commands

```bash
npx next build && npx next start -p 3111

# zone product page — MUST contain the product
curl -s http://localhost:3111/bhuj-quick/product/tomato-100-gm | grep -c "Tomato 100 gm"

# canonical must be self-referential
curl -s http://localhost:3111/bhuj-quick/product/tomato-100-gm \
  | grep -oE 'canonical" href="[^"]*"'

# 404 guards
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/not-a-zone/product/x      # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/mumbai-central/product/x  # 404

# legacy must never break
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/product/tomato-100-gm     # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/cart                      # 200
```

Browser (JS on): open `/bhuj-quick/products`, inspect product links — every href must be
`/bhuj-quick/product/…`. Then check the Network tab: `product_by_id` must fire **0×** on a
zone product page (react-query is seeded).

---
   
## 10. Rollback

| To undo | Do |
|---|---|
| All zone URLs | delete `src/middleware.js` — zone URLs 404, everything else unaffected |
| Zone listing only | `ZONE_PREFIXABLE` back to `["product"]`, drop `isZoneProducts` |
| SSR product | restore `{ ssr: false }` in `pages/product/[slug]/index.jsx` |
| Everything | `git revert` the zone commits; the legacy routes never changed |

Legacy `/product/{slug}`, `/products`, `/` were never modified in behaviour — every zone
feature is additive.

---

## 11. Priority order for what's next

1. **SSR the listing + home bodies** (§5) — the largest remaining SEO win, and now the only
   structural one. Both have zone URLs, correct canonicals, and sitemap entries, but serve
   a 6 KB shell, so they cannot rank on content.
2. **Boundaries for the other 15 zones** (§8.4) — they 404 today and are excluded from the
   sitemap. Backend is making `polygon_boundary` compulsory; no frontend change needed.

Done:
- Per-zone content genuinely differs — doorway-page risk cleared (§6, verified against data)
- `zone_slug` in `home_layout` → mode toggle rewrites the zone segment (§8.1)
- `channel` in `getZones()` → one API call, no fallback loop (§8.2)
- Hydration mismatch → 0 errors, desktop and mobile (§8.3)
- Sitemap → dynamic, zone-aware, 95 URLs, all verified 200 (§8.5)

---

## 12. Language layer — /{lang}/{zone}/{route}

Language now lives in the URL path, so Google indexes each language as its own
localized page. Was `?lang=en` (a query param Google largely ignores for
indexing).

### URL shape and the default-language rule

```
/bhuj-quick/product/x        en (default) — NO prefix
/ur/bhuj-quick/product/x     Urdu
/fr/products                 French listing, no zone
/ur                          Urdu home
```

The default language (`en`) is **never** a segment. Prefixing it would create two
URLs for the same content (`/` and `/en/`) and split ranking. `/en/bhuj-quick`
404s by design — its canonical is `/bhuj-quick`.

Config lives in `utils/languageRoutes.js`: `DEFAULT_LANGUAGE`,
`PREFIXED_LANGUAGES` (`ur`, `fr`). Add a website language there when the
languages API gains one.

### Middleware — language is the OUTER segment

`middleware.js` strips segments in order: language first, then zone, then route.

```
/ur/bhuj-quick/products
   └ lang "ur" stripped ─> /bhuj-quick/products
        └ zone "bhuj-quick" stripped ─> /products
   rewrite ─> /products?lang=ur&zone=bhuj-quick
```

Next.js built-in i18n was rejected: it manipulates the locale segment *before*
middleware and doesn't work under `output: "export"` — it would fight the zone
rewrite. Manual handling keeps one system in control.

### Canonical + hreflang

`utils/canonicalUrl.js` is the single source for URL assembly:
- `buildLocalizedPath({lang, zone, path})` — relative path, used by links
- `canonicalUrl(...)` — absolute, for `<link rel="canonical">`
- `hreflangAlternates({zone, path})` — the `<link rel="alternate">` set

Every SEO page emits a self-canonical plus hreflang for all languages + an
x-default. Verified on `/ur/bhuj-quick/products`:

```
canonical:  /ur/bhuj-quick/products
alternate en          -> /bhuj-quick/products
alternate ur          -> /ur/bhuj-quick/products
alternate fr          -> /fr/bhuj-quick/products
alternate x-default   -> /bhuj-quick/products
```

hreflang ties the language variants together so Google reads them as
translations, not duplicates. `MetaData.jsx` gained an `alternates` prop.

### Content is server-rendered in the requested language

gSSP passes `lang` to the API as `Content-Language`, so the SSR HTML carries the
translated content — not just translated meta. Verified: `/ur/.../tomato-100-gm`
server-renders the product name **"urdu 1"** (the Urdu value), matching a direct
`Content-Language: ur` API call.

### The URL is the source of truth — Redux follows it (the hard part)

A visitor landing on `/ur/...` must SEE Urdu. So:

- **URL → Redux** (`_app.js`, effect A): the URL's language wins; Redux adopts it.
- **Redux → URL** is NOT an effect. It lives in the language switcher
  (`Header.handleLanguageChange` → `useLanguageSwitch`), which navigates to the
  localized path in the same user action.

**Why not a Redux→URL effect** — the trap, found in the browser: on a `/ur/...`
page, `Layout` seeds Redux with the default `en` before effect A adopts the URL's
language. A reactive Redux→URL effect would see that `en` and strip `/ur` before
A could fix it. Measured:

```
t=400ms   url=/ur/bhuj-quick/products
t=2000ms  url=/bhuj-quick/products     <- /ur wrongly stripped (old effect)
```

The first fix attempt (a "skip the first mismatch" ref guard) was fragile timing
code and was discarded. Driving the switch from the user action instead removed
the race entirely. After the fix, the URL stays `/ur/...` and links carry
`/ur/bhuj-quick/product/...`.

### Files

New: `utils/languageRoutes.js`, `utils/canonicalUrl.js`, `hooks/useLanguageSwitch.js`
Modified: `middleware.js` (lang segment), `_app.js` (URL→Redux, removed the
racy query-based sync), `Header.jsx` (switch navigates), `MetaData.jsx`
(`alternates` prop), `useZoneHref.js` + `useZoneUrlSync.js` (preserve lang),
`pages/{index,products,product/[slug]}` (lang prop + canonical/hreflang).

### Not done

- **Sitemap stays default-language only** (decision). Language variants are
  discovered via each page's `<head>` hreflang, which is standard and keeps the
  sitemap small. No `xhtml:link` in the sitemap.
- **RTL for Urdu** (`dir="rtl"`) is set from the language `type` as before — not
  re-verified as part of this work.
