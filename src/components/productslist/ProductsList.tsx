"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { useInfiniteQuery } from "@tanstack/react-query";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import { t } from "@/utils/translation";
import Filter from "../productFilter/ProductFilter";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { setCategoryBreadcrumb } from "@/redux/slices/productFilterSlice";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";
import {
  collectLeafCategoryEntries,
  toCategorySlugCsv,
} from "@/utils/categoryTree";
import { resolveSlugCsvToIdCsv } from "@/utils/categorySlugResolver";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "swiper/css";
import "swiper/css/navigation";
import VerticleProductCard from "../productcards/VerticleProductCard";
import ListViewProductCard from "../productcards/ListViewProductCard";
import { FaThList } from "react-icons/fa";
import CardSkeleton from "../skeleton/CardSkeleton";
import FilterDrawer from "../productFilter/FilterDrawer";
import { IoFilter } from "react-icons/io5";
import NoOrderSvg from "@/assets/empty-state/no-product.svg";
import NotFound from "@/components/notfound/NotFound";
import useIsHydrated from "@/hooks/useIsHydrated";

// What the server renders with: shopModeSlice's initial `mode`. Must stay in
// sync with that slice — if they diverge the SSR query key stops matching and
// the hydration mismatch this guards against comes straight back.
const SHOP_MODE_SSR_DEFAULT = "quick";

// Column-count icon: N vertical bars inside a square, matching the toolbar
// mock (2/3/4/5 columns). Bars scale to fill so 5 reads denser than 2.
const ColumnsIcon = ({ count = 4, size = 18 }: { count?: number; size?: number }) => {
  const gap = 2;
  const totalGap = gap * (count - 1);
  const barW = (size - totalGap) / count;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="currentColor"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={0}
          width={barW}
          height={size}
          rx={1}
        />
      ))}
    </svg>
  );
};

// `initialProducts` is set by getServerSideProps: { envelope, latitude, longitude }
// where the envelope is the raw listing response ({status, message, data, total})
// for page 1 of the UNFILTERED listing, fetched with the zone centroid (or
// default_city). It exists to put real product HTML in front of crawlers — with
// the old ssr:false the server shipped an empty <main> while users saw hundreds
// of products.
//
// Those coordinates are not necessarily the visitor's: a returning user has a
// persisted city. So the seed governs the FIRST render only (matching what the
// server sent, which is what hydration requires) and redux coords take over as
// soon as they exist — a normal keyed refetch, i.e. today's behaviour for a user
// with a saved city.
interface ProductsListProps {
  initialProducts?: any;
}

