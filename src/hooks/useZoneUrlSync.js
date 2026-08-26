import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import { parseZonePath } from "@/utils/zoneUrl";

// Routes that accept a zone prefix — mirrors middleware.js and zoneUrl.js.
// blog/blogs excluded: articles are zone-independent, so their URLs stay clean.
const ZONE_PREFIXABLE = new Set(["product", "products", "categories"]);
import useLanguages from "@/hooks/useLanguages";
import { buildLocalizedPath } from "@/utils/canonicalUrl";

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
 * Only acts on pages that ALREADY carry a zone. On /product/x or /cart the user
 * hasn't opted into zone URLs, so switching mode must not suddenly prefix one.
 */
const useZoneUrlSync = () => {
  const router = useRouter();
  const { parseLangPath, defaultCode } = useLanguages();
  const zoneSlug = useSelector((state) => state?.ShopMode?.zoneSlug);
  // Parse the zone out of asPath — the path as the user sees it. Do NOT read
  // router.query.zone: middleware injects it, but the first client-side
  // router.replace (e.g. _app's ?lang= sync) drops it, so it survives only until
  // hydration settles. asPath keeps the zone segment for the page's whole life.
  // Strip the language segment first (it's the outer one), so the zone parse
  // below sees the zone and not "ur" as a zone candidate. The language is then
  // re-applied when rebuilding the URL, so a mode swap on /ur/... stays on /ur.
  const currentPath = router.asPath.split("?")[0];
  const { lang: routeLang, rest: afterLang } = parseLangPath(currentPath);
  const { zone: routeZone, rest } = parseZonePath("/" + afterLang.join("/"));
  const lastSynced = useRef(null);

  useEffect(() => {
    if (!router.isReady) return;
    // Not on a zone URL — nothing to keep in sync.
    if (!routeZone) return;
    if (!zoneSlug || zoneSlug === routeZone) return;
    // Belt-and-braces: only rewrite routes that can actually carry a zone. If a
    // language segment were ever misparsed as a zone (it can be, before the
    // language list loads), this stops us rewriting /pt/cart to /bhuj-quick/cart
    // — a URL that 404s. The zone-able list is the same one middleware enforces.
    if (rest.length && !ZONE_PREFIXABLE.has(rest[0])) return;
    // Don't re-fire for a swap already performed (router.query updates async).
    if (lastSynced.current === zoneSlug) return;

    // Rebuild with the same language, the new zone, and the route below the zone.
    const routePath = `/${rest.join("/")}`;
    const nextUrl = buildLocalizedPath({
      lang: routeLang,
      zone: zoneSlug,
      path: routePath,
      defaultCode,
    });
    if (!nextUrl || nextUrl === currentPath) return;

    lastSynced.current = zoneSlug;
    // zone/lang are middleware internals; echoing them back would resurface
    // ?zone=/?lang= in the public URL. slug is the route param, already in path.
    const {
      zone: _zone,
      lang: _lang,
      slug: _slug,
      ...publicQuery
    } = router.query;
    // replace, not push: switching channel isn't a new history entry — Back should
    // return to the previous page, not the pre-toggle URL.
    router.replace({ pathname: nextUrl, query: publicQuery }, undefined, {
      shallow: false,
    });
    // currentPath/rest/router are intentionally omitted: they're recomputed
    // fresh every render (new object/array identities), and routeZone/routeLang
    // already change whenever currentPath/rest would — adding them here would
    // fire this effect on every render instead of only on an actual zone swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneSlug, routeZone, routeLang, router.isReady, defaultCode]);
};

export default useZoneUrlSync;
