// Top-level path segments that are real routes, not zone slugs.
//
// Zone URLs are /{zone}/product/{slug}, so the first segment is ambiguous:
// nothing in the path itself says whether "bhuj" is a zone or a page. Middleware
// can't ask the API (it runs on every request), so it decides by exclusion —
// anything NOT in this set is a zone candidate. Actual zone validity is checked
// in getServerSideProps via the zone resolver, which 404s on a miss.
//
// MUST be updated when adding a top-level route, or that route will be
// mistaken for a zone and 404. Mirrors the directories in src/pages/.
export const RESERVED_ROUTES = new Set([
  // page routes (src/pages/*)
  "404",
  "about-us",
  "blog",
  "blogs",
  "brands",
  "cancellation-policy",
  "cart",
  "categories",
  "checkout",
  "contact-us",
  "countries",
  "faqs",
  "order-detail",
  "privacy-policy",
  "product",
  "products",
  "profile",
  "return-and-exchange-policy",
  "sellers",
  "shipping-policy",
  "terms-and-conditions",
  "web-payment-status",
  // framework + static assets
  "_next",
  "api",
  "favicon.ico",
  "manifest.json",
  "robots.txt",
  "sitemap.xml",
]);

// A zone slug is lowercase alphanumeric with hyphens (the API emits e.g.
// "bhuj-quick", "surat-zone"). Anything with a dot is a static file.
const ZONE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Could this path segment be a zone slug? Shape check only — says nothing about
 * whether the zone exists. That is the resolver's job, in getServerSideProps.
 */
export const isZoneCandidate = (segment) =>
  !!segment && !RESERVED_ROUTES.has(segment) && ZONE_SLUG_PATTERN.test(segment);
