import { useQuery, keepPreviousData } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";

export interface FilterAttributeValue {
  id: number;
  value: string;
}

export interface FilterAttribute {
  id: number;
  name: string;
  values: FilterAttributeValue[];
}

export interface FilterBrand {
  id: number;
  name: string;
}

export interface ProductFiltersData {
  category?: { id: number; name: string };
  child_categories?: Array<{ id: number; name: string }>;
  brands?: FilterBrand[];
  attributes?: FilterAttribute[];
  min_price?: number;
  max_price?: number;
}

export interface UseProductFiltersParams {
  /** Active category id. null/""/"NaN"/"all categories" → treated as "no category" (global filters). */
  categoryId?: string | number | null;
  latitude?: number | string;
  longitude?: number | string;
  /** Re-fetch when UI language changes (localized names). */
  languageId?: string | number;
  dataSource?: string;
  manualProductIds?: any;
  sourceId?: string | number;
}

export interface UseProductFiltersResult {
  filters: ProductFiltersData | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Fetch category-aware filter options (brands, price range, attributes) from
 * POST /customer/products/filters. Refetches automatically whenever the
 * category, location, or language changes — React Query keys on all of them.
 *
 * No hardcoded filter values: everything rendered comes from the response.
 */
export const useProductFilters = ({
  categoryId,
  latitude,
  longitude,
  languageId,
  dataSource,
  manualProductIds,
  sourceId,
}: UseProductFiltersParams): UseProductFiltersResult => {
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
