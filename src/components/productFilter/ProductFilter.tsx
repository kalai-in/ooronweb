"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { clearAllFilter, setBlockSource } from "@/redux/slices/productFilterSlice";
import * as api from "@/api/apiRoutes";
import { useProductFilters } from "@/hooks/useProductFilters";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";
import { resolveSlugCsvToIdCsv } from "@/utils/categorySlugResolver";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import CategoryTree from "./CategoryTree";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FaChevronDown } from "react-icons/fa";
import { Checkbox } from "@/components/ui/checkbox";
import dynamic from "next/dynamic";
// import { resetSelectedCategories } from "@/redux/slices/productFilterSlice";
const PriceSlider = dynamic(() => import("./PriceSlider"), { ssr: false });
import FilterSkeleton from "./FilterSkeleton";
import BrandSearchModal from "./BrandSearchModal";

export interface ProductFilterProps {
  /** Raw API product rows. */
  setProductResult: (products: any[]) => void;
  setOffset: (offset: number) => void;
  minPrice: number | null | undefined;
  maxPrice: number | null | undefined;
  values: number[];
  setValues: (values: number[]) => void;
  setMinPrice: (value: number) => void;
  setMaxPrice: (value: number) => void;
  setShowFilter?: (show: boolean) => void;
  /**
   * PRE-EXISTING BUG (reported, not fixed): FilterDrawer passes this prop
   * intending to hide the category picker section (see the comment near
   * `isFilterApplied` above), but this component never actually destructures
   * or reads it — the category picker always renders regardless. Accepted
   * here only so the prop type-checks; behavior is unchanged.
   */
  hideCategory?: boolean;
}

