import axios from "axios";
import * as apiEndPoints from "@/api/apiEndpoints";
import { HOME_LAYOUT_INITIAL_SECTION_LIMIT } from "@/constants/homeLayout";

// Server-only API calls for getServerSideProps.
//
// The shared `api` instance in axiosMiddleware.js reads the Redux store as a
// module-level singleton to build its auth/language/channel headers. Under SSR
// that store is (a) never rehydrated, so those headers would be empty, and
// (b) shared across every concurrent request in the Node process, so one user's
// JWT could be attached to another user's fetch. Neither is acceptable on the
// server, so these helpers take every input explicitly and hold no state.
//
// Client code must keep using api.* from axiosMiddleware.js — not this file.

const ACCESS_KEY = "903361";
const BASE = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;

const serverHeaders = ({
  lang,
  channel,
}: {
  lang?: string;
  channel?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = { "x-access-key": ACCESS_KEY };
  if (lang) headers["Content-Language"] = lang;
  if (channel) headers.channel = channel;
  return headers;
};

/**
 * Fetch a product for server rendering. Mirrors api.getProductById() — same
 * endpoint, same FormData shape — but with headers passed in rather than read
 * from the store.
 *
 * Anonymous by design: no Authorization header. gSSP renders the crawler/
 * logged-out view; user-specific state (wishlist, cart) hydrates client-side.
 */
export const getProductByIdServer = async ({
  slug,
  latitude,
  longitude,
  lang,
  channel,
}: {
  slug?: string;
  latitude?: number | string;
  longitude?: number | string;
  lang?: string;
  channel?: string;
}): Promise<any> => {
  const formData = new FormData();
  formData.append("latitude", latitude as any);
  formData.append("longitude", longitude as any);
  if (slug) formData.append("slug", slug);

  const response = await axios.post(
    `${BASE}/${apiEndPoints.getProductById}`,
    formData,
    { headers: serverHeaders({ lang, channel }) },
  );
  return response.data;
};

/**
 * Product list for a location, server-side. Used by the zone-aware sitemap to
 * enumerate each zone's own catalogue — listing is per-store, so this genuinely
 * differs per zone rather than repeating one list.
 */
export const getProductsServer = async ({
  latitude,
  longitude,
  channel,
  lang,
  limit = 100,
  offset = 0,
}: {
  latitude?: number | string;
  longitude?: number | string;
  channel?: string;
  lang?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> => {
  const formData = new FormData();
  formData.append("latitude", latitude as any);
  formData.append("longitude", longitude as any);
  formData.append("limit", String(limit));
  formData.append("offset", String(offset));

  const response = await axios.post(
    `${BASE}/${apiEndPoints.getProducts}`,
    formData,
    { headers: serverHeaders({ lang, channel }) },
  );
  return response.data?.data || [];
};

/**
 * One page of the product LISTING, server-side, for /products.
 *
 * Separate from getProductsServer above, which returns only `data` — the listing
 * needs the WHOLE envelope: `total` drives the "N Products Found" count and
 * React Query's getNextPageParam, and dropping it would break both.
 *
 * The response is seeded verbatim into useInfiniteQuery as
 * `{ pages: [envelope], pageParams: [offset] }`, so the shape here must match
 * exactly what the client's queryFn returns (api.getProductByFilter → the raw
 * envelope). Any divergence and the client refetches the page it can already
 * see.
 *
 * Pagination is OFFSET-based (offset 0, 12, 24 …), not page-numbered — mirroring
 * the client's `initialPageParam: 0` and `allPages.length * limit`.
 *
 * Coordinates are REQUIRED by the API: without them it answers status 0 with no
 * rows, so callers must skip this when the URL resolved no location rather than
 * invent coordinates (which would render another zone's catalogue).
 *
 * The `channel` header is equally REQUIRED — the API rejects the request outright
 * with {"status":0,"message":"Channel header is required and must be 'quick' or
 * 'ecommerce'."} when it is absent. That reads exactly like an empty catalogue at
 * the call site, so default it here rather than letting a caller that forgets it
 * silently server-render zero products. "quick" matches the client's own
 * SHOP_MODE_SSR_DEFAULT, so the seeded page is the one the visitor would fetch.
 */
export const getProductListingServer = async ({
  latitude,
  longitude,
  channel,
  lang,
  limit = 12,
  offset = 0,
  filters = undefined,
}: {
  latitude?: number | string;
  longitude?: number | string;
  channel?: string;
  lang?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}): Promise<any> => {
  const formData = new FormData();
  formData.append("latitude", latitude as any);
  formData.append("longitude", longitude as any);
  formData.append("limit", String(limit));
  formData.append("offset", String(offset));
  // Optional filter param bag (see buildFilterApiParams in
  // src/utils/urlProductFilters.js) — mirrors the client's
  // api.getProductByFilter() FormData shape so a filtered URL server-renders
  // the correct results instead of always seeding unfiltered page 1.
  if (filters) {
    for (const key in filters) {
      const v = filters[key];
      if (v !== null && v !== undefined && v !== "") {
        formData.append(key, v as any);
      }
    }
  }

  const response = await axios.post(
    `${BASE}/${apiEndPoints.getProducts}`,
    formData,
    { headers: serverHeaders({ lang, channel: channel || "quick" }) },
  );
  return response.data;
};

/**
 * Home layout for a location, server-side. Mirrors api.getHomeLayout() — same
 * endpoint, same GET params — but with headers passed in rather than read from
 * the store.
 *
 * Coordinates must come from a zone the URL actually resolved. There is no
 * default location in this app: without a zone the server cannot know where the
 * visitor is, and inventing coords would render another zone's catalogue. Callers
 * must skip this and let the client fetch instead.
 *
 * Returns the raw envelope (status/message/data) so callers can tell a closed
 * store (status 0) from a live one, matching the client's queryFn.
 */
// device is NOT sent — see getHomeLayout()'s comment; the response already
// carries every breakpoint, picked client-side at render time.
export const getHomeLayoutServer = async ({
  latitude,
  longitude,
  categoryId = null,
  lang,
  channel,
  device,
}: {
  latitude?: number | string;
  longitude?: number | string;
  categoryId?: number | string | null;
  lang?: string;
  channel?: string;
  device?: string;
}): Promise<any> => {
  const params: {
    latitude?: number | string;
    longitude?: number | string;
    category_id?: number | string;
    limit?: number;
    offset?: number;
    device?: string;
  } = { latitude, longitude, limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT, offset: 0 };
  // Omitted when null/empty: the backend then serves the first category tab's
  // layout — the same one the client ends up showing. See getHomeLayout().
  if (categoryId != null && categoryId !== "") {
    params.category_id = categoryId;
  }
  if (device != null && device !== "") {
    params.device = device;
  }
  const response = await axios.get(`${BASE}/${apiEndPoints.homeLayout}`, {
    params,
    // Required by the API exactly as in getProductListingServer — a missing
    // channel is rejected outright and reads like an empty layout at the call
    // site. "quick" matches the client's default shop mode.
    headers: serverHeaders({ lang, channel: channel || "quick" }),
  });
  return response.data;
};

/**
 * Web settings, server-side. Used to read default_city coordinates, which are
 * the SSR pilot's stand-in for a zone-derived location until zone-prefixed
 * routes exist.
 */
export const getSettingServer = async ({
  lang,
}: { lang?: string } = {}): Promise<any> => {
  const response = await axios.get(`${BASE}/${apiEndPoints.getSettings}`, {
    params: { is_web_setting: 1 },
    headers: serverHeaders({ lang }),
  });
  return response.data;
};

// Module-level, per-Node-process cache — a deliberate, narrow exception to
// this file's "hold no state" rule above. That rule exists to stop
// user-specific data (JWTs, redux state) leaking across concurrent requests;
// a category tree carries no user data and is identical for every visitor at
// a given location/language, so caching it is safe and avoids re-fetching the
// full ~150-node tree on every single SSR request for a filtered category
// URL (gSSP has no cross-request cache of its own — each request is a fresh
// Node invocation). Keyed on lang+channel (coordinates don't change the tree,
// only the listing does), short TTL so category edits in admin still show up
// within a few minutes rather than requiring a deploy.
const CATEGORY_TREE_CACHE_TTL_MS = 5 * 60 * 1000;
const categoryTreeCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * One page of a category's own children, server-side, for /categories/[slug].
 * Mirrors api.getCategories({slug, limit, offset, latitude, longitude}) — same
 * endpoint, same params — but with headers/coords passed in rather than read
 * from the store. Zone-specific (latitude/longitude required by the API), so
 * this is NOT cached across requests, unlike getCategoriesTreeServer below.
 */
export const getCategoryChildrenServer = async ({
  slug,
  latitude,
  longitude,
  lang,
  channel,
  limit = 12,
  offset = 0,
}: {
  slug?: string;
  latitude?: number | string;
  longitude?: number | string;
  lang?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}): Promise<any> => {
  const params: Record<string, any> = { limit, offset };
  if (slug) params.slug = slug;
  if (latitude != null) params.latitude = latitude;
  if (longitude != null) params.longitude = longitude;

  const response = await axios.get(`${BASE}/${apiEndPoints.getCategory}`, {
    params,
    headers: serverHeaders({ lang, channel: channel || "quick" }),
  });
  return response.data;
};

/**
 * Full category tree, server-side. Mirrors api.getCategories() with no
 * slug/id param (returns every top-level category with nested
 * cat_active_childs) — used to resolve category slugs in the URL back to the
 * numeric leaf ids the products API needs. See
 * src/utils/categorySlugResolver.js for the resolution logic itself.
 */
export const getCategoriesTreeServer = async ({
  latitude,
  longitude,
  lang,
  channel,
}: {
  latitude?: number | string;
  longitude?: number | string;
  lang?: string;
  channel?: string;
}): Promise<any> => {
  const cacheKey = `${lang || ""}|${channel || ""}`;
  const cached = categoryTreeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const response = await axios.get(`${BASE}/${apiEndPoints.getCategory}`, {
    params: { latitude, longitude },
    headers: serverHeaders({ lang, channel: channel || "quick" }),
  });
  categoryTreeCache.set(cacheKey, {
    data: response.data,
    expiresAt: Date.now() + CATEGORY_TREE_CACHE_TTL_MS,
  });
  return response.data;
};
