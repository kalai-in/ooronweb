// Product-listing filter values live ONLY in the URL query string (no redux).
// These pure helpers are the single place that knows the param names/shapes,
// shared between the client hook (useUrlProductFilters) and the server loader
// (src/app/products/page.tsx) so server and client can never drift.

// URL param name for each filter field.
export const FILTER_PARAMS = {
  search: "q",
  brand_ids: "brand",
  category_id: "category",
  sort_filter: "sort",
  attribute_value_ids: "attr",
  seller_id: "seller",
  country_id: "country",
};

// All query keys this module owns — used to strip stale values before writing
// a fresh patch, and to detect "any filter param present" for SSR/initialData.
export const OWNED_QUERY_KEYS = [
  "q",
  "brand",
  "category",
  "price_min",
  "price_max",
  "sort",
  "attr",
  "seller",
  "country",
];

// router.query (client) / context.query (server) values — plain objects of
// string | string[] | undefined.
type QueryValue = string | string[] | undefined;
type QueryObject = Record<string, QueryValue>;

const toStr = (v: QueryValue): string | undefined => (Array.isArray(v) ? v[0] : v);

const parseCsvInts = (v: QueryValue): number[] => {
  const s = toStr(v);
  if (!s) return [];
  return String(s)
    .split(",")
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
};

export interface PriceFilter {
  min_price: number;
  max_price: number;
}

export interface ParsedProductFilter {
  search: string | null;
  brand_ids: number[];
  category_id: string | null;
  price_filter: PriceFilter | null;
  sort_filter: string;
  attribute_value_ids: number[];
  seller_id: string;
  country_id: string;
}

// query: router.query (client) or context.query (server) — both are plain
// objects of string | string[] | undefined.
export function parseFilterFromQuery(query: QueryObject = {}): ParsedProductFilter {
  const search = toStr(query.q) || null;
  const brand_ids = parseCsvInts(query.brand);
  const category_id = toStr(query.category) || null;
  const sort_filter = toStr(query.sort) || "";
  const attribute_value_ids = parseCsvInts(query.attr);
  const seller_id = toStr(query.seller) || "";
  const country_id = toStr(query.country) || "";

  const minRaw = toStr(query.price_min);
  const maxRaw = toStr(query.price_max);
  const min = minRaw != null ? Number(minRaw) : NaN;
  const max = maxRaw != null ? Number(maxRaw) : NaN;
  const price_filter =
    !Number.isNaN(min) && !Number.isNaN(max)
      ? { min_price: min, max_price: max }
      : null;

  return {
    search,
    brand_ids,
    category_id,
    price_filter,
    sort_filter,
    attribute_value_ids,
    seller_id,
    country_id,
  };
}

// True when the URL carries no filter query params at all — used to gate SSR
// initialData reuse and the "unfiltered default view" checks.
export function hasNoFilterParams(query: QueryObject = {}): boolean {
  return !OWNED_QUERY_KEYS.some((k) => query[k] != null && query[k] !== "");
}

// Merge a partial filter patch into the current query object. A key set to
// null/undefined/""/[] is removed; every other owned key not mentioned in the
// patch is left untouched. Non-owned keys (zone, lang, slug, ...) always pass
// through unmodified.
export interface ProductFilterPatch {
  search?: string | null;
  brand_ids?: (number | string)[] | null;
  category_id?: string | number | null;
  sort_filter?: string | null;
  attribute_value_ids?: (number | string)[] | null;
  seller_id?: string | number | null;
  country_id?: string | number | null;
  price_filter?: { min_price: number | string; max_price: number | string } | null;
}

export function serializeFilterPatch(
  currentQuery: Record<string, any> = {},
  patch: ProductFilterPatch = {},
): Record<string, any> {
  const next: Record<string, any> = { ...currentQuery };

  const setOrDelete = (key: string, value: any): void => {
    if (value == null || value === "") {
      delete next[key];
    } else {
      next[key] = String(value);
    }
  };

  if ("search" in patch) setOrDelete(FILTER_PARAMS.search, patch.search);
  if ("brand_ids" in patch) {
    const v = patch.brand_ids;
    setOrDelete(FILTER_PARAMS.brand_ids, v?.length ? v.join(",") : null);
  }
  if ("category_id" in patch) {
    setOrDelete(FILTER_PARAMS.category_id, patch.category_id);
  }
  if ("sort_filter" in patch) {
    const v = patch.sort_filter;
    setOrDelete(FILTER_PARAMS.sort_filter, v && v !== "default" ? v : null);
  }
  if ("attribute_value_ids" in patch) {
    const v = patch.attribute_value_ids;
    setOrDelete(
      FILTER_PARAMS.attribute_value_ids,
      v?.length ? v.join(",") : null,
    );
  }
  if ("seller_id" in patch) setOrDelete(FILTER_PARAMS.seller_id, patch.seller_id);
  if ("country_id" in patch)
    setOrDelete(FILTER_PARAMS.country_id, patch.country_id);
  if ("price_filter" in patch) {
    const v = patch.price_filter;
    if (v == null || v.min_price == null || v.max_price == null) {
      delete next.price_min;
      delete next.price_max;
    } else {
      next.price_min = String(v.min_price);
      next.price_max = String(v.max_price);
    }
  }

  return next;
}

// Query object with every owned filter key removed (zone/lang/slug/etc kept).
// `preserveCategory` keeps `category` (Clear All's preserveCategory option).
export function clearFilterQuery(
  currentQuery: Record<string, any> = {},
  { preserveCategory = false }: { preserveCategory?: boolean } = {},
): Record<string, any> {
  const next: Record<string, any> = { ...currentQuery };
  for (const key of OWNED_QUERY_KEYS) {
    if (preserveCategory && key === "category") continue;
    delete next[key];
  }
  return next;
}

// Builds the exact filter param bag the /products listing API expects, from a
// parsed filter object. Shared by the client (ProductsList.fetchProducts) and
// the server (getServerSideProps → getProductListingServer) so they can never
// drift out of sync with each other.
export function buildFilterApiParams(
  filter: any,
  { search }: { search?: string } = {},
): Record<string, any> {
  const params: Record<string, any> = {
    min_price: filter?.price_filter?.min_price,
    max_price: filter?.price_filter?.max_price,
    ...(filter?.category_id && { category_id: filter.category_id }),
    brand_ids: (filter?.brand_ids ?? []).join(","),
    ...(filter?.attribute_value_ids?.length > 0 && {
      attribute_value_ids: filter.attribute_value_ids.join(","),
    }),
    sort: filter?.sort_filter,
    search: search !== undefined ? search : filter?.search,
    seller_id: filter?.seller_id,
    country_id: filter?.country_id,
  };
  return params;
}
