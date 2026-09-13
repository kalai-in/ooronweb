// Single source of truth for "can this route carry a zone segment" — used by
// every link-building/sync hook that needs to decide whether to attach the
// current zone to a target href. Real [lang]/[zone] segments mean Next's own
// route resolution no longer needs this to MATCH routes (see src/proxy.ts and
// the src/app/[lang]/(zoned) tree), but link-building still needs it: a <Link>
// to /cart built from a page that IS on a zone must NOT be zone-prefixed.
//
// blog/blogs are deliberately ABSENT: an article reads identically in every
// zone, so a zone segment only forks one piece of content across N URLs for no
// gain. Blog links are emitted zone-less; proxy.ts 308s any old zoned ones.
export const ZONE_PREFIXABLE_ROUTES = new Set(["product", "products", "categories"]);

// undefined/empty first segment means home, which is always zone-prefixable.
export const isZonePrefixableRoute = (firstSegment?: string | null): boolean =>
  !firstSegment || ZONE_PREFIXABLE_ROUTES.has(firstSegment);
