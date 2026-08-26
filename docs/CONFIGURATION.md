# Configuration & Theming

The storefront is a **white-label template**. Nearly everything visual — colours,
header artwork, home page composition, channels, languages — comes from the Admin
Panel at runtime, not from the code. This guide explains what is configurable
and where each setting lands.

The golden rule: **never hardcode a brand colour, image host, or store name.**
The same codebase runs for every client.

## Configuration sources

| Source | Set by | Changes require |
| --- | --- | --- |
| `.env` | Developer, at deploy time | Rebuild + restart |
| `web_settings` API | Admin Panel | Reload |
| `home_layout` API | Admin Panel | Reload |
| Translations API | Admin Panel | Reload |

Only `.env` needs a rebuild — everything else is live.

## Theming

### How colours reach the page

The Admin Panel supplies colours; `Header.jsx` writes them onto
`document.documentElement` as CSS custom properties; components consume them via
utility classes in `src/styles/globals.css`.

Defaults live in `:root` in `globals.css` and are overridden at runtime:

| Variable | Meaning |
| --- | --- |
| `--primary-color` | Brand colour — buttons, links, active states |
| `--light-primary-color` | Tinted surfaces |
| `--font-color` | Default text |
| `--secondary-text-color`, `--sub-text-color` | Muted text |
| `--body-background-color` | Page background |
| `--container-bg`, `--category-card-bg` | Card surfaces |
| `--border-color` | Hairlines |
| `--layout-header-bg` | Header fill |
| `--layout-header-gradient` | Header image or gradient |
| `--layout-header-text` | Header text/icons |

Use the class, not the raw value:

```jsx
<button className="primaryBackColor text-white">Add</button>
<span className="primaryColor">₹499</span>
```

Dark mode re-declares the same variables under `.dark`, so a component styled
with these classes needs no dark-mode branch.

### Header theming

`shopModeSlice.layoutTheme` carries the header appearance from `home_layout`:

```js
{
  background_theme: "image" | "color",
  background_image_url: "https://…",
  background_color: "#8CC63F",
  text_color: "#ffffff",
  header_icon_url: "https://…"
}
```

- **`background_theme: "color"`** — the single colour is expanded into a vertical
  gradient (dark → base → light) via `color-mix`, so any brand colour stays
  on-brand.
- **`background_theme: "image"`** — the header and the category strip below it
  are separate DOM subtrees, so each paints a *slice* of the same image: both
  are sized to the combined height, the header shows the top slice and the strip
  the bottom one. This is what makes the artwork read as one continuous image.

### SVG and Lottie recolouring

Baked-in brand colours are swapped at runtime:

- `ThemedSvg` (`src/components/notfound/ThemedSvg.jsx`) fetches an SVG, replaces
  known accent hexes with `var(--primary-color)`, and inlines it. Use it for
  empty-state and 404 artwork instead of `next/image`.
- `src/utils/lottieColor.js` walks Lottie JSON and rewrites fill colours.

## Home page composition

The home page is assembled from `home_layout`. Each block has a `type`, a
`layout`, and a `config`, and `HomeLayout.jsx` routes it to a section component.

### Block types

| `type` | Component | Renders |
| --- | --- | --- |
| `product_slider` | `ProductSliderSection` | Products as carousel / grid / list |
| `category_section` | `CategorySection` | Category chips |
| `brand_section` | `BrandSection` | Brand chips |
| `banner_slider` | `BannerSliderSection` | Banner carousel |
| `grid_banner` | `GridBannerSection` | Banner grid |
| `title_image` | `TitleImageSection` | Title + artwork |
| `text` | `TextSection` | Rich text |

### Section wrapper keys

Set on the outer section object:

| Key | Effect |
| --- | --- |
| `margin_top`, `margin_bottom` | Vertical spacing |
| `border_radius` | Corner radius of the section panel |

### The `variant` contract

Every section that can paint a backdrop honours the same four variants:

| `variant` | Title | Background | Colours |
| --- | --- | --- | --- |
| `default` (or unset) | ✗ | ✗ | ✗ |
| `with_title` | ✓ | ✗ | ✗ |
| `with_background` | ✓ | `background_image_url` | `text_color` |
| `with_color` | ✓ | `background_color` | `text_color` |

Fields are ignored **by variant, not by emptiness** — the Admin Panel may leave
values populated from a previously selected variant, so `default` shows nothing
even when a colour and title are present in the payload.

### Backdrop keys

| Key | Notes |
| --- | --- |
| `background_image_url` | Empty string means "no image" |
| `background_color` | `with_color` only |
| `text_color` | Section **heading** colour |
| `item_text_color` | Chip **caption** colour (categories/brands) |
| `bg_image_aspect` | Ratio of the backdrop, e.g. `"3:1"`, `"3:4"` |

`text_color` and `item_text_color` are separate because the heading sits on the
backdrop while the captions sit under the chips — one colour cannot serve both
without making one of them unreadable.

