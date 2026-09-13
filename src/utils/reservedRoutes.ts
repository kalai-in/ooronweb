// Top-level path segments that are real routes, not zone slugs.
//
// With real [lang]/[zone] path segments, Next's own route resolution (static
// beats dynamic) disambiguates a route name from a zone slug for MATCHING
// purposes — this set is no longer needed for that job. It's still needed by
// a few places that parse a raw pathname string outside of Next's router:
// proxy.ts's legacy zoned-blog redirect (is segment[0] a real page or a zone
// slug?) and Custom404.tsx's Home-link builder (same question, no gSSP/params
// available on a static 404 page). Mirrors the top-level directories in
// src/app/[lang]/(plain)/ + src/app/[lang]/(zoned)/[zone]/ — MUST be updated
// when adding a top-level route, or that route will be mistaken for a zone.
export const RESERVED_ROUTES = new Set([
  // page routes (src/app/*)
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
export const isZoneCandidate = (segment?: string | null): boolean =>
  !!segment && !RESERVED_ROUTES.has(segment) && ZONE_SLUG_PATTERN.test(segment);
