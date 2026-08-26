import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import { parseZonePath } from "@/utils/zoneUrl";
import { buildLocalizedPath } from "@/utils/canonicalUrl";
import useLanguages from "@/hooks/useLanguages";

// Routes that accept a zone prefix. A link to any other route (e.g. /cart) gets
// neither lang nor zone — it's global. Mirrors ZONE_PREFIXABLE in zoneUrl.js.
// blog/blogs are NOT prefixable: articles read the same in every zone, so
// zoneHref() passes blog links straight through un-zoned.
const ZONE_PREFIXABLE = new Set(["product", "products", "categories"]);

/**
 * Builds language- and zone-prefixed hrefs for links, so navigating from a
 * localized zone page keeps both segments:
 *   on /ur/bhuj-quick  ->  /product/x becomes /ur/bhuj-quick/product/x
 *
 * Sources, in order:
 *   lang — the language segment of asPath (the page the user is on)
 *   zone — the zone segment of asPath, else redux selectedZone (for links on
 *          non-zone pages like the legacy /products)
 *
 * asPath, NOT router.query: middleware injects lang/zone as query params, but
 * the first client-side router.replace drops them, so they only survive until
 * hydration. asPath keeps both segments for the page's whole life.
 *
 * Order matters — language is the outer segment, so strip it before parsing the
 * zone (otherwise "ur" reads as a zone candidate).
 *
 * Returns paths unchanged when there's nothing to prefix, or when the target
 * route isn't zone-prefixable — so links never point at a route that would 404.
 */
const useZoneHref = () => {
  const router = useRouter();
  const { parseLangPath, defaultCode } = useLanguages();
  const storedZone = useSelector(
    (state) => state?.LocationModal?.selectedZone?.slug,
  );

  const currentPath = router.asPath.split("?")[0];
  const { lang: routeLang, rest: afterLang } = parseLangPath(currentPath);
  const { zone: routeZone } = parseZonePath("/" + afterLang.join("/"));

  return useCallback(
    (href) => {
      if (typeof href !== "string" || !href.startsWith("/")) return href;

      const zoneSlug = routeZone || storedZone;
      if (!zoneSlug && !routeLang) return href;

      // Split off query/hash so they survive the prefixing.
      const [path, ...tail] = href.split(/(?=[?#])/);
      // Strip any existing lang/zone so we never double-prefix.
      const { lang: hrefLang, rest: hrefAfterLang } = parseLangPath(path);
      const { zone: hrefZone, rest } = parseZonePath("/" + hrefAfterLang.join("/"));
      if (hrefLang || hrefZone) return href;

      // Language attaches to EVERY route — /cart, /profile included — or
      // navigating there would reset the UI to the default language. Zone is
      // narrower: only migrated routes accept it, since a zone URL promises
      // location-specific content.
      //
      // Empty rest = home ("/"), which IS a zone route (/{zone} is the zone
      // home). Without this the logo and Home crumb drop the zone.
      const canZone = rest.length === 0 || ZONE_PREFIXABLE.has(rest[0]);
      const routePath = `/${rest.join("/")}`;
      const built = buildLocalizedPath({
        lang: routeLang,
        zone: canZone ? zoneSlug : null,
        path: routePath,
        defaultCode,
      });
      return built + tail.join("");
    },
    [routeZone, routeLang, storedZone, parseLangPath, defaultCode],
  );
};

export default useZoneHref;
