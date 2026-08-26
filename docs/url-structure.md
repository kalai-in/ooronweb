# URL structure — which page gets a zone, which gets a language, and why

The practical reference: what every route does today. Companion to `zone-seo.md`
(zone architecture) and `language-seo.md` (language architecture).

**All numbers below are measured**, not intended — production build, curl,
2026-07-17.

---

## 1. The shape

```
/{lang?}/{zone?}/{route}
   │        │       └── the page: /, /products, /product/x, /cart …
   │        └────────── location: bhuj-quick, ahmedabad …   (SOME routes only)
   └─────────────────── language: ur, fr …                  (ANY route)
```

Two independent axes with **different rules**:

| | Language | Zone |
|---|---|---|
| Applies to | **every** route | **only** home / products / product |
| Default | `en` — never in the URL | none — no zone is valid |
| Source | languages API (runtime) | zones API (runtime) |
| Wrong value | 404 | 404 |

---

## 2. The page-by-page table (measured)

| URL | HTTP | Server HTML | robots | Zone? | Lang? |
|---|---|---|---|---|---|
| `/` | 200 | shell | index | — | — |
| `/bhuj-quick` | 200 | shell | index | ✅ | — |
| `/ur/bhuj-quick` | 200 | shell | index | ✅ | ✅ |
| `/products` | 200 | shell | index | — | — |
| `/bhuj-quick/products` | 200 | shell | index | ✅ | — |
| `/ur/bhuj-quick/products` | 200 | shell | index | ✅ | ✅ |
| `/product/tomato-100-gm` | 200 | **YES (41 KB)** | index | — | — |
| `/bhuj-quick/product/tomato-100-gm` | 200 | **YES (48 KB)** | index | ✅ | — |
| `/ur/bhuj-quick/product/tomato-100-gm` | 200 | **YES** | index | ✅ | ✅ |
| `/bhuj-quick/product` | 200 | shell | index | ✅ | — |
| `/cart` | 200 | shell | **noindex** | ❌ | — |
| `/ur/cart` | 200 | shell | **noindex** | ❌ | ✅ |
| **`/bhuj-quick/cart`** | **404** | — | — | ❌ | — |
| `/profile` | 200 | shell | **noindex** | ❌ | — |
| `/ur/profile` | 200 | shell | **noindex** | ❌ | ✅ |
| `/categories` | 200 | shell | index | ❌ | — |
| **`/bhuj-quick/categories`** | **404** | — | — | ❌ | — |
| `/blogs`, `/ur/blogs` | 200 | shell | index | ❌ | ✅ |
| `/about-us`, `/ur/about-us` | 200 | shell | index | ❌ | ✅ |
| **`/en/bhuj-quick`** | **404** | — | — | | default lang never prefixed |
| **`/xx/products`** | **404** | — | — | | unknown language |
| **`/mumbai-central`** | **404** | — | — | | zone has no polygon |

### Read this table carefully — two things stand out

**Only the product page actually server-renders content.** Everything else is a
6 KB shell. Home and products have zone URLs, correct canonicals, and sitemap
entries — but Googlebot gets an empty body, so **they cannot rank on content yet**.
That is the largest remaining piece of work (see §7).

**`/bhuj-quick/cart` is a 404 on purpose**, not an oversight. See §4.

---

## 3. Which routes take a ZONE — and why only these

```
✅ /{zone}                     zone home
✅ /{zone}/products            zone listing
✅ /{zone}/product/{slug}      zone product
✅ /{zone}/product             stub -> redirects to the listing

❌ everything else            404 under a zone prefix
```

Defined in two places that must agree:
- `src/middleware.js` — what the server accepts
- `ZONE_PREFIXABLE` in `src/utils/zoneUrl.js` + `src/hooks/useZoneHref.js` —
  what links emit

**Why cart/profile/categories get no zone:** a zone URL is a promise that the page
shows *that location's* content. `/bhuj-quick/cart` would be a lie — the cart is
the user's, identical in every zone. Indexing a per-zone copy of one cart is
duplicate content with no upside.

`/categories` has no zone yet simply because it isn't migrated. It could be later;
it just isn't today.

**Why home IS zoned:** `/{zone}` is the zone's storefront — different catalogue per
location. This is also why `zoneHref("/")` must keep the zone (an earlier bug
dropped it: `canZone` required `rest.length > 0`, but home has empty rest).

---

## 4. Which routes take a LANGUAGE — all of them

