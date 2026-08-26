import { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  parseFilterFromQuery,
  serializeFilterPatch,
  clearFilterQuery,
  hasNoFilterParams,
} from "@/utils/urlProductFilters";

// Single source of truth for product-listing filter values: the URL query
// string. No redux involved — reading `filter` parses `router.query`, every
// setter writes back via a shallow `router.replace` (client-fetched, so a
// full navigation/SSR re-run per checkbox click would be wasteful).
//
// Every write spreads `router.query` forward first and only ever adds/deletes
// the keys this module owns (see OWNED_QUERY_KEYS in urlProductFilters.js) —
// zone/lang/slug and anything else already in the URL pass through untouched,
// matching the same safe-forwarding pattern useZoneUrlSync/useLanguageSwitch
// use for their own params.
export default function useUrlProductFilters() {
  const router = useRouter();

  const filter = useMemo(
    () => parseFilterFromQuery(router.query),
    [router.query],
  );

  // router.pathname is the FILE route ("/products"), not the public path — on
  // a zone URL (/mumbai/products, rewritten by middleware) that would rebuild
  // the URL as /products?zone=mumbai&..., dropping the zone out of the path
  // and into the query. router.asPath is what the address bar actually shows
  // (zone/lang segments intact), so it's the only safe pathname source here —
  // same reasoning useZoneUrlSync.js and useZoneHref.js already document.
  const currentPath = router.asPath.split(/[?#]/)[0];

  // Builds the literal visible URL string (path + query) for the address bar.
  const buildUrlString = useCallback(
    (query) => {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v != null && v !== ""),
      ).toString();
      return qs ? `${currentPath}?${qs}` : currentPath;
    },
    [currentPath],
  );

  // Shallow-updates the URL without disturbing router.isReady/asPath resolution.
  // Pages router's `router.replace(href, as, opts)`: `href` must resolve against
  // a real page (file route or dynamic pattern) or Next treats the navigation as
  // unresolvable — on a middleware-rewritten route like /mumbai/products (no such
  // page file) that silently breaks router state (isReady, subsequent shallow
  // pushes). `href: {pathname: router.pathname, query}` (the real matched file,
  // e.g. "/products", carrying the NEW filter query so router.query updates) is
  // what Next actually resolves/reads for `query`; `as` is the string shown in
  // the address bar and is what router.asPath reflects afterward — passing zone
  // (and any other current query keys) through `query` too, since the object
  // form's query IS what becomes router.query, not just the visible `as` string.
  const applyUrl = useCallback(
    (query, nextUrl) => {
      router.replace({ pathname: router.pathname, query }, nextUrl, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  const patchUrl = useCallback(
    (patch) => {
      const nextQuery = serializeFilterPatch(router.query, patch);
      // Skip the replace if nothing actually changed (same keys/values) —
      // avoids redundant history-adjacent replaces.
      const same =
        Object.keys(nextQuery).length === Object.keys(router.query).length &&
        Object.entries(nextQuery).every(([k, v]) => router.query[k] === v);
      if (same) return;
      // Strip zone/lang/slug from the VISIBLE url only (buildUrlString) — they
      // stay in `nextQuery` (passed to applyUrl below) since that becomes
      // router.query, and other code (useZoneHref etc.) still needs them there.
      const {
        zone: _zone,
        lang: _lang,
        slug: _slug,
        ...publicQuery
      } = nextQuery;
      applyUrl(nextQuery, buildUrlString(publicQuery));
    },
    [router, applyUrl, buildUrlString],
  );

  const clearAll = useCallback(
    ({ preserveCategory = false } = {}) => {
      const nextQuery = clearFilterQuery(router.query, { preserveCategory });
      const {
        zone: _zone,
        lang: _lang,
        slug: _slug,
        ...publicQuery
      } = nextQuery;
      applyUrl(nextQuery, buildUrlString(publicQuery));
    },
    [router, applyUrl, buildUrlString],
  );

  return {
    filter,
    isReady: router.isReady,
    // True when the URL carries no filter query params at all — used to gate
    // SSR initialData reuse (the "untouched default view" check).
    isDefaultUnfilteredView: hasNoFilterParams(router.query),
    setSearch: (v) => patchUrl({ search: v || null }),
    setBrandIds: (arr) => patchUrl({ brand_ids: arr }),
    setCategoryId: (id) => patchUrl({ category_id: id || null }),
    setAttributeValueIds: (arr) => patchUrl({ attribute_value_ids: arr }),
    setPriceFilter: (minMaxOrNull) => patchUrl({ price_filter: minMaxOrNull }),
    setSort: (v) => patchUrl({ sort_filter: v || null }),
    setSellerId: (id) => patchUrl({ seller_id: id || null }),
    setCountryId: (id) => patchUrl({ country_id: id || null }),
    setMany: (patch) => patchUrl(patch),
    clearAll,
    // Escape hatch for navigation call sites building a query object to hand
    // directly to router.push toward a DIFFERENT page (e.g. Category.jsx
    // navigating from /categories/[slug] to /products) — no "current query"
    // to merge against, just serialize the patch alone.
    buildQueryPatch: (patch) => serializeFilterPatch({}, patch),
  };
}
