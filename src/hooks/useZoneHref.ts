import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";
import { buildLocalizedPath } from "@/utils/canonicalUrl";
import { isZonePrefixableRoute } from "@/utils/zonePrefixable";
import useLanguages from "@/hooks/useLanguages";
import useIsHydrated from "@/hooks/useIsHydrated";
import { useSsrZone } from "@/app/SsrZoneProvider";

/**
 * Builds language- and zone-prefixed hrefs for links, so navigating from a
 * localized zone page keeps both segments:
 *   on /ur/bhuj-quick  ->  /product/x becomes /ur/bhuj-quick/product/x
 *
 * Sources, in order:
 *   lang — the [lang] route param of the page the user is on
 *   zone — the [zone] route param of the page the user is on, else redux
 *          selectedZone (for links built on non-zone pages like /products)
 *
 * useParams() gives the CURRENT route's real segments directly — no more
 * parsing usePathname() to re-derive them (real path segments, resolved by
 * Next's own router, replace the earlier string-shape guessing this hook did
 * under the rewrite-to-query-param architecture).
 *
 * Returns paths unchanged when there's nothing to prefix, or when the target
 * route isn't zone-prefixable — so links never point at a route that would 404.
 */
const useZoneHref = () => {
  const params = useParams<{ lang?: string; zone?: string }>();
  const { defaultCode } = useLanguages();
  const rawStoredZone = useSelector(
    (state: any) => state?.LocationModal?.selectedZone?.slug,
  );
  // storedZone is redux-persist state — empty on the server and on the very
  // first client render, then populated once PersistGate rehydrates. Reading
  // it unguarded made zoneHref("/") build a different href on that first
  // client render than the server emitted (e.g. "/" -> "/dubai"), a real
  // hydration mismatch on every link built from it (the header logo, in
  // particular, since it's the first thing painted). routeZone is exempt —
  // it comes from the URL itself via useParams(), which is already identical
  // server/client.
  const isHydrated = useIsHydrated();
  const storedZone = isHydrated ? rawStoredZone : undefined;

  // The zone the server itself rendered this zone-less page with (bare "/").
  // Unlike storedZone it is NOT persisted state — it's a prop threaded through
  // the tree, so it's identical on the server and the first client render and
  // needs no hydration gate. It exists so SSR HTML links to a real zone URL
  // instead of a bare /product/x, which has no route and 404s for crawlers.
  const ssrZone = useSsrZone();

  const routeLang = params?.lang ?? null;
  const routeZone = params?.zone ?? null;

  return useCallback(
    (href: string) => {
      if (typeof href !== "string" || !href.startsWith("/")) return href;

      // Route param wins (the URL is authoritative), then the user's own
      // persisted zone once hydrated, then the server's fallback so the
      // pre-hydration markup still points at a routable URL.
      const zoneSlug = routeZone || storedZone || ssrZone;
      if (!zoneSlug && !routeLang) return href;

      // Split off query/hash so they survive the prefixing.
      const [path, ...tail] = href.split(/(?=[?#])/);
      const rest = path.replace(/^\//, "").split("/").filter(Boolean);

      // Language attaches to EVERY route — /cart, /profile included — or
      // navigating there would reset the UI to the default language. Zone is
      // narrower: only zone-prefixable routes accept it, since a zone URL
      // promises location-specific content.
      //
      // Empty rest = home ("/"), which IS a zone route (/{zone} is the zone
      // home). Without this the logo and Home crumb drop the zone.
      const canZone = rest.length === 0 || isZonePrefixableRoute(rest[0]);
      const built = buildLocalizedPath({
        lang: routeLang,
        zone: canZone ? zoneSlug : null,
        path,
        defaultCode,
      });
      return built + tail.join("");
    },
    [routeZone, routeLang, storedZone, ssrZone, defaultCode],
  );
};

export default useZoneHref;
