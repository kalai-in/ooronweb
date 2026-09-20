import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseFilterFromQuery,
  serializeFilterPatch,
  clearFilterQuery,
  hasNoFilterParams,
} from "@/utils/urlProductFilters";

// Single source of truth for product-listing filter values: the URL query
// string. No redux involved — reading `filter` parses the search params,
// every setter writes back via router.replace (client-fetched; App Router's
// replace() does not re-run the server component tree unless the target
// segment's data actually changed, so per-checkbox clicks stay cheap).
//
// Every write spreads the current search params forward first and only ever
// adds/deletes the keys this module owns (see OWNED_QUERY_KEYS in
// urlProductFilters.js) — zone/lang/slug and anything else already in the URL
// pass through untouched, matching the same safe-forwarding pattern
// useZoneUrlSync/useLanguageSwitch use for their own params.
export default function useUrlProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Plain object view of the current search params — the shared pure helpers
  // (parseFilterFromQuery etc.) already speak this shape, since they're used
  // both here and server-side against context.query.
  const currentQuery = useMemo(
    () => Object.fromEntries(searchParams?.entries() ?? []),
    [searchParams],
  );

  const filter = useMemo(
    () => parseFilterFromQuery(currentQuery),
    [currentQuery],
  );

  const currentPath = pathname || "/";

  // Builds the literal visible URL string (path + query) for the address bar.
  const buildUrlString = useCallback(
    (query: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v != null && v !== ""),
      ).toString();
      return qs ? `${currentPath}?${qs}` : currentPath;
    },
    [currentPath],
  );

  const applyUrl = useCallback(
    (nextUrl: string) => {
      router.replace(nextUrl, { scroll: false });
    },
    [router],
  );

  const patchUrl = useCallback(
    (patch: Record<string, any>) => {
      const nextQuery = serializeFilterPatch(currentQuery, patch);
      // Skip the replace if nothing actually changed (same keys/values) —
      // avoids redundant history-adjacent replaces.
      const same =
        Object.keys(nextQuery).length === Object.keys(currentQuery).length &&
        Object.entries(nextQuery).every(([k, v]) => currentQuery[k] === v);
      if (same) return;
      applyUrl(buildUrlString(nextQuery));
    },
    [currentQuery, applyUrl, buildUrlString],
  );

  const clearAll = useCallback(
    ({ preserveCategory = false } = {}) => {
      const nextQuery = clearFilterQuery(currentQuery, { preserveCategory });
      applyUrl(buildUrlString(nextQuery));
    },
    [currentQuery, applyUrl, buildUrlString],
  );

  return {
    filter,
    isReady: true,
    // True when the URL carries no filter query params at all — used to gate
    // SSR initialData reuse (the "untouched default view" check).
    isDefaultUnfilteredView: hasNoFilterParams(currentQuery),
    setSearch: (v: any) => patchUrl({ search: v || null }),
    setBrandIds: (arr: any) => patchUrl({ brand_ids: arr }),
    setCategoryId: (id: any) => patchUrl({ category_id: id || null }),
    setAttributeValueIds: (arr: any) => patchUrl({ attribute_value_ids: arr }),
    setPriceFilter: (minMaxOrNull: any) => patchUrl({ price_filter: minMaxOrNull }),
    setSort: (v: any) => patchUrl({ sort_filter: v || null }),
    setSellerId: (id: any) => patchUrl({ seller_id: id || null }),
    setCountryId: (id: any) => patchUrl({ country_id: id || null }),
    setMany: (patch: Record<string, any>) => patchUrl(patch),
    clearAll,
    // Escape hatch for navigation call sites building a query object to hand
    // directly to router.push toward a DIFFERENT page (e.g. Category.jsx
    // navigating from /categories/[slug] to /products) — no "current query"
    // to merge against, just serialize the patch alone.
    buildQueryPatch: (patch: Record<string, any>) => serializeFilterPatch({}, patch),
  };
}
