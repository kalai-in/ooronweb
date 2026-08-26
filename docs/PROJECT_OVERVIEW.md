# eCommerce — Features & Description

A single-vendor, multi-country online store. Customers browse a catalog, add to cart, checkout with many payment options, track orders, chat with support, and manage their account. Content, languages, theme, and layout are all controlled from the admin backend — the store adapts without code changes.

- **Platform:** Next.js 16 web app (mobile-responsive, installable PWA-style)

---

## Shopping Channels (Quick vs All-Shop)

The store can run in **two delivery modes** that the shopper switches with a header toggle:

- **Quick** — fast/local delivery. Only available inside serviceable zones (checked against the customer's location).
- **All-Shop** — the full catalog with standard shipping.

The toggle appears only when both modes are enabled for the customer's area. The chosen mode changes which products, prices, and delivery options are shown. Each order remembers which channel it came from.

---

## Browsing & Discovery

| Feature | What the customer sees |
|---|---|
| **Home** | Fully dynamic homepage — banners, sliders, category tiles, product carousels, promo blocks. Layout comes from the backend, so the storefront changes without a redeploy. |
| **Categories** | Browse all categories; drill into a category to see its products. |
| **Brands** | Browse and shop by brand. |
| **Countries** | Shop by country (products grouped by country of origin/availability). |
| **Search** | Search products by keyword. |
| **Product filters** | Filter by price, brand, attributes, and sort order. Filter options are category-aware — they change per category, all driven by the backend. |
| **Product detail** | Full product page: image gallery, variants, price, ratings & reviews, recommendations, recently-viewed. |
| **Quick view** | Open a product in a popup straight from any product card — no full page load. |
| **Variant picker** | Choose size / color / variant in a modal from the card before adding to cart. |

---

## Cart & Checkout

- **Cart** — add/remove items, change quantity, see subtotal. Works for **guests** too (separate guest carts per channel), merged in on login.
- **Not-deliverable notice** — cart warns when items can't be delivered to the selected location.
- **Coupons / promo codes** — apply a coupon in a drawer. Two kinds:
  - **Instant discount** — reduces order total now.
  - **Cashback** — credited to the customer's wallet after the order.
- **Checkout flow** — pick delivery address → choose payment method → review summary (delivery charge, discount, wallet) → place order. Checkout requires login.
- **Order types** — doorstep delivery or pickup.
- **Payment methods** — Razorpay, PayPal, Paystack, Stripe, Cashfree, PhonePe, and Cash on Delivery. Enabled methods come from backend settings.
- **Wallet at checkout** — customers can pay part/all of an order from their wallet balance.
- **Post-payment status** — a confirmation/status page after payment completes.

---

## Orders & Tracking

The full order lifecycle after checkout:

| Feature | What it does |
|---|---|
| **Place order** | Creates the order from the cart with chosen address, payment method, order type (doorstep/pickup), and any coupon/wallet applied. |
| **Order list** | Split into **active orders** (in progress) and **order history** (completed/past). Quick and All-Shop orders are listed separately. |
| **Order detail** | Per-order view: items, quantities, prices, delivery charge, discounts, payment method, delivery address, and current status. |
| **Live tracking** | Real-time order tracking (delivery progress / location) for eligible orders. |
| **Order status** | Status updates through the order lifecycle; customer can advance/confirm certain steps. |
| **Cancel order** | Customer can cancel an order (per cancellation policy). |
| **Reorder** | Re-buy items from a past order. |
| **Invoice download** | Download the invoice for a whole order, or per-item invoices. |
| **Delivery chat** | Order-scoped chat with the delivery person / store while the order is active. |

---

## Account & Profile

All account pages require login.

| Feature | What it does |
|---|---|
| **Profile** | Edit name, email, phone, avatar. |
| **Addresses** | Add / edit / delete delivery addresses; pick a default. |
| **Active orders** | Orders currently in progress. |
| **Order history** | Past orders + per-order detail, invoice download, reorder. |
| **Wishlist / favorites** | Save products; quick-access from the bottom nav. |
| **Wallet history** | Wallet balance ledger (credits from cashback/refunds, debits from orders). |
| **Transactions** | Payment transaction history. |
| **Subscriptions** | Buy/manage subscription plans (only shown to eligible users). |
| **Reset password** | Change password (email accounts, or phone accounts where password auth is enabled). |
| **Notifications** | In-app notification list + notification preferences. |
| **Support chat** | Real-time chat with store support. |

---

## Rewards & Engagement

- **Wallet** — store credit used for payment; funded by cashback coupons and refunds.
- **Refer & earn** — each customer has a referral code to share (Facebook, X, WhatsApp, copy link). Both referrer and referred user earn credit; reward amounts and minimum order are set per country.
- **Subscriptions** — recurring plans for eligible customers.
- **Ratings & reviews** — customers rate and review purchased products.

---

## Communication

- **Support chat** — real-time customer ↔ store-support messaging. A floating chat widget is available to logged-in users on every page.
- **Delivery chat** — order-scoped chat between the customer and the delivery person (and store) while an order is active.
- **Push notifications** — browser push via Firebase (order updates, promos). Foreground notifications shown in-app.

---

## Location & Delivery

Location drives which store/zone serves the customer, delivery charges, and Quick-mode serviceability.

| Feature | What the customer does |
|---|---|
| **City / zone picker** | Header location modal — search a place or drag a map marker to set the delivery city. Backend returns the matching delivery zone (charges, max distance). |
| **Detect my location** | One tap uses browser GPS to auto-fill location; falls back to the saved city if permission is denied or times out (never lands on 0,0). |
| **Add / edit address** | Map + form: drag marker or "use current location", auto-fills address, area, city, pincode, state, country from the map, then customer completes name + phone. Saved for reuse at checkout. |
| **Live order tracking** | Map showing the rider → customer route, refreshed every few seconds while the order is out for delivery. |
| **Dual map providers** | Works with **Google Maps** or **OpenStreetMap** — chosen by a backend setting, no code change. OSM needs no API key. |


---

## Content Pages

Blogs (`/blogs`, article pages with view counts, popular tags, most-viewed), plus standard info/policy pages: About, Contact, FAQs, Privacy, Terms, Shipping, Cancellation, Return & Exchange.

---

## Localization & Theming

- **Multi-language** — customers switch language from the header. Translations are supplied by the backend per language. Full **RTL** support (e.g. Arabic/Urdu) — layout mirrors automatically.
- **Runtime theming** — brand primary color, light/dark mode, and layout style are set from admin settings. Animations and empty-state graphics recolor to match the brand color.

---

## Store States

- **Maintenance mode** — a full-screen gate when the admin puts the store under maintenance.
- **Offline overlay** — detects lost connectivity and shows an offline state.
- **Store closed** — quick-mode store-closed handling when outside operating hours.
- **App-install prompt** — bottom-sheet nudge to install the mobile app.
- **Offer popup** — promotional offer modal shown on the homepage (once per session).

---

## Authentication

No separate login pages — auth happens through **modals** (login, register, forgot password). Login supports email and phone (OTP) methods. First-time users get a **new-user modal** to complete their profile after signing in. Private pages (checkout, all profile pages) redirect guests home until they sign in.

---

