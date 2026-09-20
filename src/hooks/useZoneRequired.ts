import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, usePathname, useRouter } from "next/navigation";
import { setShowLocation } from "@/redux/slices/locationModalSlice";
import { buildLocalizedPath } from "@/utils/canonicalUrl";
import { isZonePrefixableRoute } from "@/utils/zonePrefixable";
import useLanguages from "@/hooks/useLanguages";
import useIsHydrated from "@/hooks/useIsHydrated";

/**
 * Enforces that a zone-prefixable route always carries a zone:
 *
 *   - URL already has a zone (params.zone set) -> nothing to do.
 *   - No zone in the URL, but one is already known (a previous visit's pick,
 *     persisted in LocationModal.selectedZone) -> redirect to the zone-
 *     prefixed URL for the current route, silently, no modal.
 *   - No zone known at all -> force the location-picker modal open. The
 *     visitor can't browse a zone-prefixable page without picking one first.
 *
 * Only acts on zone-prefixable routes (home, products, product/[slug],
 * categories, categories/[slug]) — every other route (cart, checkout,
 * profile/*, static content) is intentionally zone-free and untouched here.
 */
const useZoneRequired = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ lang?: string; zone?: string }>();
  const dispatch = useDispatch();
  const { defaultCode } = useLanguages();
  const storedZoneSlug = useSelector(
    (state: any) => state?.LocationModal?.selectedZone?.slug,
  );
  // storedZoneSlug is persisted (redux-persist), so it's empty on the server
  // and on the very first client render, then populates once PersistGate
  // rehydrates. Acting on it before that (a router.replace() mid-hydration)
  // races React's own reconciliation of the just-hydrated tree and throws
  // "Cannot read properties of null (reading 'removeChild')". Gate on
  // isHydrated so this effect's redirect/modal-open only ever runs once
  // hydration has fully settled — matches every other persisted-state
  // consumer in this codebase (see useIsHydrated's own doc comment).
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;
    // Already on a zone URL — nothing to enforce.
    if (params?.zone) return;

    const currentPath = pathname || "/";
    const segments = currentPath.split("/").filter(Boolean);
    // Strip a leading language segment (if present) before checking the
    // route shape — [lang] never counts as the route name itself.
    const routeSegments =
      params?.lang && segments[0] === params.lang ? segments.slice(1) : segments;
    const routeName = routeSegments[0];

    if (!isZonePrefixableRoute(routeName)) return;

    if (storedZoneSlug) {
      // A zone is already known (e.g. from a previous visit) — redirect
      // silently to the zone-prefixed URL for this exact route, preserving
      // any query string (filters, etc.).
      const routePath = `/${routeSegments.join("/")}`;
      const nextUrl = buildLocalizedPath({
        lang: params?.lang ?? null,
        zone: storedZoneSlug,
        path: routePath,
        defaultCode,
      });
      if (nextUrl && nextUrl !== currentPath) {
        const qs = new URLSearchParams(window.location.search).toString();
        router.replace(qs ? `${nextUrl}?${qs}` : nextUrl);
      }
      return;
    }

    // No zone known at all — the visitor must pick one before browsing a
    // zone-prefixable page. Force the location modal open.
    dispatch(setShowLocation(true));
    // router/searchParams deliberately omitted: Next's useRouter() memoizes a
    // fresh object keyed on bfcacheId, which changes on every push/replace —
    // including router here would re-fire this effect right after the
    // router.replace() call above. The params?.zone guard makes that safe
    // (the URL now carries a zone, so the re-fire is a no-op), but it's
    // needless churn; the effect only needs to react to the state listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, params?.zone, params?.lang, pathname, storedZoneSlug, dispatch, defaultCode]);
};

export default useZoneRequired;