`bg_image_aspect` sets a **minimum** height, not a fixed one. The panel resolves
to `max(ratio height, content height)`, so the chips are never cropped on a
narrow viewport. It is implemented as a zero-width floated spacer with a
percentage `padding-top`, because percentage padding resolves against *width*
(an `aspect-ratio` on a zero-width box would compute to zero height).

### Layout keys per section

**Product slider** — `layout`: `horizontal` | `list` | `grid` / `grid_<n>`

| Key | Effect |
| --- | --- |
| `grid_columns` | Column count |
| `product_grid_gap` | Gap in px |
| `product_card_radius` | Card corner radius (`0` = square) |
| `block_padding` | Padding inside the block |
| `section_title` | Heading |

**Category / brand section** — `layout`: `horizontal` | `circular` | `grid`

| Key | Effect |
| --- | --- |
| `grid_columns` | Column count |
| `category_gap` / `brand_gap` | Gap in px |
| `category_radius` / `brand_radius` | Chip radius (ignored when `circular`) |
| `show_name` | Brand section only — hide captions |

### "See All" / data sources

A product block declares how it was sourced, and the storefront forwards that to
the listing page:

| `data_source` | Id field on the block |
| --- | --- |
| `category` | `category_id` |
| `brand` | `brand_id` |
| `manual` | `config.manual_product_ids` (CSV) |
| `most_favorite`, … | none |

The "View More" button only renders when the API sends
`viewMorePreviewImages` — an empty array means the block has nothing more to
show.

## Channels (quick vs all-shop)

The store can run two channels — fast local delivery and a wider catalogue.

```js
mode: "quick" | "allShop"
```

> The Redux value for the second channel is `"allShop"`, but the **API string is
> `"ecommerce"`**. Do not use them interchangeably.

Driven by `home_layout`:

| Field | Meaning |
| --- | --- |
| `available_modes` | `both` shows the channel toggle; anything else hides it |
| `layout_mode` | Which channel is the default (or the only one) |
| `channel_label_quick` / `channel_label_ecommerce` | Toggle labels |
| `time_to_deliver` | ETA label, e.g. `"22 mins"` |
| `store_closed` | `1` keeps the catalogue browsable but disables the buy path |

Carts are **per channel**: switching channels loads that channel's cart, and
currency is re-read from the cart response (settings do not carry it).

## Zones and URLs

A zone is a delivery area with its own catalogue and pricing. Zone slugs prefix
the URL:

```
/bhuj-quick              → zone home
/bhuj-quick/products     → zone listing
/ur/bhuj-quick/products  → localised zone listing
```

`src/middleware.js` rewrites these onto the underlying route, so the zone slug
survives only in `router.asPath`. Build links with `useZoneHref()` — it preserves
both the zone and the language:

```jsx
const zoneHref = useZoneHref();
<Link href={zoneHref("/products")}>Shop</Link>
```

On a shared zone link the client re-resolves the slug to coordinates
(`getZones` → polygon centre → `setCity`), otherwise the header would sit on
"Loading…" forever.

## Languages

- Available languages come from the API; the selection persists in Redux.
- `t("key")` reads server-supplied translations, falling back to bundled
  `src/utils/en.json`. The local `ur.json` is **not** used at runtime.
- RTL is handled by `useIsRtl()` / `useDir()`, which set `dir` on containers.

> **Hydration caution:** `t()` reads the persisted store, so the server renders
> English while the client may render another locale. For text that appears
> before mount, render a static string rather than `t()`, or gate on
> `useIsHydrated()`.

## SEO

| Setting | Where | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_SEO` | `.env` | **Must be `true`.** Server build with SSR. `false` switches to a static export that silently drops middleware — zone and language URLs 404. |
| `NEXT_PUBLIC_BASE_URL` | `.env` | Canonical URLs and `sitemap.xml` |
| `NEXT_PUBLIC_META_TITLE` / `_DESCRIPTION` / `_KEYWORDS` | `.env` | Defaults when the API supplies none |

Per-page metadata comes from the API via `src/utils/selectSeoRow.js`;
`canonicalUrl.js` builds canonical tags. Blog canonicals deliberately drop the
zone prefix to avoid duplicate-content across zones.

See [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md) for verifying SEO output on a live
server.

## Payments

Enabled gateways come from the API and are read through
`src/utils/paymentSettings.js`. Supported integrations include Razorpay,
Stripe, PayPal, Paystack, Cashfree, Midtrans, PhonePe, PayTabs, and cash on
delivery. No gateway keys live in the storefront — the Admin Panel holds them.

## Adding a new configurable section

1. Create the component in `src/components/homelayout/sections/`.
2. Register its `type` in the switch in `HomeLayout.jsx`, passing
   `borderRadius={sectionRadius}` if it paints a backdrop.
3. Reuse the `variant` contract above rather than inventing new keys.
4. Read colours from CSS variables so the section follows the brand
   automatically.
