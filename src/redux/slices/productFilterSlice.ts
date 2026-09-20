import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Product-listing FILTER VALUES (search/brand/category/price/sort/attributes/
// seller/country) live in the URL now — see src/hooks/useUrlProductFilters.js
// and src/utils/urlProductFilters.js — NOT in this slice. What remains here is
// non-filter state: presentation (grid_view), category-browse bookkeeping
// (selectedCategories/searchedCategory/listing_source/category_slug/
// categoryBreadcrumb), cached API payloads (section_products/search_product),
// and the homepage "See All" block-source flow (data_source/
// manual_product_ids/block_source_id).
//
// Exported so SSR consumers can render with the exact values the server has.
// Every field here is persisted (redux-persist, key "root"), i.e. empty on the
// server and populated on the client before first paint. Components that put
// this state in a React Query key must use THIS object until hydrated, or the
// server and first client render key the query differently and the SSR markup
// is thrown away. Importing it (rather than re-declaring a copy) is what keeps
// the two from drifting apart.
export interface ProductFilterState {
  section_id: any | null;
  grid_view: boolean;
  section_products: any | null;
  search_sizes: any[];
  search_product: any[];
  selectedCategories: any[];
  searchedCategory: string;
  listing_source: string;
  category_slug: string;
  categoryBreadcrumb: any[];
  data_source: string;
  manual_product_ids: string;
  block_source_id: string;
}

export const initialState: ProductFilterState = {
  section_id: null,
  grid_view: true,
  section_products: null,
  search_sizes: [],
  search_product: [],
  selectedCategories: [],
  searchedCategory: "",
  listing_source: "all",
  category_slug: "",
  categoryBreadcrumb: [],
  // Home-layout "See All": the block's data_source ("manual", "category",
  // "brand", "most_favorite", ...). manual_product_ids is a CSV sent ONLY when
  // manual. block_source_id is the single id that travels with the block — the
  // category_id for "category", the brand_id for "brand", etc.; at request time
  // it's sent under the param name the source dictates. Kept separate from the
  // normal category_id / brand_ids filter state so category-flow and brand
  // filtering stay untouched.
  data_source: "",
  manual_product_ids: "",
  block_source_id: "",
};

export const productFilterReducer = createSlice({
  name: "productFilter",
  initialState,
  reducers: {
    setFilterSection: (state, action: PayloadAction<{ data: any }>) => {
      state.section_id = action.payload.data;
    },
    setFilterView: (state, action: PayloadAction<{ data: boolean }>) => {
      state.grid_view = action.payload.data;
    },
    setFilterProducts: (state, action: PayloadAction<{ data: any }>) => {
      state.section_products = action.payload.data;
    },
    setFilterProductSizes: (state, action: PayloadAction<{ data: any[] }>) => {
      state.search_sizes = action.payload.data;
    },
    setProductBySearch: (state, action: PayloadAction<{ data: any[] }>) => {
      state.search_product = action.payload.data;
    },
    // Resets the non-filter (redux-owned) state a "start fresh" action should
    // clear. Filter VALUES live in the URL — callers must also call the
    // useUrlProductFilters() hook's clearAll() alongside this action.
    clearAllFilter: (state, action: PayloadAction<{ preserveCategory?: boolean } | undefined>) => {
      const { preserveCategory } = action.payload || {};
      state.section_id = null;
      state.search_product = [];
      state.selectedCategories = [];
      state.searchedCategory = "";
      if (!preserveCategory) {
        state.category_slug = "";
        state.categoryBreadcrumb = [];
        state.listing_source = "all";
        state.data_source = "";
        state.manual_product_ids = "";
        state.block_source_id = "";
      }
    },
    setSelectedCategories: (state, action: PayloadAction<{ data: any }>) => {
      state.selectedCategories = [
        ...state.selectedCategories,
        action.payload.data,
      ];
    },
    setSearchedCategory: (state, action: PayloadAction<{ data: string }>) => {
      state.searchedCategory = action.payload.data;
    },
    setListingSource: (state, action: PayloadAction<{ data: string }>) => {
      state.listing_source = action.payload.data;
    },
    setCategorySlug: (state, action: PayloadAction<{ data: string }>) => {
      state.category_slug = action.payload.data;
    },
    setCategoryBreadcrumb: (state, action: PayloadAction<{ data: any[] }>) => {
      state.categoryBreadcrumb = action.payload.data;
    },
    // Home-layout "See All". Always sets data_source. manual_product_ids kept
    // only for "manual". block_source_id is the source's own id (category_id
    // for "category", brand_id for "brand", …) — stored for any source that
    // carries one; blanked for sources with no id (e.g. most_favorite).
    setBlockSource: (
      state,
      action: PayloadAction<{ data_source?: string; manual_product_ids?: string; source_id?: string } | undefined>
    ) => {
      const {
        data_source = "",
        manual_product_ids = "",
        source_id = "",
      } = action.payload || {};
      state.data_source = data_source;
      state.manual_product_ids =
        data_source === "manual" ? manual_product_ids : "";
      state.block_source_id = data_source === "manual" ? "" : source_id;
    },
  },
});

export const {
  setFilterProducts,
  setFilterSection,
  setFilterView,
  setFilterProductSizes,
  clearAllFilter,
  setProductBySearch,
  setSelectedCategories,
  setSearchedCategory,
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
  setBlockSource,
} = productFilterReducer.actions;

export default productFilterReducer.reducer;
