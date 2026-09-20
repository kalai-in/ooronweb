import { isZoneCandidate } from "@/utils/reservedRoutes";
import { ZONE_PREFIXABLE_ROUTES } from "@/utils/zonePrefixable";

// Zone-aware URL building for the client.
//
// Only the routes under src/app/[lang]/(zoned)/[zone]/ are real zone routes
// (see proxy.ts and src/utils/zonePrefixable.ts, the single source of truth
// for which route names those are). These helpers deliberately refuse to
// build zone URLs for anything else — emitting /surat-zone/products before
// that route exists would just 404 the user.

/**
 * Split a pathname into its zone (if any) and the rest.
 * "/bhuj-quick/product/x" -> { zone: "bhuj-quick", rest: ["product", "x"] }
 * "/bhuj-quick"           -> { zone: "bhuj-quick", rest: [] }
 * "/product/x"            -> { zone: null,        rest: ["product", "x"] }
 * "/"                     -> { zone: null,        rest: [] }
 */
export interface ZonePath {
  zone: string | null;
  rest: string[];
}

export const parseZonePath = (pathname = ""): ZonePath => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 1 && isZoneCandidate(segments[0])) {
    return { zone: segments[0], rest: segments.slice(1) };
  }
  return { zone: null, rest: segments };
};

/**
 * Swap the zone on the current path, keeping the rest intact.
 *
 * Returns null when the path has no zone-prefixable route — the caller should
 * stay put rather than navigate somewhere that doesn't exist.
 *
 *   /                        + surat-zone -> /surat-zone
 *   /bhuj-quick              + surat-zone -> /surat-zone
 *   /bhuj-quick/product/kiwi + surat-zone -> /surat-zone/product/kiwi
 *   /product/kiwi            + surat-zone -> /surat-zone/product/kiwi
 *   /products                + surat-zone -> null   (route not migrated yet)
 *   /cart                    + surat-zone -> null   (never zone-prefixed)
 */
export const buildZoneUrl = (
  pathname = "",
  zoneSlug: string | null | undefined,
): string | null => {
  if (!zoneSlug) return null;
  const { rest } = parseZonePath(pathname);
  return buildZonePath(rest, zoneSlug);
};

/**
 * Prefix already-parsed segments with a zone. Shared by buildZoneUrl (zone
 * switching) and useZoneHref (link building) so both honour the same
 * ZONE_PREFIXABLE rule — they must never disagree about which routes exist.
 *
 * Returns null when the route isn't zone-prefixable.
 */
export const buildZonePath = (
  rest: string[] = [],
  zoneSlug: string | null | undefined,
): string | null => {
  if (!zoneSlug) return null;
  // Bare home (or a bare zone URL) -> that zone's home.
  if (!rest.length) return `/${zoneSlug}`;
  if (!ZONE_PREFIXABLE_ROUTES.has(rest[0])) return null;
  return `/${zoneSlug}/${rest.join("/")}`;
};