```
✅ /ur/cart        /ur/profile      /ur/checkout
✅ /ur/products    /ur/blogs        /ur/about-us
✅ /ur/bhuj-quick/products
❌ /en/anything    default is never a segment -> 404
❌ /xx/anything    unknown code -> 404
```

**Why language applies everywhere — this was a real bug.** The URL is the source
of truth for language, so a page with no language segment reads as "default".
Navigating to a bare `/cart` therefore *reset the UI to English*. Measured before
the fix:

```
/ur/bhuj-ecommerce  ->  redux lang: ur
/cart               ->  redux lang: en   ← language silently lost
```

So every route accepts a language prefix. Private pages are `noindex`
(`robots="noindex, nofollow"` on 15 pages), so `/ur/cart` and `/cart` are both
non-indexable — no duplicate-content risk.

**Why `en` is never prefixed:** `/` and `/en/` would be two URLs for one page and
split its ranking. `/en/bhuj-quick` 404s by design; its canonical is `/bhuj-quick`.

---

## 5. How a request actually flows

```
GET /ur/bhuj-quick/products
  │
  ├─ middleware.js (edge)
  │    codes = await getEdgeLanguages()      ← API, cached per instance
  │    "ur"         is a language  -> lang = ur
  │    "bhuj-quick" is a zone      -> zone = bhuj-quick
  │    ["products"] is migrated    -> allowed
  │    REWRITE -> /products?lang=ur&zone=bhuj-quick   (browser URL unchanged)
  │
  ├─ getServerSideProps (node)
  │    resolveZoneBySlug("bhuj-quick") -> centroid -> lat/lng + channel
  │      └─ unresolvable? -> 404
  │    getLanguagesCached() -> ["en","ur","fr"] for hreflang
  │    fetch with Content-Language: ur
  │
  ├─ HTML
  │    canonical  -> /ur/bhuj-quick/products     (self)
  │    hreflang   -> en / ur / fr / x-default
  │
  └─ client
       seed languageCodes from pageProps  ← before Layout loads the full list
       URL -> Redux: adopt the URL's language (refetch by id for json_data)
```

---

## 6. Client-side rules — what keeps prefixes on

| Hook | Job |
|---|---|
| `useZoneHref` | every `<Link>` gets `/{lang}/{zone}` — lang always, zone only for zone-able routes |
| `useZoneUrlSync` | mode toggle swaps the zone (`/bhuj-quick` → `/bhuj-ecommerce`), keeps lang |
| `useLanguageSwitch` | the switcher navigates to the localized path |
| `useLanguages` | language codes from Redux (+ SSR seed), bound `parseLangPath` |

**All of them read `router.asPath`, never `router.query`.** Middleware injects
`?lang=`/`?zone=`, but the first client-side `router.replace` drops them —
measured:

```
t=400ms   query={"zone":"bhuj-quick"}   asPath=/bhuj-quick
t=2000ms  query={"lang":"en"}           asPath=/bhuj-quick?lang=en   ← zone gone
```

`window.location` is equally unusable: after hydration it reports the *internal
rewritten* path (`/bhuj-quick/products` reads back as `/products`).

---

## 7. Still open

1. **Home + products don't SSR their bodies** (see §2 — 6 KB shells). They have
   zone URLs, canonicals, and sitemap entries, but no content for Google to rank.
   Needs `useInfiniteQuery` + Redux filter state moved server-side. **Biggest
   remaining SEO win.**
2. **`t()` is not reactive** — reads `store.getState()` instead of `useSelector`,
   so switching language doesn't re-render; a refresh shows it. Open.
3. **15 of 21 zones have no polygon** → 404 and excluded from the sitemap.
   Backend is making boundaries compulsory; no frontend change needed.
4. **Breadcrumb hydration (#418)** — pre-existing, builds state in `useEffect`.

---

## 8. Rules to remember when changing this

- **Adding a top-level route?** Add it to `RESERVED_ROUTES`
  (`src/utils/reservedRoutes.js`) or middleware will read it as a zone and 404 it.
- **Zone slugs must never collide with route names.** All 21 current slugs were
  checked — no collisions. Tell backend.
- **Making a route zone-able?** Change BOTH `middleware.js` and `ZONE_PREFIXABLE`.
  They must agree or links will point at 404s.
- **Middleware changes need a dev-server restart** — Next compiles it once at
  startup. A stale `.next` gives `PageNotFoundError: Cannot find module for page:
  /bhuj-ecommerce`.
- **Never hardcode language codes.** They come from the API so admins can add one
  without a redeploy.
- **Use the `code` (`fr`), not the `slug` (`french`).** Google expects ISO codes
  in URLs and hreflang; the slug is an admin display label.
