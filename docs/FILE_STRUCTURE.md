# File Structure

How the storefront is organised, and where to look when you need to change
something.

## Technology stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (**Pages Router**, not App Router) |
| UI | React 19 |
| Styling | Tailwind CSS + `src/styles/globals.css` |
| Global state | Redux Toolkit + redux-persist |
| Server state | TanStack Query (React Query) |
| HTTP | Axios (`src/api/axiosMiddleware.js`) |
| Components | shadcn/ui primitives in `src/components/ui` |
| Push | Firebase Cloud Messaging |
| Maps | Google Maps + OpenStreetMap fallback |

> This project uses the **Pages Router** (`src/pages/**`), so routing lives in
> `src/pages`, not `src/app`. There is no `app/` directory.

## Top level

```
eCommerce/
├── public/                   # Served as-is
│   └── firebase-messaging-sw.js   # Background push handler
├── scripts/
│   ├── generator.js          # Pre-build config generation (static export)
│   └── copy-htaccess.js      # Copies .htaccess into the export output
├── src/
│   ├── api/                  # All backend communication
│   ├── assets/               # Imported images, SVGs, Lottie JSON
│   ├── checkauth/            # Route guard for authenticated pages
│   ├── components/           # Everything visual
│   ├── HOC/                  # Higher-order components
│   ├── hooks/                # Reusable logic
│   ├── lib/                  # Chat websocket + small helpers
│   ├── pages/                # Routes (Pages Router)
│   ├── redux/                # Global state
│   ├── styles/               # Global CSS
│   ├── utils/                # Pure helpers + translation JSON
│   └── middleware.js         # Zone/language URL rewriting
├── docs/                     # This documentation
├── .env                      # Configuration (never commit)
├── .htaccess                 # Apache → Node proxy for VPS deploys
├── next.config.mjs           # Image hosts, SEO/export switch
├── server.js                 # Custom Node server used by `npm start`
└── tailwind.config.js
```

## `src/pages` — routes

File-based routing; each file or folder becomes a URL.

```
pages/
├── _app.js                   # Providers: Redux, React Query, PersistGate
├── _document.js              # <html>/<body> shell
├── index.js                  # Home page
├── 404.js                    # Custom not-found page
├── sitemap.xml.js            # Dynamic sitemap (SEO builds)
├── product/                  # Product detail
├── products/                 # Product listing + filters
├── categories/
│   ├── index.jsx
│   └── [slug]/               # Category listing
├── cart/  checkout/  order-detail/
├── profile/                  # Account dashboard
├── blog/  blogs/             # Blog detail + index
├── brands/  sellers/  countries/
├── web-payment-status/       # Payment gateway return URL
└── about-us/ contact-us/ faqs/ privacy-policy/ …   # Static content pages
```

`_app.js` is where the provider stack lives. Note the two deliberate choices
documented in-file: `PersistGate` uses the **function-child** form so pages still
server-render, and there is **no `<Suspense>`** around the app content — a
boundary there would write the fallback into the server HTML and break
hydration.

## `src/api` — backend layer

| File | Role |
| --- | --- |
| `apiEndpoints.js` | Endpoint path constants (`categories`, `products`, …) |
| `apiRoutes.js` | One function per API call; builds params/FormData |
| `axiosMiddleware.js` | Axios instance, base URL, auth + language headers |
| `serverApi.js` | Server-side fetches for `getServerSideProps` (SSR/SEO) |
| `languageResolver.js` | Resolves the active language server-side |
| `zoneResolver.js` | Resolves a zone slug to coordinates server-side |

`serverApi.js` exists because SSR cannot read the Redux store — it takes headers
as arguments instead. It is deliberately anonymous (no auth header): server
rendering produces the logged-out view for crawlers, and user state hydrates on
the client.

## `src/components`

Grouped by feature. The larger ones:

| Folder | Contents |
| --- | --- |
| `layout/` | `Header.jsx`, `Footer.jsx`, `Layout.jsx` — the app shell |
| `homelayout/` | API-driven home page renderer (see below) |
| `productcards/` | `VerticleProductCard`, `ListViewProductCard`, home variants |
| `productslist/` | Listing page: grid, sorting, infinite scroll |
| `productFilter/` | Sidebar filters, price slider, mobile filter drawer |
| `productdetail/` | Product page; `productdetailmodal/` is the quick-view |
| `cart/`, `checkoutpage/`, `orderdetail/` | Purchase flow |
| `categories/` | Category grid, tabs, breadcrumb flow |
| `locationmodal/`, `maps/` | Delivery location selection |
| `profiledashboard/` | Account area (orders, wishlist, wallet, addresses) |
| `login/`, `register/`, `forgetpasswordmodal/` | Authentication |
| `chat/` | Support and delivery chat |
| `skeleton/` | Loading placeholders |
| `ui/` | shadcn/ui primitives — button, dialog, sheet, dropdown |

### `homelayout/` — the API-driven home page

The home page is **not** hardcoded. The `home_layout` API returns an ordered list
of blocks and `HomeLayout.jsx` dispatches each to a section component:

```
homelayout/
├── HomeLayout.jsx            # Block dispatcher
└── sections/
    ├── ProductSliderSection.jsx   # Product carousel / grid / list
    ├── CategorySection.jsx        # Category chips
    ├── BrandSection.jsx           # Brand chips
    ├── BannerSliderSection.jsx    # Banner carousel
    ├── GridBannerSection.jsx      # Banner grid
    ├── TitleImageSection.jsx      # Title + artwork
    └── TextSection.jsx            # Rich text
```

Each section reads its own `config` object (variant, colours, aspect ratio,
column count). See [CONFIGURATION.md](CONFIGURATION.md).

## `src/redux` — global state

```
redux/
├── store.js
└── slices/
    ├── userSlice.js            # Auth, JWT, profile
    ├── cartSlice.js            # Cart, guest cart per channel
    ├── settingSlice.js         # Web settings from the API
    ├── citySlice.js            # Delivery location
    ├── shopModeSlice.js        # quick / allShop channel + layout theme
    ├── productFilterSlice.js   # Listing filters, category flow
    ├── languageSlice.js        # Selected + available languages
    ├── themeSlice.js           # Light/dark
    ├── checkoutSlice.js        addressSlice.js       FavoriteSlice.js
    ├── countrySettingSlice.js  locationModalSlice.js shopSlice.js
```

State is persisted with redux-persist (localStorage). Two consequences worth
knowing:

- Persisted values are **empty on the server** and populated on the client, so
  any markup whose *presence* depends on them must be gated behind
  `useIsHydrated()` or a `mounted` flag — otherwise React discards the tree with
  a hydration mismatch.
- `shopModeSlice.mode` is `"quick"` or `"allShop"`. The API string for the second
  channel is `"ecommerce"` — they are not interchangeable.

## `src/hooks`

| Hook | Purpose |
| --- | --- |
| `useIsHydrated` | Guard for persisted-state-dependent rendering |
| `useZoneHref` | Builds links that preserve the active zone + language |
| `useZoneUrlSync`, `useZoneAdopt` | Keep the URL zone and store in step |
| `useLanguages`, `useLanguageSwitch`, `useT` | Translation and locale switching |
| `useIsRtl`, `useDir` | RTL layout support |
| `useProductFilters` | Category-aware filter options |
| `useDebouncedQuantity` | Cart stepper with debounced server commits |
| `useFavoriteToggle` | Optimistic wishlist toggle |
| `useStoreClosed` | Disables the buy path when the zone is closed |
| `useGeocode`, `useMapProvider` | Address lookup, Google/OSM selection |
| `useSupportChat`, `useDeliveryChat` | Chat sessions |

## `src/utils`

Pure helpers with no React dependency.

| File | Purpose |
| --- | --- |
| `translation.js` | `t()` — reads server translations, falls back to `en.json` |
| `en.json`, `ur.json` | Bundled fallback strings |
| `helperFunction.js` | Currency, aspect ratio, stock, quantity helpers |
| `categoryTree.js` | Resolves a parent category to its leaf ids |
| `canonicalUrl.js`, `selectSeoRow.js` | SEO metadata |
| `zoneUrl.js`, `reservedRoutes.js` | Zone slug parsing and reserved paths |
| `languageRoutes.js`, `languageEdge.js` | Locale path handling |
| `firebase.js` | Client Firebase init + FCM token |
| `mapConfig.js`, `geocode.js`, `osmGeocode.js` | Maps |
| `sanitizeHtml.js` | Cleans API-supplied HTML before render |
| `paymentSettings.js` | Enabled gateways |

> `t()` reads translations from the server response, falling back to `en.json`.
> The local `ur.json` is **not** used at runtime — server data wins.

## `src/middleware.js`

Runs at the edge before a page renders. It rewrites zone- and language-prefixed
URLs (`/bhuj-quick`, `/ur/products`) onto the underlying route, which is why the
zone slug survives only in `router.asPath` and not in the query.

## Configuration files

| File | Notes |
| --- | --- |
| `next.config.mjs` | Derives image hosts from `NEXT_PUBLIC_API_URL`; switches to `output: "export"` when `NEXT_PUBLIC_SEO=false` |
| `server.js` | Custom server; reads `NODE_PORT`, serves `/.well-known` for cert renewal |
| `.htaccess` | Apache → Node proxy (see [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md)) |
| `tailwind.config.js` | Theme, container widths, custom animations |
| `jsconfig.json` | The `@/` path alias → `src/` |

## Conventions

- **Components** — PascalCase (`ProductCard.jsx`)
- **Hooks** — `use` prefix, camelCase (`useZoneHref.js`)
- **Redux slices** — camelCase + `Slice` suffix (`cartSlice.js`)
- **Utils** — camelCase (`helperFunction.js`)
- **Imports** — use the `@/` alias (`@/components/...`), not deep relative paths
- **Theming** — colours come from CSS variables (`--primary-color`) set from the
  API. This is a white-label template: never hardcode a brand colour or an image
  host.
