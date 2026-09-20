import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { usePathname, useParams, useRouter } from "next/navigation";
import useLanguages from "@/hooks/useLanguages";
import { buildLocalizedPath } from "@/utils/canonicalUrl";
import { DEFAULT_LANGUAGE } from "@/utils/languageRoutes";

/**
 * Keeps the zone segment in the URL honest when the shop-mode toggle changes it.
 *
 * A city can have one zone record per channel (Bhuj: bhuj-quick / bhuj-ecommerce).
 * Toggling Quick <-> Shop all refetches home_layout (shopMode is in its queryKey),
 * which returns that channel's `zone_slug`. Without this, the content switches but
 * the URL keeps naming the old zone — /bhuj-quick showing e-commerce stock.
 *
 * Cities with a single zone need no special case: home_layout returns the same
 * zone_slug for both channels (Ahmedabad -> "ahmedabad" either way), so the URL
 * never changes.
 *
 * Only acts on pages that ALREADY carry a zone (params.zone is set — Next's own
 * router already confirmed this route matched the [lang]/(zoned)/[zone]/...
 * branch, so no shape-guessing is needed to know that). On /product/x or /cart
 * the user hasn't opted into zone URLs, so switching mode must not suddenly
 * prefix one.
 */
const useZoneUrlSync = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ lang?: string; zone?: string }>();
  const { defaultCode } = useLanguages();
  const zoneSlug = useSelector((state: any) => state?.ShopMode?.zoneSlug);
  const cityLat = useSelector((state: any) => state?.City?.city?.latitude);
  const cityLng = useSelector((state: any) => state?.City?.city?.longitude);
  const lastSynced = useRef<string | null>(null);
  // ShopMode is API-driven: Layout.tsx's home-layout effect (keyed on
  // city.latitude/longitude) is the only thing that writes zoneSlug, via
  // setChannel. A manual zone pick (Location.tsx) updates City.city and the
  // URL SYNCHRONOUSLY, but zoneSlug still names the PREVIOUS zone until that
  // effect's async home_layout fetch resolves for the NEW coordinates. In
  // that window, stale-zoneSlug != just-changed-routeZone looks identical to
  // a real Quick/Shop-all channel swap (this hook's actual purpose — see
  // file doc comment), so without a guard this hook fires router.replace
  // back to the OLD zone. useZoneAdopt then re-adopts it, and once
  // home_layout finally resolves and flips zoneSlug forward again, this hook
  // fires a second time — an oscillation, not a one-off revert.
  //
  // Fix: remember which city coordinates the CURRENT zoneSlug value was
  // confirmed against (updated only when zoneSlug itself changes). If the
  // city has since moved to different coordinates, zoneSlug hasn't been
  // refreshed for them yet — wait for the next setChannel instead of acting
  // on stale data. Coordinates (not zone id/slug) are the correct key here
  // because they're exactly what Layout.tsx's effect — the sole writer of
  // zoneSlug — itself keys on.
  const confirmedFor = useRef<{ lat: any; lng: any; slug: string | null }>({
    lat: undefined,
    lng: undefined,
    slug: null,
  });

  useEffect(() => {
    const routeZone = params?.zone ?? null;
    // Not on a zone URL — nothing to keep in sync.
    if (!routeZone) return;
    if (!zoneSlug || zoneSlug === routeZone) return;
    // zoneSlug hasn't been confirmed for the city's CURRENT coordinates —
    // it's a holdover from the previous city, not a real channel difference.
    if (confirmedFor.current.slug !== zoneSlug) {
      confirmedFor.current = { lat: cityLat, lng: cityLng, slug: zoneSlug };
    }
    if (confirmedFor.current.lat !== cityLat || confirmedFor.current.lng !== cityLng) {
      return;
    }
    // Don't re-fire for a swap already performed.
    if (lastSynced.current === zoneSlug) return;

    // The route's sub-path below /{lang}/{zone}/ isn't itself a named param
    // (only [lang] and [zone] are) — recover it from the pathname by dropping
    // exactly the number of segments those two params occupy.
    //
    // params.lang is populated by Next's own routing even for the DEFAULT
    // language, whose segment buildLocalizedPath omits from the URL (see its
    // `lang !== def` guard) — counting it unconditionally here ate one extra
    // *real* path segment (e.g. "product") whenever the visitor was on the
    // default language, producing /bhuj-ecommerce/red-onion-100-gm instead of
    // /bhuj-ecommerce/product/red-onion-100-gm. Only count it when it's
    // actually non-default, mirroring the exact condition that put it there.
    const currentPath = pathname || "/";
    const segments = currentPath.split("/").filter(Boolean);
    const langOccupiesSegment = Boolean(
      params?.lang && params.lang !== (defaultCode || DEFAULT_LANGUAGE),
    );
    const dropCount = (langOccupiesSegment ? 1 : 0) + 1; // +1 for [zone], always present here
    const rest = segments.slice(dropCount);
    const routePath = `/${rest.join("/")}`;

    const nextUrl = buildLocalizedPath({
      lang: params?.lang ?? null,
      zone: zoneSlug,
      path: routePath,
      defaultCode,
    });
    if (!nextUrl || nextUrl === currentPath) return;

    lastSynced.current = zoneSlug;
    const publicQuery = new URLSearchParams(window.location.search);
    const qs = publicQuery.toString();
    // replace, not push: switching channel isn't a new history entry — Back should
    // return to the previous page, not the pre-toggle URL.
    router.replace(qs ? `${nextUrl}?${qs}` : nextUrl);
    // router/searchParams deliberately omitted: Next's useRouter() memoizes a
    // fresh object keyed on bfcacheId, which changes on every push/replace —
    // including router here would re-fire this effect right after the
    // router.replace() call above (and again on every other navigation).
    // The lastSynced/zoneSlug guards above make that safe, but it's needless
    // churn; the effect only needs to react to the state actually listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneSlug, cityLat, cityLng, params?.zone, params?.lang, pathname, defaultCode]);
};

export default useZoneUrlSync;