const Products = ({ initialProducts = null }: ProductsListProps) => {
  const total_products_per_page = 12;
  const dispatch = useDispatch();
  const city = useSelector((state: any) => state.City);
  const setting = useSelector((state: any) => state.Setting.setting);
  // True only after mount. Every branch that reads persisted redux or
  // localStorage must be gated on this, or the first client render disagrees
  // with the server HTML and React throws the whole tree away (#418).
  const isHydrated = useIsHydrated();
  // `city` and `setting` are persisted — empty on the server, populated before
  // the first client paint. Until hydrated use the SSR coords so the query key
  // matches the server's and initialData actually applies; the real city takes
  // over on the next render and refetches normally.
  const latitude = !isHydrated
    ? initialProducts?.latitude
    : city?.city?.latitude ||
      setting?.default_city?.latitude ||
      initialProducts?.latitude;
  const longitude = !isHydrated
    ? initialProducts?.longitude
    : city?.city?.longitude ||
      setting?.default_city?.longitude ||
      initialProducts?.longitude;
  // const [subCategories, setSubCategories] = useState([]);
  // const [isSubCatLoading, setIsSubCatLoading] = useState(false);
  // Filter VALUES (search/brand/category/price/sort/attributes/seller/
  // country) live ONLY in the URL — no redux, no hydration-gate needed for
  // them: context.query (server) and router.query (client, once isReady) read
  // the SAME URL, so there's no persisted-store timing gap to guard against.
  const {
    filter: urlFilter,
    isReady: routerIsReady,
    setCategoryId,
    setSort,
  } = useUrlProductFilters();
  // Non-filter redux fields still needed here — category-browse bookkeeping,
  // set by Category.jsx/breadcrumb/homelayout click-throughs alongside the URL
  // navigation. Merged into one `filter` object below so every existing
  // `filter?.x` read in this file keeps working unchanged.
  //
  // Still persisted (redux-persist), still empty on the server / populated
  // asynchronously after mount — same hydration hazard the OLD whole-filter
  // gate protected against, just narrower now that filter VALUES themselves
  // moved to the URL and no longer need it. Reading these unguarded produced
  // a real hydration mismatch (React discarded and regenerated the whole
  // tree client-side, breaking event handlers on stale detached nodes —
  // reproduced live: category-tree clicks silently did nothing).
  const persistedListingSource = useSelector(
    (state: any) => state.ProductFilter.listing_source,
  );
  const persistedCategorySlug = useSelector(
    (state: any) => state.ProductFilter.category_slug,
  );
  // Home-layout "See All" block-source fields (setBlockSource in
  // productFilterSlice) — redux-owned, NOT part of urlFilter. Without merging
  // these in, every filter?.data_source / manual_product_ids / block_source_id
  // read below is always undefined and the See All request falls through to
  // the plain unfiltered listing regardless of which source the block used.
  const persistedDataSource = useSelector(
    (state: any) => state.ProductFilter.data_source,
  );
  const persistedManualProductIds = useSelector(
    (state: any) => state.ProductFilter.manual_product_ids,
  );
  const persistedBlockSourceId = useSelector(
    (state: any) => state.ProductFilter.block_source_id,
  );
  const listing_source = isHydrated ? persistedListingSource : "all";
  const category_slug = isHydrated ? persistedCategorySlug : "";
  const data_source = isHydrated ? persistedDataSource : "";
  const manual_product_ids = isHydrated ? persistedManualProductIds : "";
  const block_source_id = isHydrated ? persistedBlockSourceId : "";
  // Memoized: a new object literal every render breaks every downstream
  // useEffect keyed on `filter` by reference — see ProductFilter.jsx's own
  // matching fix for the exact infinite-loop failure mode this caused.
  const filter: any = useMemo(
    () => ({
      ...urlFilter,
      listing_source,
      category_slug,
      data_source,
      manual_product_ids,
      block_source_id,
    }),
    [
      urlFilter,
      listing_source,
      category_slug,
      data_source,
      manual_product_ids,
      block_source_id,
    ],
  );
  const persistedShopMode = useSelector((state: any) => state.ShopMode.mode);
  // Same reasoning: persisted, and in the query key.
  const shopMode = isHydrated ? persistedShopMode : SHOP_MODE_SSR_DEFAULT;
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  // View mode: "list" | 2 | 3 | 4 | 5. Numbers = grid column count (FLIP-animated).
  // Persisted to localStorage so it survives a remount/reload — e.g. switching
  // language (LTR↔RTL) previously dropped the chosen mode back to the default 5.
  // Always starts at the default: the server has no localStorage, so reading the
  // saved value here would render a different column count on the first client
  // render than the server emitted and discard the tree (#418). The stored
  // preference is applied in the effect below, one render later.
  const [viewMode, setViewMode] = useState<number | "list">(5);
  // Restore-once, before the persist effect below can overwrite the saved value.
  const viewModeRestored = useRef(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("productsViewMode");
    viewModeRestored.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore-once from localStorage post-hydration; see comment above
    if (saved === "list") return setViewMode("list");
    const n = Number(saved);
    if ([2, 3, 4, 5].includes(n)) setViewMode(n);
  }, []);
  useEffect(() => {
    // Skip the initial pass: writing the default 5 before the restore effect has
    // run would clobber the user's saved choice.
    if (!viewModeRestored.current) return;
    window.localStorage.setItem("productsViewMode", String(viewMode));
  }, [viewMode]);
  const isList = viewMode === "list";
  // Grid view column count (ignored in list view, which uses its own Tailwind cols).
  const gridCols = isList ? 4 : viewMode;
  const [debouncedSearch, setDebouncedSearch] = useState(filter?.search);
  const { selectedLanguage } = useSelector((state: any) => state.Language);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  const categoryBreadcrumb = useSelector(
    (state: any) => state.ProductFilter.categoryBreadcrumb,
  );

  // Filter sidebar/drawer always visible — no listing type hides it (the
  // previous data_source "See All" hide condition was removed).
  const hideFilter = false;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filter?.search);
    }, 500);
    return () => clearTimeout(timer);
  }, [filter?.search]);

  const refetchBreadcrumbTranslations = async () => {
    const updated = await Promise.all(
      categoryBreadcrumb.map(async (category: any) => {
        try {
          const res = await api.getCategories({
            slug: category.slug,
            is_own_data: 1,
            latitude,
            longitude,
          });
          const data = res?.data;
          return {
            ...category,
            name: data?.[0]?.translations?.name || category.name,
            translations: data?.[0]?.translations || category.translations,
          };
        } catch {
          return category;
        }
      }),
    );
    dispatch(setCategoryBreadcrumb({ data: updated }));
  };

  useEffect(() => {
    if (!categoryBreadcrumb || categoryBreadcrumb.length === 0) return;
    refetchBreadcrumbTranslations();
    // Only re-run on language change: `categoryBreadcrumb` and
    // `refetchBreadcrumbTranslations` are intentionally omitted — the effect
    // body itself updates categoryBreadcrumb via dispatch, so depending on it
    // would create an infinite refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]);

  // Only treat category_id as a real filter when it's a non-empty, valid
  // value. Empty string / "NaN" / "all categories" / null => no category
  // filter. filter.category_id is a SLUG csv from the URL (e.g.
  // "paneer-tofu,cheese-butter") — resolved to numeric leaf ids below via the
  // full category tree before it's usable as an API param.
  const isValidCategoryId =
    filter?.category_id != null &&
    filter?.category_id !== "" &&
    filter?.category_id !== "NaN" &&
    filter?.category_id !== "all categories";

  // Full tree, fetched once (cached) — the only way to resolve an arbitrary
  // slug back to its id (the categories API has no direct slug/id lookup; see
  // categorySlugResolver.js). Only needed while a category filter is active.
  const { data: fullCategoryTree } = useFullCategoryTree({
    latitude,
    longitude,
    languageId: language?.id,
  });

  const resolvedCategoryIdCsv = isValidCategoryId
    ? resolveSlugCsvToIdCsv(fullCategoryTree ?? [], filter.category_id)
    : "";

  const finalCategoryIds = isValidCategoryId ? resolvedCategoryIdCsv : null;

  // The entry category's CHILD categories, each with its own nested
  // `cat_active_childs`. Used to (a) one-shot resolve a parent into its leaf
  // descendants and (b) recover slug/image for the sub-category chip strip.
  //
  // `?slug=X` returns X's CHILDREN, not X itself — a parent slug answers with its
  // child rows, and a leaf slug answers with an empty array. This used to read
  // `res.data[0]` as though it were the matched category, which made a parent
  // look like whichever child came first (no children of its own → treated as a
  // leaf → no rewrite → the parent id was queried directly and matched nothing,
  // since products hang off leaves), and made a real leaf resolve to null.
  const { data: childCategories = null } = useQuery({
    queryKey: [
      "subCategories",
      listing_source,
      category_slug,
      latitude,
      longitude,
    ],
    queryFn: async () => {
      if (listing_source !== "category" || !category_slug) {
        return null;
      }
      const res = await api.getCategories({
        slug: category_slug,
        latitude,
        longitude,
      });
      // Always an array: [] means the entry category is a leaf.
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled:
      listing_source === "category" &&
      !!category_slug &&
      latitude != null &&
      longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // ONE-SHOT parent→leaf resolution. When the user lands on a NEW category
  // (category_slug changes) that is a parent, rewrite category_id to the CSV of
  // its leaf/end-level descendants — ONCE. After that the sidebar CategoryTree
  // owns the selection, so unchecking a child (or all children) sticks and is
  // never re-expanded here. A leaf entry needs no rewrite (its own id is already
  // the leaf). Guarded by a ref keyed on slug so it fires exactly once per entry.
  const resolvedSlugRef = useRef<string | null>(null);
  useEffect(() => {
    if (listing_source !== "category" || !category_slug) return;
    if (!childCategories) return; // children not loaded yet (null, not [])
    if (resolvedSlugRef.current === category_slug) return; // already resolved
    resolvedSlugRef.current = category_slug;

    // No children → the entry category IS a leaf; its own id already queries the
    // right products, so leave category_id alone.
    if (childCategories.length === 0) return;

    // Collect leaves across every child subtree. A child with no children of its
    // own is itself a leaf; deeper branches recurse. The URL stores SLUGS (see
    // categorySlugResolver.js) — childCategories rows already carry `.slug` per
    // node, so this needs no extra fetch beyond what's already in flight here.
    const leafEntries = childCategories.flatMap((child: any) =>
      collectLeafCategoryEntries(child),
    );
    const leafSlugCsv = toCategorySlugCsv(leafEntries);
    if (leafSlugCsv && String(filter?.category_id ?? "") !== leafSlugCsv) {
      setCategoryId(leafSlugCsv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category_slug, listing_source, childCategories]);

  // Reset the one-shot guard when the flow is left (Clear All / non-category), so
  // returning to the same category later resolves afresh.
  useEffect(() => {
    if (listing_source !== "category") {
      resolvedSlugRef.current = null;
    }
  }, [listing_source]);

  // category_id already holds the exact leaf/end-level ids to query (a single
  // leaf, or the resolved leaf CSV for a parent), kept in sync by the sidebar as
  // the user toggles children. No parent+children merge — parents are never
  // queried directly. Empty → null → all products.
  const effectiveCategoryIds = finalCategoryIds || null;

  const fetchProducts = async ({ pageParam = 0 }: { pageParam?: number }) => {
    const filterParams = {
      min_price: filter.price_filter?.min_price,
      max_price: filter.price_filter?.max_price,
      ...(effectiveCategoryIds && {
        category_id: effectiveCategoryIds,
      }),
      brand_ids: filter?.brand_ids.toString(),
      ...(filter?.attribute_value_ids?.length > 0 && {
        attribute_value_ids: filter.attribute_value_ids.join(","),
      }),
      sort: filter?.sort_filter,
      search: debouncedSearch,
      limit: total_products_per_page,
      sizes: filter?.search_sizes
        ?.filter((obj: any) => obj.checked)
        .map((obj: any) => obj["size"])
        .join(","),
      offset: pageParam,
      unit_ids: filter?.search_sizes
        ?.filter((obj: any) => obj.checked)
        .map((obj: any) => obj["unit_id"])
        .join(","),
      seller_id: filter?.seller_id,
      country_id: filter?.country_id,
      section_id: filter?.section_id,
      // Home-layout "See All" — param choice keys off data_source:
      //   "manual"            -> data_source=manual AND manual_product_ids.
      //     BOTH are required: verified against the live API, sending
      //     manual_product_ids alone is silently ignored and answers with the
      //     full unfiltered catalogue (7 ids -> total 22).
      //   "category" / "brand" -> category_id / brand_ids (no data_source)
      //   anything else (top_selling, trending, new_arrivals, best_rated,
      //     discounted, most_favorite, recently_visited, buy_again, ...)
      //                       -> data_source alone
      ...(filter?.data_source === "manual"
        ? filter?.manual_product_ids && {
            data_source: "manual",
            manual_product_ids: filter.manual_product_ids,
          }
        : filter?.data_source &&
          filter.data_source !== "category" &&
          filter.data_source !== "brand" && {
            data_source: filter.data_source,
          }),
      // effectiveCategoryIds (the sidebar's URL-driven pick) must win over a
      // stale block_source_id — the sidebar clears data_source on a real
      // category change (see ProductFilter.jsx's handleCategoryChange), but
      // this guard is defense-in-depth against that redux state outliving a
      // URL-driven category change for any other reason and silently
      // overriding it with the block's category again.
      ...(filter?.data_source === "category" &&
        filter?.block_source_id &&
        !effectiveCategoryIds && {
          category_id: filter.block_source_id,
        }),
      ...(filter?.data_source === "brand" &&
        filter?.block_source_id && {
          brand_ids: filter.block_source_id,
        }),
    };

    return await api.getProductByFilter({
      latitude,
      longitude,
      filters: filterParams,
    });
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "products",
      // grid_view is presentation-only — exclude so toggling list/grid
      // doesn't change the key and trigger a refetch (skeleton blink).
      { ...filter, grid_view: undefined, search: debouncedSearch },
      effectiveCategoryIds,
      latitude,
      longitude,
      language?.id,
      shopMode,
    ],
    queryFn: fetchProducts,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      if (!lastPage.data || lastPage.data.length < total_products_per_page) {
        return undefined;
      }
      const nextOffset = allPages.length * total_products_per_page;
      // Manual "See All" is bounded by its own id list — the backend has been
      // seen to ignore manual_product_ids and answer with a full unfiltered
      // page, which would otherwise make getNextPageParam think there's more
      // to load and keep paginating past the actual selection.
      if (filter?.data_source === "manual") {
        const manualCount = String(filter?.manual_product_ids ?? "")
          .split(",")
          .filter(Boolean).length;
        if (nextOffset >= manualCount) return undefined;
      }
      return nextOffset;
    },
    initialPageParam: 0,
    // Seed the exact query the server already answered: same coords, no filters
    // (the gate above pins them to the slice defaults until hydration), page 1.
    //
    // Shape matters — useInfiniteQuery stores { pages, pageParams }, and the
    // page here is the RAW envelope ({status, message, data, total}) because
    // that is precisely what the client's queryFn returns. `total` is what
    // drives the "N Products Found" count and getNextPageParam, so seeding only
    // the rows would break both. pageParams is [0], matching initialPageParam —
    // pagination is offset-based, so page 2 is offset 12, not page "2".
    //
    // Any other key (the user's own city, a saved filter, another language)
    // is a different question and fetches normally, as it does today.
    // Not gated on isHydrated: the coordinate comparison already restricts this
    // to the exact key the server answered. Post-hydration the key changes
    // anyway (real city, real language id), so the seed simply stops applying —
    // gating it would only drop the data while the key is still identical and
    // force an immediate refetch of the page already on screen.
    // Seed the SSR envelope only when it answers the EXACT question this
    // render is asking: same coordinates, and — since filters are URL-driven
    // and getServerSideProps parses the same query string — the same parsed
    // filter (JSON-compared; both sides go through parseFilterFromQuery, so
    // key order/shape always match when the values do). Any mismatch (a
    // different city, a filter changed since SSR, another language) is a
    // different question and fetches normally, as it does today.
    // Home-layout "See All" (data_source/manual_product_ids/block_source_id)
    // lives in redux, invisible to getServerSideProps — initialProducts is
    // always the PLAIN unfiltered listing for this URL. Seeding it while a
    // block source is active would show that unfiltered page under the
    // manual/category/brand queryKey, and since the global QueryClient
    // default staleTime is 5 minutes (see getQueryClient.ts), react-query
    // treats seeded data as fresh and never refetches to correct it.
    initialData:
      initialProducts &&
      !filter?.data_source &&
      latitude === initialProducts.latitude &&
      longitude === initialProducts.longitude &&
      JSON.stringify(urlFilter) === JSON.stringify(initialProducts.filter ?? {})
        ? { pages: [initialProducts.envelope], pageParams: [0] }
        : undefined,
    // Wait for the URL to be readable before fetching — router.query is `{}`
    // pre-isReady, which would fetch unfiltered even when the URL has filter
    // params. Skip the wait when the SSR seed already answers this exact URL
    // (initialData above already matched) — nothing to wait for in that case.
    //
    // Also wait for the category tree when a category filter is active: the
    // URL only stores slugs, and until the tree resolves them to numeric ids
    // effectiveCategoryIds is null — fetching now would flash the UNFILTERED
    // catalog before the real filtered results land one render later.
    enabled:
      !!latitude &&
      !!longitude &&
      !(isValidCategoryId && fullCategoryTree == null) &&
      (routerIsReady ||
        (initialProducts &&
          !filter?.data_source &&
          latitude === initialProducts.latitude &&
          longitude === initialProducts.longitude &&
          JSON.stringify(urlFilter) ===
            JSON.stringify(initialProducts.filter ?? {}))),
    // No placeholderData/keepPreviousData: every filter/sort/search change
    // (category, brand, price, attribute, rating, sort, search — any change
    // to the queryKey above) must replace the grid with skeletons rather
    // than leave the PREVIOUS filter's products on screen while the new
    // request is in flight — showing stale results during a filter change
    // reads as "the filter didn't apply." Load More (fetchNextPage) is
    // unaffected by this: it appends a new page to the existing `data.pages`
    // under the SAME queryKey, it doesn't create a new query, so the already
    // -rendered products stay up regardless of this setting.
  });

  // The product-filter API returns ONE ROW PER MATCHING VARIANT, so a product
  // with several matching attribute values (e.g. Kajal in red/green/orange) comes
  // back as duplicate rows sharing the same product `id` — while `total` counts
  // distinct products. Dedupe by product id (keep first) so the grid shows each
  // product once and matches the "N Products Found" count.
  const productResult = (() => {
    const rows = data?.pages?.flatMap((page: any) => page?.data ?? []) ?? [];
    const seen = new Set();
    const unique: any[] = [];
    for (const p of rows) {
      const key = p?.id ?? p?.slug;
      if (key == null) {
        unique.push(p);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    return unique;
  })();
  // Count of products rendered BEFORE the current page loaded. Cards at index
  // >= this are new arrivals → they fade in; older cards stay put (no jump).
  const prevCountRef = useRef(0);
  useEffect(() => {
    // After each render, remember the current length so the NEXT page knows
    // where its new cards start.
    prevCountRef.current = productResult.length;
  }, [productResult.length]);
  const totalProducts = data?.pages?.[0]?.total || 0;
  // True while a just-entered PARENT category hasn't been rewritten to its
  // leaf CSV yet (the one-shot effect above). A parent id queried directly
  // matches nothing — products hang off leaves only — so the products query
  // legitimately returns empty for this key. Without this, there's a gap
  // between the leaf CSV being dispatched and the new query key actually
  // starting to fetch, where `data` still holds the parent id's (empty)
  // result and `isFetching` hasn't flipped true yet — "No product found"
  // would flash before the leaf-keyed fetch even began.
  // Intentional: resolvedSlugRef must be current DURING this render — it
  // feeds `loading` immediately below, which gates what this render paints.
  /* eslint-disable react-hooks/refs */
  const isResolvingCategory =
    listing_source === "category" &&
    !!category_slug &&
    resolvedSlugRef.current !== category_slug;
  /* eslint-enable react-hooks/refs */
  // Every filter/sort/search change (new queryKey) replaces the grid with
  // skeletons — see the useInfiniteQuery config above (no placeholderData).
  // isFetchingNextPage is EXCLUDED: Load More appends a page under the SAME
  // queryKey, so it must keep the already-rendered products visible and
  // only show its own loading affordance, not blow away the whole grid.
  const loading =
    isLoading || (isFetching && !isFetchingNextPage) || isResolvingCategory;
  const isLoadMoreLoading = isFetchingNextPage;

  const setProductResult = () => {};
  const setOffset = () => {};

  const handlePrices = async (result: any) => {
    // Listing API may omit total_min_price/total_max_price → derive from product prices.
    const products = result?.data || [];
    const prices = products
      .map((p: any) => Number(p?.min_price ?? p?.price))
      .filter((n: number) => !Number.isNaN(n));
    const apiMin = Number(
      result?.total_min_price ?? (prices.length ? Math.min(...prices) : 0),
    );
    const apiMax = Number(
      result?.total_max_price ?? (prices.length ? Math.max(...prices) : 0),
    );

    if (
      filter?.price_filter?.min_price !== undefined &&
      filter?.price_filter?.min_price !== null &&
      filter?.price_filter?.max_price !== null &&
      filter?.price_filter?.max_price !== undefined
    ) {
      setValues([
        parseInt(String(filter?.price_filter?.min_price), 10),
        parseInt(String(filter?.price_filter?.max_price), 10),
      ]);
      setMinPrice(apiMin);
      setMaxPrice(apiMax);
    } else {
      // No user price filter: don't seed `values` from the product-page range
      // (caps the thumb at the visible max e.g. 1350). ProductFilter seeds the
      // thumbs from the catalog-wide filters API range instead. Only track the
      // listing min/max here for any non-slider use.
      setMinPrice(apiMin);
      setMaxPrice(apiMin === apiMax ? apiMax + 100 : apiMax);
      // No applied price filter → drop any stale thumb positions. `values` lives
      // here (parent), so it outlives the filter panel: the desktop sidebar stays
      // mounted and re-seeds the thumbs itself, but the mobile drawer unmounts on
      // close and would remount reading the pre-Clear-All range. Emptying it hands
      // seeding back to ProductFilter's catalog-range effect.
      setValues([]);
    }
  };

  useEffect(() => {
    if (data?.pages?.[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives price range from fetched data; not derivable from render
      handlePrices(data.pages[0]);
    }
    // handlePrices intentionally omitted: it's re-created each render and
    // only data changing should trigger this re-derivation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Sticky offset for the toolbar = live header height. The mobile header is two
  // rows (top bar + search + mode toggle) and grows/shrinks per breakpoint and
  // per shop-mode, so a hardcoded top-[56px] stuck the toolbar *inside* the
  // header and let product cards scroll over it. Measure instead.
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;
    const measure = () => setHeaderH(header.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Infinite scroll: observe a sentinel near the list end; when it enters the
  // viewport, load the next page automatically (no Load More button).
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sortProduct = async (value: string) => {
    setSort(value);
  };

  // Listing payload uses `images: [{ image_url }]` and sparse variants (missing
  // measurement/unit/is_unlimited_stock/status). Adapt to the shape the cards expect
  // so images, variant pills, price and add-to-cart all work.
  const firstImage = (p: any) => {
    const img = p?.images?.[0];
    return (
      p?.image_url || (typeof img === "string" ? img : img?.image_url) || ""
    );
  };

  const adaptVariant = (v: any, p: any) => ({
    ...v,
    price: v?.price ?? p?.price ?? p?.min_price ?? 0,
    discounted_price: v?.discounted_price ?? 0,
    stock: v?.stock ?? 0,
    is_unlimited_stock: v?.is_unlimited_stock ?? p?.is_unlimited_stock ?? 0,
    status: v?.status ?? 1,
    measurement: v?.measurement ?? v?.attributes_text ?? "",
    unit: v?.unit ?? { short_code: "" },
  });

  const adaptProduct = (p: any) => {
    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;
    return {
      ...p,
      name: p?.name || p?.short_description || "",
      image_url: firstImage(p),
      total_allowed_quantity: p?.total_allowed_quantity ?? p?.stock ?? 999,
      average_rating: p?.average_rating ?? p?.rating ?? "3",
      rating_count: p?.rating_count || 0,
      time_to_deliver: p?.time_to_deliver || "",
      is_featured: p?.is_featured ?? false,
      variants: hasVariants
        ? p.variants.map((v: any) => adaptVariant(v, p))
        : [
            {
              id: p?.variant_id ?? p?.id,
              price: p?.price ?? p?.min_price ?? 0,
              discounted_price: p?.discounted_price ?? 0,
              stock: p?.stock ?? 0,
              is_unlimited_stock: p?.is_unlimited_stock ?? 0,
              status: 1,
              measurement: "",
              unit: { short_code: "" },
            },
          ],
    };
  };

  const placeholderItems = Array.from({ length: 12 }).map((_, index) => index);

  return (
    <section>
      <div>
        <div>
          <BreadCrumb />
        </div>
        <div className="container">
          <div className="mb-5 md:mb-8 md:mt-2">
            <div>
              {/* {listing_source === "category" && <CategoryFlowBreadcrumb />} */}
              <div className="flex gap-6">
                {/* Left filter sidebar — desktop only; mobile uses the drawer.
                    Hidden for See All (data_source) listings. */}
                {!hideFilter && (
                  // Sticky, self-scrolling column. Without its own scroll box the
                  // aside grew to full content height, so a long filter list had
                  // nothing to scroll but the PAGE — dragging inside the filters
                  // moved the product grid with them. Parking it under the sticky
                  // header + category strip and capping it at the leftover viewport
                  // height keeps filter scrolling and product scrolling separate.
                  // Heights come from the vars CategoryTabs publishes, so this
                  // tracks the strip's collapse instead of hardcoding an offset.
                  <aside
                    // No rounding here: the Filter card inside already owns the
                    // border + rounded-xl + overflow-hidden. Rounding this box too
                    // clipped the card's own corners square, because the card's
                    // straight-edged border painted into the aside's rounded one.
                    className="hidden lg:block w-[280px] shrink-0 self-start sticky overflow-y-auto overscroll-contain custom-scrollbar"
                    style={{
                      // max() against the measured header, not the vars alone:
                      // CategoryTabs owns --layout-header-h/--layout-strip-h and
                      // doesn't render on every listing page, leaving both 0 — the
                      // column would then park at the viewport top and slide under
                      // the header. headerH is measured here unconditionally, so it
                      // is the floor; the vars win when the strip is present.
                      top: `max(${headerH}px, calc(var(--layout-header-h) + var(--layout-strip-h)))`,
                      maxHeight: `calc(100vh - max(${headerH}px, calc(var(--layout-header-h) + var(--layout-strip-h))) - 1rem)`,
                    }}
                  >
                    <Filter
                      setProductResult={setProductResult}
                      setOffset={setOffset}
                      minPrice={minPrice}
                      maxPrice={maxPrice}
                      values={values}
                      setValues={setValues}
                      setMinPrice={setMinPrice}
                      setMaxPrice={setMaxPrice}
                    />
                  </aside>
                )}

                <div className="flex flex-1 min-w-0 flex-col gap-6">
                  {/* Header bar — lives inside the grid column so its width
                    matches the product list (not the full filter+grid row). */}
                  <div
                    className={`${listing_source === "category" ? "mb-1" : "mb-2"} pt-3 md:pt-0 sticky bodyBackgroundColor z-30 md:static `}
                    style={{ top: headerH }}
                  >
                    {loading ? (
                      <CardSkeleton height={70} />
                    ) : (
                      <div
                        className={` flex justify-between flex-col md:flex-row  md:items-center px-4 py-3 cardBorder border rounded-xl gap-3 md:gap-0  headerBackgroundColor  `}
                      >
                        <div className="flex items-center gap-3 order-1 md:order-1">
                          {!hideFilter && (
                            <button
                              type="button"
                              onClick={() => setShowFilter(true)}
                              className="flex lg:hidden items-center gap-2 rounded-lg primaryBackColor text-white px-4 h-10 text-sm font-semibold transition hover:opacity-90 active:scale-[0.98]"
                            >
                              <IoFilter size={18} />
                              {t("filter")}
                            </button>
                          )}
                          <p className="text-sm font-medium text-gray-500">
                            <span className="font-bold text-foreground">
                              {totalProducts}
                            </span>{" "}
                            {t("products_found")}
                          </p>
                        </div>
                        <div className="flex justify-between items-center gap-3 order-2 md:order-2 ">
                          <div className="flex flex-1 md:flex-none  gap-2 items-center">
                            <p className="hidden sm:block text-sm text-nowrap font-medium text-gray-500">
                              {t("sortBy")}
                            </p>
                            <Select
                              onValueChange={sortProduct}
                              value={filter?.sort_filter}
                            >
                              <SelectTrigger className="w-full md:w-[150px] lg:w-[200px] h-10 buttonBackground border-none rounded-lg font-medium">
                                <SelectValue placeholder={t("default")} />
                              </SelectTrigger>
                              <SelectContent className="w-[180px] md:w-[150px] lg:w-[200px] h-full z-30">
                                <SelectItem value="default">
                                  {t("default")}
                                </SelectItem>
                                <SelectItem value="new">
                                  {t("newest_first")}
                                </SelectItem>
                                <SelectItem value="price_high">
                                  {t("high_to_low")}
                                </SelectItem>
                                <SelectItem value="price_low">
                                  {t("low_to_high")}
                                </SelectItem>
                                <SelectItem value="discount">
                                  {t("discount_high_to_low")}
                                </SelectItem>
                                <SelectItem value="popular">
                                  {t("popularity")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* View switcher. Desktop only. Tablet (md–lg) shows just
                            list + 2 + 3 cols; the 4/5 buttons appear at xl where
                            the grid is wide enough to render those without
                            squeezing the cards. FLIP-animates the grid. */}
                          <div className="hidden md:flex items-center gap-1 buttonBackground rounded-lg p-1">
                            <button
                              type="button"
                              aria-label="list view"
                              aria-pressed={isList}
                              onClick={() => setViewMode("list")}
                              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                isList
                                  ? "primaryBackColor text-white shadow-sm"
                                  : "text-gray-500 hover:text-foreground"
                              }`}
                            >
                              <FaThList size={15} />
                            </button>
                            {[2, 3, 4, 5].map((cols) => (
                              <button
                                key={cols}
                                type="button"
                                aria-label={`${cols} columns`}
                                aria-pressed={!isList && viewMode === cols}
                                onClick={() => setViewMode(cols)}
                                className={`h-8 w-8 items-center justify-center rounded-md transition ${
                                  cols >= 4 ? "hidden xl:flex" : "flex"
                                } ${
                                  !isList && viewMode === cols
                                    ? "primaryBackColor text-white shadow-sm"
                                    : "text-gray-500 hover:text-foreground"
                                }`}
                              >
                                <ColumnsIcon count={cols} size={16} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Category drill bar (breadcrumb + sub-category chip strip)
                    removed — the sidebar CategoryTree owns category navigation. */}
                  <LayoutGroup>
                    <div
                      className={`grid gap-4 auto-rows-min ${
                        isList
                          ? // List = horizontal cards: 1 mobile/tablet, 2 at lg, 3 at xl.
                            // Pure Tailwind — do NOT use product-grid-cols here (its
                            // media rule would force cols and overflow the rows).
                            "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
                          : // Grid = vertical cards: base 2 cols, product-grid-cols
                            // media rule drives the chosen 2/3/4/5 (capped per bp).
                            "product-grid-cols grid-cols-2"
                      }`}
                      style={
                        isList
                          ? undefined
                          : ({
                              // CSS var consumed by the product-grid-cols @media rule.
                              "--grid-cols": gridCols,
                            } as React.CSSProperties)
                      }
                    >
                      {loading ? (
                        placeholderItems.map((index: number) => (
                          <div key={index}>
                            {/* Match the card shape being loaded: a 300px block is
                            right for the vertical grid card but far too tall for
                            a list row, so list view showed stacked blocks that
                            looked nothing like what arrived. */}
                            <CardSkeleton
                              height={300}
                              variant={isList ? "list" : "block"}
                            />
                          </div>
                        ))
                      ) : isError && productResult?.length <= 0 ? (
                        <div className="col-span-full grid place-items-center gap-3 py-16 text-center">
                          <p className="font-semibold text-base fontColor">
                            {t("something_went_wrong") ||
                              "Something went wrong"}
                          </p>
                          <button
                            type="button"
                            onClick={() => refetch()}
                            className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
                          >
                            {t("retry") || t("try_again") || "Retry"}
                          </button>
                        </div>
                      ) : productResult?.length <= 0 ? (
                        <NotFound
                          image={NoOrderSvg}
                          title={t("no_products_found")}
                          className="col-span-full"
                        />
                      ) : (
                        // eslint-disable-next-line react-hooks/refs -- intentional: prevCountRef.current read at render time to decide per-card fade-in (see comment below)
                        productResult?.map((product: any, index: number) => {
                          const adapted = adaptProduct(product);
                          // Cards from a freshly loaded page fade in; already-visible
                          // cards don't re-animate (index >= prevCount = new arrivals).
                          const isNew = index >= prevCountRef.current;
                          return (
                            // layout FLIP animates position/size ONLY on view-mode
                            // (column) change — layoutDependency={viewMode} stops it
                            // re-measuring on every page append (the scroll "jump").
                            // Key is product.id so cards never remount across switches.
                            <motion.div
                              key={product?.id}
                              layout="position"
                              layoutDependency={viewMode}
                              initial={isNew ? { opacity: 0, y: 16 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.3,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              {isList ? (
                                <ListViewProductCard product={adapted} />
                              ) : (
                                <VerticleProductCard product={adapted} />
                              )}
                            </motion.div>
                          );
                        })
                      )}

                      {isLoadMoreLoading
                        ? placeholderItems.map((index: number) => (
                            <motion.div
                              key={`more-${index}`}
                              initial={{ opacity: 0, y: 24, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                duration: 0.4,
                                ease: [0.22, 1, 0.36, 1],
                                // Stagger by index so cards cascade in wave, not all at once.
                                delay: (index % 6) * 0.06,
                              }}
                            >
                              <CardSkeleton
                                height={300}
                                variant={isList ? "list" : "block"}
                              />
                            </motion.div>
                          ))
                        : null}
                      {/* Infinite-scroll sentinel: triggers next-page load when scrolled into view. */}
                      {hasNextPage && (
                        <div
                          ref={loadMoreRef}
                          className="col-span-full h-1 w-full"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </LayoutGroup>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!hideFilter && (
        <FilterDrawer
          showFilter={showFilter}
          setShowFilter={setShowFilter}
          setProductResult={setProductResult}
          setOffset={setOffset}
          minPrice={minPrice}
          maxPrice={maxPrice}
          values={values}
          setValues={setValues}
          setMaxPrice={setMaxPrice}
          setMinPrice={setMinPrice}
        />
      )}
    </section>
  );
};

export default Products;
