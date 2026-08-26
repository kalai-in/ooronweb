import { useQuery, keepPreviousData } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";

/**
 * @typedef {Object} FilterAttributeValue
 * @property {number} id
 * @property {string} value
 *
 * @typedef {Object} FilterAttribute
 * @property {number} id
 * @property {string} name
 * @property {FilterAttributeValue[]} values
 *
 * @typedef {Object} FilterBrand
 * @property {number} id
 * @property {string} name
 *
 * @typedef {Object} ProductFiltersData
 * @property {{ id: number, name: string }} [category]
 * @property {Array<{ id: number, name: string }>} [child_categories]
 * @property {FilterBrand[]} [brands]
 * @property {FilterAttribute[]} [attributes]
 * @property {number} [min_price]
 * @property {number} [max_price]
 */

/**
 * Fetch category-aware filter options (brands, price range, attributes) from
 * POST /customer/products/filters. Refetches automatically whenever the
 * category, location, or language changes — React Query keys on all of them.
 *
 * No hardcoded filter values: everything rendered comes from the response.
 *
 * @param {Object} params
 * @param {string|number|null} [params.categoryId] Active category id. null/""/"NaN"/"all categories" → treated as "no category" (global filters).
 * @param {number|string} [params.latitude]
 * @param {number|string} [params.longitude]
 * @param {string|number} [params.languageId] Re-fetch when UI language changes (localized names).
 * @returns {{
 *   filters: ProductFiltersData | null,
 *   isLoading: boolean,
 *   isError: boolean,
 *   error: unknown,
 *   refetch: () => void,
 * }}
 */
export const useProductFilters = ({
  categoryId,
  latitude,
  longitude,
  languageId,
  dataSource,
  manualProductIds,
  sourceId,
}) => {
  // Normalize the assorted "no real category" sentinels the app uses into a
  // single null so the query key + payload stay clean.
  const activeCategoryId =
    categoryId != null &&
    categoryId !== "" &&
    categoryId !== "NaN" &&
    categoryId !== "all categories"
      ? categoryId
      : null;

  const query = useQuery({
    queryKey: [
      "product-filters",
      activeCategoryId,
      latitude,
      longitude,
      languageId,
      dataSource,
      manualProductIds,
      sourceId,
    ],
    queryFn: async () => {
      const res = await api.getProductFilters({
        latitude,
        longitude,
        category_id: activeCategoryId,
        data_source: dataSource,
        manual_product_ids: manualProductIds,
        source_id: sourceId,
      });
      // API may wrap payload in { data } or return it flat.
      return res?.data ?? res ?? null;
    },
    // Fire only once we have a location. category_id is optional — the
    // all-products page sends none, a category page sends the active id.
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
  });

  return {
    filters: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useProductFilters;