const Filter = ({
  setProductResult,
  setOffset,
  minPrice,
  maxPrice,
  values,
  setValues,
  setMinPrice,
  setMaxPrice,
  setShowFilter = () => {},
}: ProductFilterProps) => {
  const {
    filter: urlFilter,
    setMany,
    clearAll: clearUrlFilters,
  } = useUrlProductFilters();
  // data_source/manual_product_ids/block_source_id (homepage "See All" block
  // flow) stay in redux — merged in so every existing `filter?.x` read below
  // keeps working unchanged.
  const { data_source, manual_product_ids, block_source_id } = useSelector(
    (state: any) => ({
      data_source: state.ProductFilter.data_source,
      manual_product_ids: state.ProductFilter.manual_product_ids,
      block_source_id: state.ProductFilter.block_source_id,
    }),
    shallowEqual,
  );
  // Memoized: a new object literal every render would break every downstream
  // useEffect/useMemo keyed on `filter` by reference (e.g. CategoryTree's own
  // initialFilter effect) — those would refire every render regardless of
  // whether the actual values changed, which for CategoryTree meant calling
  // onCategoryChange -> setMany -> router.replace on every single render,
  // an infinite "Maximum update depth exceeded" loop.
  const filter = useMemo(
    () => ({ ...urlFilter, data_source, manual_product_ids, block_source_id }),
    [urlFilter, data_source, manual_product_ids, block_source_id],
  );
  // Clear All shows only when a real, user-applied filter is active.
  // "default"/empty sort and empty search are NOT filters.
  //
  // PRE-EXISTING BUG (reported, not fixed): `search_sizes` doesn't exist on the
  // URL filter shape (see parseFilterFromQuery in src/utils/urlProductFilters.ts)
  // — this condition is always false/undefined and never contributes to
  // isFilterApplied. Cast to `any` to preserve that exact (dead) behavior.
  const isFilterApplied =
    filter?.brand_ids?.length > 0 ||
    filter?.attribute_value_ids?.length > 0 ||
    filter?.price_filter != null ||
    (filter?.sort_filter && filter?.sort_filter !== "default") ||
    (filter as any)?.search_sizes?.some((s: any) => s.checked) ||
    (filter?.seller_id != null && filter?.seller_id !== "") ||
    (filter?.country_id != null && filter?.country_id !== "") ||
    (filter?.search != null && filter?.search !== "") ||
    // Count an active category as "applied" even when the category picker is hidden
    // (category listing pages). hideCategory hides the picker UI, not the filter state,
    // so Clear All must still appear to let the user reset it.
    (filter?.category_id != null &&
      filter?.category_id !== "" &&
      filter?.category_id !== "NaN" &&
      filter?.category_id !== "all categories");
  const city = useSelector((state: any) => state.City);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  const dispatch = useDispatch();
  // `city`/`language` are redux-persisted — empty on the server, populated
  // asynchronously after mount. Reading them unguarded here fed `enabled`
  // gates below (useFullCategoryTree, useProductFilters) that differ between
  // SSR (no city -> disabled -> real panel renders) and the first client
  // render once persist rehydrates (city present -> enabled -> query starts
  // "loading" -> panel swaps to FilterSkeleton) — a genuine hydration
  // mismatch, reproduced live (React discarded and regenerated the sidebar
  // client-side, which also broke click handlers on the now-stale nodes).
  const isHydrated = useIsHydrated();
  const hydratedLatitude = isHydrated ? city?.city?.latitude : undefined;
  const hydratedLongitude = isHydrated ? city?.city?.longitude : undefined;
  // filter.category_id is a SLUG csv (the URL's own format — see
  // categorySlugResolver.js). CategoryTree's selection math stays id-only
  // throughout, so resolve to numeric ids here, once, via the cached full
  // tree, and hand CategoryTree the resolved ids instead of the raw slugs.
  const { data: fullCategoryTree } = useFullCategoryTree({
    latitude: hydratedLatitude,
    longitude: hydratedLongitude,
    languageId: language?.id,
  });
  const resolvedCategoryIdCsv = filter?.category_id
    ? resolveSlugCsvToIdCsv(fullCategoryTree ?? [], filter.category_id)
    : "";
  // CategoryTree's init effect keys off this object BY REFERENCE (see its own
  // infinite-loop history) — memoize so it's only a new object when the
  // resolved id csv actually changes, not on every ProductFilter render.
  const categoryTreeInitialFilter = useMemo(
    () => ({ category_id: resolvedCategoryIdCsv }),
    [resolvedCategoryIdCsv],
  );
  const [selectedCategories, setSelectedCategories] = useState<(number | string)[]>([]);
  // All categories (nested tree via cat_active_childs) from the categories API —
  // a standalone Categories filter section (independent of the active category's
  // child_categories tree), so products can be narrowed by category anywhere.
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [totalCategories, setTotalCategories] = useState<number | null>(null);
  const [catOffset, setCatOffset] = useState(0);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const categoryLimit = 10;
  // Brands come exclusively from the category filters API response (no global
  // brand fetch / pagination) — a section only shows when the API returns it.
  const [brands, setbrands] = useState<any[] | null>(null);
  const brandLimit = 10;
  const [showBrandModal, setShowBrandModal] = useState(false);

  const [tempMinPrice, setTempMinPrice] = useState<number | null>(null);
  const [tempMaxPrice, setTempMaxPrice] = useState<number | null>(null);
  // Draft (staged) selections. Brand / attribute / price picks live here and are
  // NOT committed to redux — and therefore don't trigger a product refetch —
  // until the user presses "Apply Filters". Category picks stay live (they change
  // the listing context, not just a filter). Draft mirrors redux so it stays in
  // sync when redux changes externally (Clear All, category switch).
  const [draftBrandIds, setDraftBrandIds] = useState<number[]>(filter?.brand_ids ?? []);
  const [draftAttrIds, setDraftAttrIds] = useState<number[]>(
    filter?.attribute_value_ids ?? [],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs draft brand ids with redux filter
    setDraftBrandIds(filter?.brand_ids ?? []);
  }, [filter?.brand_ids]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs draft attribute ids with redux filter
    setDraftAttrIds(filter?.attribute_value_ids ?? []);
  }, [filter?.attribute_value_ids]);
  const [defaultMinPrice, setDefaultMinPrice] = useState<number | null | undefined>(minPrice);
  const [defaultMaxPrice, setDefaultMaxPrice] = useState<number | null | undefined>(maxPrice);
  // All groups start COLLAPSED. A group auto-opens only when it carries an
  // applied filter (see the effect below), so the panel opens compact and the
  // user can still expand anything by hand.
  const [activeKey, setActiveKey] = useState<string[]>([]);

  // Category-aware filter options: when a real category is active, ask the
  // backend which brands / price-range / attributes actually apply to it, so
  // the sidebar only offers relevant choices instead of the global list.
  // Fetching, caching, loading/error and refetch-on-change all live in the
  // reusable hook — refetches automatically when category/location/language
  // change (the hook keys its query on all of them).
  const {
    filters: categoryFilters,
    isLoading: loadingFilters,
    isError: filtersError,
  } = useProductFilters({
    // This endpoint needs the numeric id(s), same as the listing API —
    // filter.category_id is a slug csv from the URL, resolved above.
    categoryId: resolvedCategoryIdCsv,
    latitude: hydratedLatitude,
    longitude: hydratedLongitude,
    languageId: language?.id,
    dataSource: filter?.data_source,
    manualProductIds: filter?.manual_product_ids,
    sourceId: filter?.block_source_id,
  });

  // Brands are sourced solely from the category filters API response. Empty or
  // missing → brands stays empty → the brand section is not rendered.
  useEffect(() => {
    const catBrands = categoryFilters?.brands;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives brands list from the category filters API response
    setbrands(Array.isArray(catBrands) ? catBrands : []);
  }, [categoryFilters]);

  // Auto-open only the groups that actually carry an applied filter, so a user
  // returning to the panel sees their active selections without hunting, while
  // untouched groups stay collapsed.
  //
  // Merge-only (never removes a key): clearing a filter must not slam the group
  // shut while the user is still working in it, and a group the user opened by
  // hand has to stay open.
  useEffect(() => {
    const open: string[] = [];

    // Static groups.
    if (filter?.brand_ids?.length > 0) open.push("2");
    if (filter?.price_filter != null) open.push("4");
    const hasCategory =
      filter?.category_id != null &&
      filter?.category_id !== "" &&
      filter?.category_id !== "NaN" &&
      filter?.category_id !== "all categories";
    if (hasCategory) open.push("1", "cat");

    // Dynamic attribute groups: open the ones owning a selected value id.
    const selectedAttrIds = filter?.attribute_value_ids ?? [];
    if (selectedAttrIds.length > 0) {
      (categoryFilters?.attributes ?? []).forEach((a: any) => {
        const owns = (a?.values ?? []).some((v: any) =>
          selectedAttrIds.includes(Number.parseInt(v.id, 10)),
        );
        if (owns) open.push(`attr-${a.id}`);
      });
    }

    if (open.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-opens groups that carry an applied filter
    setActiveKey((prev) => {
      const missing = open.filter((k) => !prev.includes(k));
      return missing.length === 0 ? prev : [...prev, ...missing];
    });
  }, [
    categoryFilters,
    filter?.brand_ids,
    filter?.price_filter,
    filter?.category_id,
    filter?.attribute_value_ids,
  ]);

  // Seed the slider's *default bounds* from the category min/max (used by Clear
  // All to reset). Do NOT write the parent's minPrice/maxPrice here — the parent
  // owns those (derived from product data in handlePrices). Writing both created
  // a feedback loop (category min/max vs product min/max fighting each other →
  // "Maximum update depth exceeded").
  // categoryFilters is typed as ProductFiltersData (min_price/max_price only),
  // but the API has been observed sending price_min/price_max too — the `any`
  // cast here preserves that defensive fallback without widening the hook's
  // return type for every other caller.
  useEffect(() => {
    const min = categoryFilters?.min_price ?? (categoryFilters as any)?.price_min;
    const max = categoryFilters?.max_price ?? (categoryFilters as any)?.price_max;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds slider default bounds from category min/max
    if (min != null) setDefaultMinPrice(Number(min));
    if (max != null) setDefaultMaxPrice(Number(max));
  }, [categoryFilters]);

  // Slider bounds: prefer the category filters API range (catalog-wide, e.g.
  // 1250–26000) over the parent's minPrice/maxPrice (derived from the visible
  // product page, which caps the max at whatever's loaded e.g. 1350). Fall back
  // to the parent values when the API omits a range. Read-only here — we don't
  // write parent state, so no min/max feedback loop.
  const catMin = categoryFilters?.min_price ?? (categoryFilters as any)?.price_min;
  const catMax = categoryFilters?.max_price ?? (categoryFilters as any)?.price_max;
  const sliderMinPrice = catMin != null ? Number(catMin) : minPrice;
  const sliderMaxPrice = catMax != null ? Number(catMax) : maxPrice;

  const handleActiveKey = (key: string) => {
    setActiveKey((prevActiveKeys) =>
      prevActiveKeys.includes(key)
        ? prevActiveKeys.filter((item) => item !== key)
        : [...prevActiveKeys, key],
    );
  };

  // Categories for the Categories filter section. Paginated (limit/offset) so a
  // large catalog loads incrementally via "Load More". Each row nests its own
  // cat_active_childs, rendered as an expandable tree by CategoryTree.
  //
  // categoriesFetchKeyRef remembers the key of the last request that was
  // started OR completed for offset 0 — not just "in flight". language?.id
  // and city?.city?.lat/lng resolve via two independent async chains
  // (Layout.jsx's fetchLanguage vs Header.jsx's fetchCity), so the effect
  // below can legitimately re-fire more than once while landing on the SAME
  // final key (e.g. language resolves before city, re-firing the effect with
  // city still unset — same key as the very first call). A ref that only
  // blocked overlapping in-flight calls let that second, later firing through
  // as a genuine duplicate network request once the first had already
  // completed and cleared the guard.
  const categoriesFetchKeyRef = useRef<string | null>(null);
  const fetchCategories = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- compiler infers `city` object as the dep instead of the narrower lat/lng fields; deps intentionally scoped to the primitives actually read
    async (offsetVal: number = 0, append: boolean = false) => {
      const key = `${offsetVal}:${language?.id}:${city?.city?.latitude}:${city?.city?.longitude}`;
      if (!append && categoriesFetchKeyRef.current === key) return;
      categoriesFetchKeyRef.current = key;
      setLoadingCategories(true);
      try {
        const res = await api.getCategories({
          limit: categoryLimit,
          offset: offsetVal,
          latitude: city?.city?.latitude,
          longitude: city?.city?.longitude,
        });
        if (res?.status == 1 && Array.isArray(res?.data)) {
          setAllCategories((prev) =>
            append ? [...prev, ...res.data] : res.data,
          );
          setTotalCategories(res?.total ?? res.data.length);
        }
      } catch (error) {
        console.log("[filter] getCategories failed", error);
        // A failed request must not permanently block retries for this key.
        if (categoriesFetchKeyRef.current === key) {
          categoriesFetchKeyRef.current = null;
        }
      } finally {
        setLoadingCategories(false);
      }
    },
    [language?.id, city?.city?.latitude, city?.city?.longitude],
  );

  // Initial load + reload on language / location change (getCategories now needs
  // latitude/longitude; refetch once the location resolves so the list isn't
  // stuck empty / erroring on the first render before a city exists).
  //
  // Debounced: language?.id and city coords each resolve through several
  // intermediate values on page load (two independent async chains — see
  // Layout.jsx's fetchLanguage vs Header.jsx's fetchCity), so this effect can
  // fire many times in quick succession before either has settled. Waiting
  // for a short quiet period collapses that whole settle sequence into one
  // fetch instead of one per intermediate value.
  useEffect(() => {
    const id = setTimeout(() => {
      setCatOffset(0);
      fetchCategories(0, false);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language?.id, city?.city?.latitude, city?.city?.longitude]);

  const loadMoreCategories = () => {
    const next = catOffset + categoryLimit;
    setCatOffset(next);
    fetchCategories(next, true);
  };

  // const fetchCategories = async () => {
  //   setLoadingCategories(true);
  //   try {
  //     const categories = await api.getCategories();
  //     setCategories(categories.data);
  //   } catch (error) {
  //     console.log("erorr", error);
  //   } finally {
  //     setLoadingCategories(false);
  //   }
  // };

  // CategoryTree keeps its own selection math id-only (ids drive tri-state
  // checkboxes); `slugs` is the parallel slug list for the SAME nodes, used
  // to write the URL (which is slug-typed — see categorySlugResolver.js).
  const handleCategoryChange = (categories: (number | string)[], slugs: string[]) => {
    const nextCategoryId = (slugs ?? []).join(",");
    // CategoryTree's init effect calls this on every `initialFilter` change,
    // not only on a real user click. Bail when the category is unchanged so we
    // don't re-dispatch (which would mutate `filter`, retrigger that effect,
    // and loop → "Maximum update depth exceeded").
    if (String(filter?.category_id ?? "") === nextCategoryId) {
      setSelectedCategories(categories);
      return;
    }
    setSelectedCategories(categories);
    // NOTE: Comment below line due to empty state issue in product page on refresh
    // setProductResult([]); // Reset products
    setOffset(0); // Reset offset
    // Category actually changed — reset previously-selected attribute values:
    // they belong to the old category and would leak into the new query. One
    // batched URL write instead of two, so the query-derived `filter` object
    // (and every effect keyed on it) only re-renders once.
    setMany({ attribute_value_ids: [], category_id: nextCategoryId });
    // A homepage "See All" block click-through leaves data_source/
    // block_source_id set in redux (see productFilterSlice.js), and
    // ProductsList.jsx's fetch params give block_source_id's category_id
    // priority over this URL-driven one whenever data_source === "category" —
    // so without this, picking a DIFFERENT category from the sidebar after
    // arriving via a block updated the URL/UI correctly but the actual
    // product request kept silently querying the stale block category. A
    // real sidebar pick means the user wants a plain category-id query now.
    dispatch(setBlockSource());
  };

  // Toggle a single attribute value id in the DRAFT (not redux). Dynamic — works
  // for any attribute (Color/Size/Fabric/…) the API returns. Committed on Apply.
  const toggleAttributeValue = (valueId: number | string) => {
    const id = Number.parseInt(String(valueId), 10);
    setDraftAttrIds((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  };

  const filterbyBrands = (brand: any) => {
    setDraftBrandIds((current) => {
      const next = [...current];
      if (next.includes(brand.id)) {
        next.splice(next.indexOf(brand.id), 1);
      } else {
        next.push(Number.parseInt(brand.id));
      }
      return sort_unique_brand_ids(next);
    });
  };

  // No "Apply" button: each filter change auto-commits to redux (which is in the
  // products query key → triggers the refetch), DEBOUNCED so rapid checkbox
  // clicks / slider drags collapse into one commit instead of a request per tick.
  const skipFirstCommit = useRef(true);
  useEffect(() => {
    // Don't fire on mount: draft mirrors redux here, so committing would refetch
    // for no change (and fight the sync effects above).
    if (skipFirstCommit.current) {
      skipFirstCommit.current = false;
      return;
    }
    const id = setTimeout(() => {
      // Only commit what actually changed vs redux — dispatching identical values
      // would still create new state refs, re-run the draft-sync effects, and loop.
      const sameIds = (a: number[] = [], b: number[] = []) =>
        a.length === b.length && a.every((v, i) => v === b[i]);
      const brandsChanged = !sameIds(draftBrandIds, filter?.brand_ids ?? []);
      const attrsChanged = !sameIds(
        draftAttrIds,
        filter?.attribute_value_ids ?? [],
      );
      const nextMin = tempMinPrice ?? values[0];
      const nextMax = tempMaxPrice ?? values[1];
      const priceChanged =
        tempMinPrice != null &&
        tempMaxPrice != null &&
        (nextMin !== filter?.price_filter?.min_price ||
          nextMax !== filter?.price_filter?.max_price);

      if (!brandsChanged && !attrsChanged && !priceChanged) return;

      setOffset(0);
      setProductResult([]);
      // One batched URL write instead of up to 3 separate ones — avoids 3
      // history-adjacent replaces and 3 re-renders of the query-derived filter.
      const patch: Record<string, any> = {};
      if (brandsChanged) patch.brand_ids = draftBrandIds;
      if (attrsChanged) patch.attribute_value_ids = draftAttrIds;
      if (priceChanged)
        patch.price_filter = { min_price: nextMin, max_price: nextMax };
      setMany(patch);
    }, 500);
    return () => clearTimeout(id);
    // Commit whenever a staged selection changes. `values` (slider thumbs) is
    // excluded — tempMin/MaxPrice already track committed price edits, and
    // watching values would refire on every drag frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftBrandIds, draftAttrIds, tempMinPrice, tempMaxPrice]);

  const sort_unique_brand_ids = (int_brand_ids) => {
    if (int_brand_ids.length === 0) return int_brand_ids;
    int_brand_ids = int_brand_ids.sort(function (a, b) {
      return a * 1 - b * 1;
    });
    const ret = [int_brand_ids[0]];
    for (let i = 1; i < int_brand_ids.length; i++) {
      //Start loop at 1: arr[0] can never be a duplicate
      if (int_brand_ids[i - 1] !== int_brand_ids[i]) {
        ret.push(int_brand_ids[i]);
      }
    }
    return ret;
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs default price bounds with the resolved slider range
    setDefaultMinPrice(sliderMinPrice);
    setDefaultMaxPrice(sliderMaxPrice);
  }, [sliderMinPrice, sliderMaxPrice]);

  // Seed the slider thumbs to the full catalog range when the user hasn't applied
  // a price filter yet. Without this the upper thumb stays at the product-page max
  // (e.g. 1350) even though the track now spans to the catalog max (e.g. 26000).
  useEffect(() => {
    if (filter?.price_filter != null) return;
    // Fall back to the parent's min/max while the category-filters API is still
    // in flight. On mobile the panel lives in a Radix Sheet that UNMOUNTS on
    // close, so every reopen is a fresh mount: bailing out until sliderMin/Max
    // arrived left the thumbs on their stale pre-clear positions, and by the
    // time the API answered `values` had already been seeded from them. Desktop
    // never showed this because the panel stays mounted and the effect had
    // already run.
    const min = sliderMinPrice ?? minPrice;
    const max = sliderMaxPrice ?? maxPrice;
    if (min == null || max == null) return;
    setValues([Number(min), Number(max)]);
  }, [
    sliderMinPrice,
    sliderMaxPrice,
    minPrice,
    maxPrice,
    filter?.price_filter,
    setValues,
  ]);

  // Restore the slider + temp price from a PREVIOUSLY-APPLIED price filter when the
  // panel remounts (e.g. after navigating to a product detail and pressing back).
  // Redux keeps price_filter; without this the slider thumbs reset to the catalog
  // range even though the product list stays price-filtered — the "selection lost
  // on back" bug. temp* are seeded so the debounced auto-commit sees no change.
  useEffect(() => {
    const pf = filter?.price_filter;
    if (pf == null) {
      // Cleared (or never applied). Park the thumbs at the track ends and drop
      // the staged temps. Returning early here instead — which is what it used
      // to do — left whatever `values` happened to hold in place, so on mobile,
      // where the panel unmounts and remounts, Clear All redrew the full-width
      // track with the thumbs still sitting at the old filtered positions.
      const min = sliderMinPrice ?? minPrice;
      const max = sliderMaxPrice ?? maxPrice;
      if (min != null && max != null) setValues([Number(min), Number(max)]);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores slider thumbs/temp price from redux's previously-applied price filter
      setTempMinPrice(null);
      setTempMaxPrice(null);
      return;
    }
    const min = Number(pf.min_price);
    const max = Number(pf.max_price);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    setValues([min, max]);
    setTempMinPrice(min);
    setTempMaxPrice(max);
    // Run on mount (and if the applied price changes externally, e.g. Clear All).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filter?.price_filter?.min_price,
    filter?.price_filter?.max_price,
    sliderMinPrice,
    sliderMaxPrice,
  ]);

  // Dynamic attribute filters (Color / Size / Fabric / Style / …): error state,
  // loading skeleton, or the API-driven collapsible groups.
  let attributeFiltersSection;
  if (filtersError) {
    attributeFiltersSection = (
      <div className="px-4 py-3 bottomBorder text-sm text-[#DB3D26]">
        {t("something_went_wrong")}
      </div>
    );
  } else if (loadingFilters) {
    attributeFiltersSection = (
      <div className="px-4 py-4 bottomBorder">
        <div className="h-4 w-24 rounded bg-black/10 animate-pulse" />
      </div>
    );
  } else {
    attributeFiltersSection =
      Array.isArray(categoryFilters?.attributes) &&
      categoryFilters.attributes.map((attribute) => {
        const groupKey = `attr-${attribute.id}`;
        const isOpen = activeKey.includes(groupKey);
        return (
          <Collapsible
            key={groupKey}
            open={isOpen}
            className="w-full bottomBorder"
            onOpenChange={() => handleActiveKey(groupKey)}
          >
            <CollapsibleTrigger className="w-full p-4 flex justify-between items-center group/trig hover:bg-black/[0.02] transition-colors">
              <div className="text-[15px] font-semibold textColor">
                {attribute?.name}
              </div>
              <div
                className={`transition-transform duration-250 ${
                  isOpen ? "rotate-0" : "-rotate-90"
                }`}
              >
                <FaChevronDown size={12} className="text-gray-400" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="filter-row px-2 pb-4 md:px-2 lg:px-4">
                {(attribute?.values ?? []).map((val) => {
                  const isChecked = draftAttrIds.includes(
                    Number.parseInt(String(val.id), 10),
                  );
                  return (
                    <label
                      key={val.id}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-2 cursor-pointer border transition-colors ${
                        isChecked
                          ? "border-[var(--color-primary,#DB3D26)]/40 bg-black/[0.03]"
                          : "border-transparent hover:bg-black/5"
                      }`}
                    >
                      <Checkbox
                        className="data-[state=checked]:primaryBackColor shadow-sm border-gray-300 border-[1.5px]"
                        checked={isChecked}
                        onCheckedChange={() => toggleAttributeValue(val.id)}
                      />
                      <span
                        className={`text-sm textColor ${
                          isChecked ? "font-semibold" : "font-normal"
                        }`}
                      >
                        {val?.value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      });
  }

  return (
    <>
      {loadingFilters ? (
        <FilterSkeleton />
      ) : (
        <div className="md:cardBorder md:border rounded-xl headerBackgroundColor overflow-hidden">
          <div className="px-4 py-4 bottomBorder ">
            <div className="flex justify-between items-center gap-2">
              <h5 className="text-lg font-bold">{t("filters")}</h5>
              {isFilterApplied && (
                <button
                  type="button"
                  className="m-0 text-sm font-medium text-[#DB3D26] cursor-pointer hover:underline whitespace-nowrap"
                  onClick={() => {
                    setSelectedCategories([]);
                    // Reset to the CATALOG range (filters API), not defaultMin/MaxPrice.
                    // Those init from the parent's product-page range and only get
                    // corrected by an effect, so on a fresh mobile-drawer mount they
                    // still hold the narrow visible-products range — clearing with them
                    // left the slider pinned to the old window.
                    //
                    // minPrice/maxPrice (parent-owned, and therefore surviving the
                    // mobile Sheet's unmount) are the last fallback so the reset
                    // still lands on real numbers when the filters API hasn't
                    // answered yet on a freshly reopened drawer.
                    const resetMin = Number(
                      sliderMinPrice ?? defaultMinPrice ?? minPrice,
                    );
                    const resetMax = Number(
                      sliderMaxPrice ?? defaultMaxPrice ?? maxPrice,
                    );
                    setMinPrice(resetMin);
                    setMaxPrice(resetMax);
                    setValues([resetMin, resetMax]);
                    // temp prices must go back to NULL, not the default numbers:
                    // the debounced auto-commit treats non-null temps as a staged
                    // price edit and would re-dispatch setFilterMinMaxPrice ~500ms
                    // after the clear — silently re-applying a price filter and
                    // making Clear All need a second click.
                    setTempMinPrice(null);
                    setTempMaxPrice(null);
                    // Wipe the staged selections directly. The draft-sync effects only
                    // run when redux's brand_ids / attribute_value_ids identity
                    // CHANGES; clearing while they are already [] in redux (e.g. a
                    // price-only filter, or drafts staged but not yet committed) is a
                    // no-op, so the checkboxes stayed ticked after Clear All.
                    setDraftBrandIds([]);
                    setDraftAttrIds([]);
                    // Drafts and redux now agree on "empty", so stop the debounced
                    // auto-commit from firing a redundant dispatch after this clear.
                    skipFirstCommit.current = true;

                    // Clear All wipes EVERYTHING, category included: URL filter
                    // params (brand/category/price/sort/attr/seller/country/q)
                    // AND the redux-owned category bookkeeping (slug,
                    // breadcrumb, listing_source) → the listing shows all
                    // products with no category selected.
                    clearUrlFilters();
                    dispatch(clearAllFilter());
                    // dispatch(resetSelectedCategories())
                    setOffset(0);
                    setProductResult([]);
                    // Close AFTER the clear commits. On mobile this component lives
                    // inside a Radix Sheet that unmounts its content on close, so
                    // closing in the same commit tore the panel down mid-reset and
                    // the next open remounted with the pre-clear price thumbs.
                    requestAnimationFrame(() => setShowFilter(false));
                  }}
                >
                  {t("clearAll")}
                </button>
              )}
            </div>
          </div>
          {/* Category picker — shown only when the active category actually has
              sub-categories (API child_categories non-empty). Leaf categories
              return child_categories: [] → section hidden. */}
          {Array.isArray(categoryFilters?.child_categories) &&
            categoryFilters.child_categories.length > 0 && (
              <Collapsible
                open={activeKey.includes("1")}
                className="w-full bottomBorder"
                onOpenChange={() => handleActiveKey("1")}
              >
                <CollapsibleTrigger className="w-full p-4 flex justify-between items-center group/trig hover:bg-black/[0.02] transition-colors">
                  <div className="text-[15px] font-semibold textColor">
                    {t("product_category")}
                  </div>
                  <div
                    className={`transition-transform duration-250 ${
                      activeKey.includes("1") ? "rotate-0" : "-rotate-90"
                    }`}
                  >
                    <FaChevronDown size={12} className="text-gray-400" />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="filter-row">
                    <CategoryTree
                      categories={categoryFilters.child_categories}
                      selectedCategories={selectedCategories}
                      onCategoryChange={handleCategoryChange}
                      initialFilter={categoryTreeInitialFilter}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

          {/* Categories filter — all top-level categories from the categories API.
              Single-select: picking one sets the active category_id; picking it
              again clears back to all. */}
          {allCategories?.length > 0 && (
            <Collapsible
              open={activeKey.includes("cat")}
              className="w-full bottomBorder"
              onOpenChange={() => handleActiveKey("cat")}
            >
              <CollapsibleTrigger className="w-full p-4 flex justify-between items-center group/trig hover:bg-black/[0.02] transition-colors">
                <div className="text-[15px] font-semibold textColor">
                  {t("browse_categories") || "Browse Categories"}
                </div>
                <div
                  className={`transition-transform duration-250 ${
                    activeKey.includes("cat") ? "rotate-0" : "-rotate-90"
                  }`}
                >
                  <FaChevronDown size={12} className="text-gray-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="filter-row">
                  {/* Full nested tree (cat_active_childs) with expand/collapse —
                      same component as the child-category picker. */}
                  <CategoryTree
                    categories={allCategories}
                    selectedCategories={selectedCategories}
                    onCategoryChange={handleCategoryChange}
                    initialFilter={categoryTreeInitialFilter}
                  />
                  {/* Load more when the API has more categories than loaded. */}
                  {totalCategories != null &&
                    totalCategories > allCategories.length && (
                      <button
                        type="button"
                        onClick={loadMoreCategories}
                        disabled={loadingCategories}
                        className="-mt-3 flex items-center gap-1 px-9 pb-1 text-[13px] font-medium text-gray-500 transition-colors hover:primaryColor disabled:opacity-50"
                      >
                        {loadingCategories ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                            {t("loading") || "Loading..."}
                          </>
                        ) : (
                          <>
                            {t("load_more") || "Load More"}
                            <FaChevronDown size={9} className="mt-px" />
                          </>
                        )}
                      </button>
                    )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {brands && brands?.length > 0 && (
            <Collapsible
              open={activeKey.includes("2")}
              className="w-full bottomBorder"
              onOpenChange={() => handleActiveKey("2")}
            >
              <CollapsibleTrigger className="w-full p-4 flex justify-between items-center group/trig hover:bg-black/[0.02] transition-colors">
                <div className="text-[15px] font-semibold textColor">
                  {t("brands")}
                </div>
                <div
                  className={`transition-transform duration-250 ${
                    activeKey.includes("2") ? "rotate-0" : "-rotate-90"
                  }`}
                >
                  <FaChevronDown size={12} className="text-gray-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="filter-row px-2 pb-4 md:px-2 lg:px-4">
                  {brands.slice(0, brandLimit).map((brand) => {
                    const isChecked = draftBrandIds.includes(brand.id);
                    return (
                      <label
                        key={brand.id}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-2 cursor-pointer border transition-colors ${
                          isChecked
                            ? "border-[var(--color-primary,#DB3D26)]/40 bg-black/[0.03]"
                            : "border-transparent hover:bg-black/5"
                        }`}
                      >
                        <Checkbox
                          className="data-[state=checked]:primaryBackColor shadow-sm border-gray-300 border-[1.5px] shrink-0"
                          checked={isChecked}
                          onCheckedChange={() => filterbyBrands(brand)}
                        />
                        {brand?.image_url && (
                          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white p-1 shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={brand.image_url}
                              alt={brand?.translations?.name ?? brand?.name}
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                            />
                          </span>
                        )}
                        <span
                          className={`text-sm textColor truncate ${
                            isChecked ? "font-semibold" : "font-normal"
                          }`}
                        >
                          {brand?.translations?.name ?? brand?.name}
                        </span>
                      </label>
                    );
                  })}
                  {brands.length > brandLimit && (
                    <button
                      type="button"
                      onClick={() => setShowBrandModal(true)}
                      className="mt-1 px-2.5 py-2 text-sm font-semibold text-[var(--color-primary,#DB3D26)] hover:underline"
                    >
                      {`+${brands.length - brandLimit} ${t("more")}`}
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {brands && brands.length > brandLimit && (
            <BrandSearchModal
              open={showBrandModal}
              onOpenChange={setShowBrandModal}
              brands={brands}
              selectedBrandIds={draftBrandIds}
              onToggleBrand={filterbyBrands}
            />
          )}

          {/* Dynamic attribute filters (Color / Size / Fabric / Style / …).
              Rendered entirely from the API response — no hardcoded values.
              One collapsible per attribute group; each value toggles a redux
              attribute_value_id. */}
          {attributeFiltersSection}

          <Collapsible
            open={activeKey.includes("4")}
            className="w-full bottomBorder"
            onOpenChange={() => handleActiveKey("4")}
          >
            <CollapsibleTrigger className="w-full p-4 flex justify-between items-center group/trig hover:bg-black/[0.02] transition-colors">
              <div className="text-[15px] font-semibold textColor">
                {t("priceRange")}
              </div>
              <div
                className={`transition-transform duration-250 ${
                  activeKey.includes("4") ? "rotate-0" : "-rotate-90"
                }`}
              >
                <FaChevronDown size={12} className="text-gray-400" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pb-4 md:px-2 lg:px-4">
              <div className="flex flex-col gap-4">
                <PriceSlider
                  minPrice={sliderMinPrice}
                  maxPrice={sliderMaxPrice}
                  setValues={setValues}
                  setTempMaxPrice={setTempMaxPrice}
                  setTempMinPrice={setTempMinPrice}
                  values={values}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* No Apply button — filter changes auto-commit (debounced) on select. */}
        </div>
      )}
    </>
  );
};

export default Filter;
