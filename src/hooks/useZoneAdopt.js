import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { parseZonePath } from "@/utils/zoneUrl";

// Routes that accept a zone prefix — mirrors middleware.js and zoneUrl.js.
// blog/blogs excluded: middleware 308s a zoned blog URL to its zone-less form
// before any page mounts, so there is no zone left here to adopt.
const ZONE_PREFIXABLE = new Set(["product", "products", "categories"]);
import { setSelectedZone } from "@/redux/slices/locationModalSlice";
import useLanguages from "@/hooks/useLanguages";

/**
 * Adopts the zone from the URL into Redux — the zone equivalent of _app's
 * URL→Redux language sync.
 *
 * Why this exists: selectedZone was only ever set by the location modal. A user
 * landing on /bhuj-quick (a shared link, a Google result) had no zone in Redux,
 * so the moment they navigated to a page that ISN'T zone-prefixed
 * (/categories/all, /cart), useZoneHref lost its fallback and every subsequent
 * link dropped the zone.
 *
 * Stores the whole zone object to match what the modal stores — but only the
 * slug is knowable from the URL, so id/name are filled from the zones list when
 * it's available and left null otherwise. Consumers read `.slug`.
 */
const useZoneAdopt = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { parseLangPath } = useLanguages();
  const storedSlug = useSelector(
    (state) => state?.LocationModal?.selectedZone?.slug,
  );

  useEffect(() => {
    if (!router.isReady) return;
    // Strip the language segment first — otherwise "ur" parses as a zone.
    const currentPath = router.asPath.split("?")[0];
    const { rest: afterLang } = parseLangPath(currentPath);
    const { zone: urlZone, rest } = parseZonePath("/" + afterLang.join("/"));

    // Only adopt a zone from a route that can actually carry one. Before the
    // language list loads, a language segment can parse as a zone ("pt" isn't
    // reserved and matches the slug shape) — without this we'd store "pt" as the
    // user's zone and poison every subsequent link.
    if (rest.length && !ZONE_PREFIXABLE.has(rest[0])) return;

    // No zone in the URL: leave Redux alone. The user's stored pick must
    // survive a visit to /cart — unlike language, absence means "unknown here",
    // not "default".
    if (!urlZone || urlZone === storedSlug) return;

    dispatch(setSelectedZone({ id: null, name: null, slug: urlZone }));
  }, [router.isReady, router.asPath, storedSlug, dispatch, parseLangPath]);
};

export default useZoneAdopt;
