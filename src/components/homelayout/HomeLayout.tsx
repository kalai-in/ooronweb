"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tabIdFromSlug, slugFromTabId } from "@/utils/categoryTabSlug";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  setLayoutTheme,
  setSelectedCategoryId as setSelectedCategoryIdAction,
} from "@/redux/slices/shopModeSlice";
// Section components split into their own chunks (ssr stays on, so markup/LCP
// timing is unchanged) — the sections mix is server-driven per request, so
// every type is a "could be first" candidate and none can be dropped eagerly.
const TextSection = dynamic(() => import("./sections/TextSection"));
const ProductSliderSection = dynamic(
  () => import("./sections/ProductSliderSection"),
);
const BannerSliderSection = dynamic(
  () => import("./sections/BannerSliderSection"),
  {
    // Reserves the banner's typical box (API's default aspect ratio) before
    // the chunk arrives — without this the section is 0-height until the
    // dynamic import resolves, then pops in and shifts every section below
    // it (a forced-reflow/CLS source flagged by PageSpeed).
    loading: () => (
      <div className="w-full aspect-[1200/650] animate-pulse bg-black/5" />
    ),
  },
);
const CategorySection = dynamic(() => import("./sections/CategorySection"));
const BrandSection = dynamic(() => import("./sections/BrandSection"));
const GridBannerSection = dynamic(
  () => import("./sections/GridBannerSection"),
);
const TitleImageSection = dynamic(
  () => import("./sections/TitleImageSection"),
);
import HomeSkeleton from "../homepage/HomeSkeleton";
import CategoryTabs from "../categories/CategoryTabs";
import { toCssRadius, toCssRadiusCorners } from "@/utils/helperFunction";
import Loader from "../loader/Loader";
import BackToTop from "../backtotop/BackToTop";
// Rarely used (demo_mode off by default) — lazy-load to trim the bundle.
const DemoBuyNow = dynamic(() => import("../demo/DemoBuyNow"), { ssr: false });

// Exceptional-state-only components — lazy-load so the happy path skips their bytes.
const Location = dynamic(() => import("../locationmodal/Location"), {
  ssr: false,
});
const StoreClosed = dynamic(
  () => import("@/components/store-closed/StoreClosed"),
);
const StoreClosedBanner = dynamic(
  () => import("@/components/store-closed/StoreClosedBanner"),
);
const NotFound = dynamic(() => import("../notfound/NotFound"));
import NoProductSvg from "@/assets/empty-state/no-product.svg";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import { HOME_LAYOUT_INITIAL_SECTION_LIMIT } from "@/constants/homeLayout";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";

// Must match shopModeSlice's initial `mode` or the SSR query key mismatches on hydration.
const SHOP_MODE_SSR_DEFAULT = "quick";

// Marks the first block of the first section eager (not lazy) so it's the LCP element.
const renderBlock = (
  block: any,
  sectionRadius: string | number | undefined,
  device: string,
  resolveCategoryTree: () => Promise<any[]>,
  isLcpCandidate = false,
) => {
  switch (block?.type) {
    case "text_section":
      return (
        <TextSection
          block={block}
          borderRadius={sectionRadius}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "product_slider":
      return (
        <ProductSliderSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
        />
      );
    case "banner_slider":
      return (
        <BannerSliderSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "grid_banner":
      return (
        <GridBannerSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "title_image":
      return (
        <TitleImageSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
          resolveCategoryTree={resolveCategoryTree}
        />
      );
    case "category_section":
      return (
        <CategorySection
          block={block}
          borderRadius={sectionRadius}
          device={device}
        />
      );
    case "brand_section":
      return (
        <BrandSection block={block} borderRadius={sectionRadius} device={device} />
      );
    default:
      return null;
  }
};

// `initialHomeLayout` is set by getServerSideProps only when the URL resolved a
// zone: { data, latitude, longitude } where the coords are that zone's polygon
// centroid. It exists to put real home content in the server HTML for crawlers.
//
// The centroid is NOT the visitor's location — a returning user has a persisted
// city with its own coords. So this seeds the FIRST render only (matching what
// the server sent, which is what hydration requires), and redux coords take over
// as soon as they exist. That handover is a normal keyed refetch, i.e. exactly
// today's behaviour for a user with a saved city.
interface HomeLayoutProps {
  initialHomeLayout?: any;
}

const HomeLayout = ({ initialHomeLayout = null }: HomeLayoutProps) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const city = useSelector((state: any) => state.City.city);
  const setting = useSelector((state: any) => state.Setting.setting);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  // Read here too (not just inside StoreClosedBanner) so the lazy chunk only loads when needed.
  const storeClosedSoft =
    useSelector((state: any) => state.ShopMode?.storeClosed) === true;
  // Gates `dir` until hydration so it doesn't flip and discard the tree (#418).
  const isHydrated = useIsHydrated();
  // Pre-hydration: use the SSR centroid (matches server, avoids key mismatch). Post-hydration: redux city wins.
  const latitude = !isHydrated
    ? initialHomeLayout?.latitude
    : city?.latitude ||
      setting?.default_city?.latitude ||
      initialHomeLayout?.latitude;
  const longitude = !isHydrated
    ? initialHomeLayout?.longitude
    : city?.longitude ||
      setting?.default_city?.longitude ||
      initialHomeLayout?.longitude;
  // A "category" redirect tile only carries a numeric category_id — the
  // products page's filter sidebar needs a SLUG in the URL to highlight it
  // (see resolveIdCsvToSlugCsv usage in renderBlock below). This tree is the
  // same cached query ProductFilter.tsx uses, so a same-session visit to
  // /products warms this cache instead of adding a new fetch.
  const { resolveCategoryTree } = useFullCategoryTree({
    latitude,
    longitude,
    languageId: language?.id,
  });
  // Pinned to the SSR value (initialHomeLayout.shopMode, may differ from the slice default) until hydration.
  const ssrShopMode = initialHomeLayout?.shopMode || SHOP_MODE_SSR_DEFAULT;
  const persistedShopMode = useSelector((state: any) => state.ShopMode.mode);
  const shopMode = isHydrated ? persistedShopMode : ssrShopMode;
  const prevShopMode = useRef(shopMode);

  // Selected tab: null = backend's first tab. The URL (?tab=) is the
  // shareable/SSR-visible source of truth, but next/navigation's
  // useSearchParams() only updates a render or more AFTER router.push()
  // resolves — deriving selectedCategoryId from it alone meant a tab click
  // dispatched to redux immediately, yet the query key (and so isFetching/
  // the skeleton gate below) stayed on the OLD tab for that whole window,
  // during which the previous tab's full content kept rendering as if
  // nothing had happened. redux's selectedCategoryId updates synchronously
  // with the click (same render, via useSelector) and wins here whenever it
  // disagrees with the URL — closing that window. The URL param remains the
  // fallback for the very first render of a shared/refreshed link, before
  // any click has happened to populate redux.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabSlugParam = searchParams?.get("tab") ?? null;
  // Gated on isHydrated like latitude/longitude/shopMode above: redux-persist
  // can rehydrate a tab picked in a PRIOR session before React's hydration
  // walk commits, so reading this unconditionally let the client's first
  // render see a different selectedCategoryId than the server did (which
  // always starts from a fresh store) — a different query key meant the
  // initialData match below (line ~291) failed on the client but had
  // succeeded on the server, so the client fell back to isLoading/HomeSkeleton
  // while the server had rendered full content: a hydration mismatch.
  const persistedReduxCategoryId = useSelector(
    (state: any) => state.ShopMode?.selectedCategoryId,
  );
  const reduxCategoryId = isHydrated ? persistedReduxCategoryId : undefined;
  // Slug→id needs the tab list, which arrives with the data — fall back to the SSR-resolved id until then.
  const ssrCategoryId = initialHomeLayout?.categoryId ?? null;
  // Tab list to resolve ?tab= against, filtered to the current shopMode (each channel has its own list, same cache namespace).
  const knownTabs =
    (queryClient
      .getQueriesData({ queryKey: ["home-layout"] }) as any[])
      .filter(([key]: any) => key?.[5] === shopMode)
      .map(([, entry]: any) => entry?.category_tabs)
      .find((tabs: any) => Array.isArray(tabs) && tabs.length > 0) ||
    // SSR seed only valid while still on the channel the server actually rendered with.
    (shopMode === ssrShopMode
      ? initialHomeLayout?.data?.category_tabs
      : null) ||
    [];
  const resolvedFromUrl = tabIdFromSlug(knownTabs, tabSlugParam);
  const urlCategoryId = tabSlugParam ? (resolvedFromUrl ?? ssrCategoryId) : null;
  const selectedCategoryId =
    reduxCategoryId !== undefined && reduxCategoryId !== null
      ? reduxCategoryId
      : urlCategoryId;

  // Tab pick → dispatch first (updates selectedCategoryId, and so the query
  // key above, on THIS render), then push the slug into the URL so it stays
  // shareable/refreshable. Order matters: the URL push is async from
  // next/navigation's perspective, the dispatch is not.
  const setSelectedCategoryId = (id: any) => {
    dispatch(setSelectedCategoryIdAction(id));
    const slug = slugFromTabId(knownTabs, id);

    // pathname (not router.pathname, which doesn't exist on next/navigation's
    // router) carries the real zone/lang segments — middleware rewrites those
    // onto "/" as query params, but the visible URL still shows them in the path.
    const visiblePath = pathname || "/";
    const params = new URLSearchParams(searchParams?.toString());
    if (slug) params.set("tab", slug);
    else params.delete("tab");
    // zone/lang belong in the path; drop them if they leak through as query params.
    params.delete("zone");
    params.delete("lang");
    const search = params.toString();
    const nextUrl = search ? `${visiblePath}?${search}` : visiblePath;

    // scroll:false stops Next's scroll-restoration fighting the push; the
    // explicit scrollTo replaces it. push (not replace), matching the
    // original: each tab pick is its own history entry so Back steps through
    // tabs, same as Pages Router's shallow push did.
    router.push(nextUrl, { scroll: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const [modeSwitching, setModeSwitching] = useState(false);

  // Sections beyond the first page (limit=6, offset=0) are fetched from the API
  // as the sentinel scrolls into view: offset=6, then 12, then 18, ... appending
  // each response's sections to `extraSections`. `nextOffset` doubles as the
  // in-flight/duplicate guard — null means "no fetch in flight and nothing more
  // to load"; a fetch sets it to undefined-not-applicable via isFetchingMore below.
  const [extraSections, setExtraSections] = useState<any[]>([]);
  const [hasMoreSections, setHasMoreSections] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  // Offset already requested or in flight — prevents the observer from firing
  // a second fetch for the same page (e.g. rapid resize/repaint re-triggers).
  const fetchedOffsetsRef = useRef<Set<number>>(new Set([0]));
  // State (not useRef) so the observer effect below re-runs the instant the
  // sentinel node mounts. On the SSR-seeded first paint, initialData means
  // isLoading/isFetching are already false on render 1 — none of the effect's
  // other deps (hasMoreSections/latitude/longitude/etc.) change again after
  // mount, so a plain ref left the effect racing DOM commit: if it ran before
  // the <div ref=...> attached, no later dep change ever gave it a second
  // chance to observe, and "load more" stayed permanently dead for that
  // session. A state setter in the ref callback guarantees a re-render (and
  // so a re-run of the effect) once the node genuinely exists.
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(
    null,
  );

  // Device bucket for home_layout: <768 app, 768-1024 tablet, >1024 web. Starts from SSR's UA guess, corrected on mount.
  const [device, setDevice] = useState(initialHomeLayout?.device || "web");
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      let next = "web";
      if (w < 768) next = "app";
      else if (w <= 1024) next = "tablet";
      setDevice(next);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Shop mode switch: clear the tab (each mode has its own list) and invalidate the new mode's query.
  useEffect(() => {
    if (prevShopMode.current === shopMode) return;
    // First flip is redux catching up post-hydration, not a real switch — just record the baseline.
    prevShopMode.current = shopMode;
    if (!isHydrated) return;
    // intentional: resets tab + starts the mode-switch loader in sync with the
    // shopMode change that triggered this effect (see comment above).
    setSelectedCategoryId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts mode-switch loader in sync with the shopMode change that triggered this effect
    setModeSwitching(true);
    queryClient.invalidateQueries({
      queryKey: [
        "home-layout",
        latitude,
        longitude,
        language?.id,
        null,
        shopMode,
      ],
    });
    // setSelectedCategoryId is redefined every render (closes over router/knownTabs,
    // neither memoized) — adding it here would re-run this effect on unrelated
    // renders instead of only on a real shop-mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopMode, isHydrated, queryClient, latitude, longitude, language?.id]);

  const { data, isLoading, isFetching } = useQuery({
    // device IS part of this key — backend now returns a device-specific
    // layout, so a bucket change (e.g. resize across the 768/1024 breakpoints)
    // must refetch instead of reusing another bucket's cached response.
    queryKey: [
      "home-layout",
      latitude,
      longitude,
      language?.id,
      selectedCategoryId,
      shopMode,
      device,
    ],
    queryFn: async () => {
      const response = await api.getHomeLayout({
        latitude,
        longitude,
        category_id: selectedCategoryId,
        limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
        offset: 0,
        device,
      });
      // status:0 = store closed; sentinel so it survives React Query caching (a setState would be skipped on cache hits).
      if (response?.status === 0 && response?.message) {
        return { storeClosed: true, message: response.message };
      }
      return response?.data ?? null;
    },
    enabled: !!(latitude && longitude),
    // Only seed initialData when every key segment matches what the server actually fetched with — else refetch normally.
    initialData:
      initialHomeLayout &&
      latitude === initialHomeLayout.latitude &&
      longitude === initialHomeLayout.longitude &&
      String(selectedCategoryId ?? "") === String(ssrCategoryId ?? "") &&
      shopMode === ssrShopMode
        ? initialHomeLayout.data
        : undefined,
    placeholderData: (prev: any) => prev,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // isFetching (not queryFn) reliably clears the mode-switch loader whether data came from network or cache.
  useEffect(() => {
    if (!isFetching && modeSwitching) {
      // intentional: clears the mode-switch loader once the query settles —
      // see comment above (isFetching is the reliable signal, not queryFn).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeSwitching(false);
    }
  }, [isFetching, modeSwitching]);

  // Channel config/delivery labels are dispatched by Layout.jsx globally. Header theme is the exception —
  // it's per-category and only available here, so dispatch it without an extra request.
  useEffect(() => {
    const tabs = data?.category_tabs;
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    const activeId = selectedCategoryId ?? tabs[0]?.id;
    const activeTab = tabs.find((tab: any) => String(tab?.id) === String(activeId));
    const theme = activeTab?.background_theme ? activeTab : data?.layout;
    if (theme) dispatch(setLayoutTheme(theme));
  }, [data?.category_tabs, data?.layout, selectedCategoryId, dispatch]);

  // Warms one tab's cache on demand (hover/focus on its strip button, or the
  // idle warm-up below) so clicking it is a cache hit instead of a fresh
  // request. Fire-and-forget: no loading state tied to it, and prefetchQuery
  // no-ops for a key that's already cached and fresh.
  const prefetchTab = useCallback(
    (tabId: any) => {
      if (tabId == null || !latitude || !longitude) return;
      queryClient.prefetchQuery({
        queryKey: [
          "home-layout",
          latitude,
          longitude,
          language?.id,
          tabId,
          shopMode,
          device,
        ],
        queryFn: async () => {
          const response = await api.getHomeLayout({
            latitude,
            longitude,
            category_id: tabId,
            limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
            offset: 0,
            device,
          });
          if (response?.status === 0 && response?.message) {
            return { storeClosed: true, message: response.message };
          }
          return response?.data ?? null;
        },
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient, latitude, longitude, language?.id, shopMode, device],
  );

  // Idle warm-up for the few tabs adjacent to the active one. Previously this
  // fired one request per tab in a single burst (N-1 simultaneous home_layout
  // calls, doubled again by StrictMode in dev) and — because its dep was the
  // `data.category_tabs` array reference, which react-query hands back fresh
  // on every result — re-ran that whole burst on EVERY tab click. Keyed on a
  // stable id string now, and capped: the rest are prefetched on hover.
  const rawCategoryTabs = data?.category_tabs;
  const tabIdsKey = useMemo(
    () =>
      Array.isArray(rawCategoryTabs)
        ? rawCategoryTabs.map((tab: any) => tab?.id).join(",")
        : "",
    [rawCategoryTabs],
  );
  useEffect(() => {
    const tabs = data?.category_tabs;
    if (!Array.isArray(tabs) || tabs.length <= 1) return;
    const activeId = selectedCategoryId ?? tabs[0]?.id;
    const activeIndex = tabs.findIndex(
      (tab: any) => String(tab?.id) === String(activeId),
    );
    // Only the immediate neighbours — the overwhelmingly likely next click.
    const neighbours = [tabs[activeIndex - 1], tabs[activeIndex + 1]].filter(
      Boolean,
    );
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (window as any).requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 400);
    const cancelIdle =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? (window as any).cancelIdleCallback
        : clearTimeout;
    const handle = idle(() => {
      neighbours.forEach((tab: any) => prefetchTab(tab.id));
    });
    return () => cancelIdle(handle);
    // tabIdsKey (a stable string) stands in for the unstable tabs array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIdsKey, selectedCategoryId, prefetchTab]);

  // First tab is deliberately NOT written to state on load — that would change the query key and refetch.
  // activeTabId (below) fixes the highlight at render time instead.

  // New page-1 result (tab click, mode switch, fresh data) drops any previously
  // paged-in sections and restarts pagination from offset=6.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination bookkeeping in response to selectedCategoryId/shopMode/data changing; not derivable from render
    setExtraSections([]);
    setHasMoreSections(true);
    setIsFetchingMore(false);
    fetchedOffsetsRef.current = new Set([0]);
  }, [selectedCategoryId, shopMode, data]);

  const firstPageSectionCount = data?.layout?.sections?.length ?? 0;

  // Sentinel div below the last rendered section fetches the next offset page
  // on scroll: offset=6, 12, 18, ... appended to extraSections. Guards:
  // - fetchedOffsetsRef dedupes so the same offset never fetches twice (a
  //   resize/repaint can re-fire the observer while a fetch is in flight).
  // - hasMoreSections stops once a page comes back short of a full limit.
  useEffect(() => {
    const node = loadMoreNode;
    if (!node || !hasMoreSections || !latitude || !longitude) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isFetchingMore) return;
        const offset = firstPageSectionCount + extraSections.length;
        if (fetchedOffsetsRef.current.has(offset)) return;
        fetchedOffsetsRef.current.add(offset);
        setIsFetchingMore(true);
        api
          .getHomeLayout({
            latitude,
            longitude,
            category_id: selectedCategoryId,
            limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
            offset,
            device,
          })
          .then((response: any) => {
            const nextSections = response?.data?.layout?.sections ?? [];
            const totalSections = response?.data?.total_sections;
            // Exact check when the API reports it: stop once offset + this
            // page's count reaches the real total, instead of guessing from a
            // short page (a short page is also valid mid-stream if the
            // backend ever returns fewer than `limit` for reasons other than
            // "this is the last page"). Falls back to the old short-page
            // heuristic only if total_sections is missing from the response.
            const hasMore =
              typeof totalSections === "number"
                ? offset + nextSections.length < totalSections
                : nextSections.length >= HOME_LAYOUT_INITIAL_SECTION_LIMIT;
            if (!hasMore) {
              setHasMoreSections(false);
            }
            if (nextSections.length > 0) {
              // Backend pagination can return a section id that already
              // appeared on an earlier offset page — filter those out so
              // React keys (keyed by section.id) stay unique.
              setExtraSections((prev) => {
                const seenIds = new Set([
                  ...(data?.layout?.sections ?? []).map((s: any) => s?.id),
                  ...prev.map((s: any) => s?.id),
                ]);
                const deduped = nextSections.filter(
                  (s: any) => !seenIds.has(s?.id),
                );
                return [...prev, ...deduped];
              });
            }
          })
          .finally(() => setIsFetchingMore(false));
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // data?.layout?.sections is read only inside the dedupe Set at fetch time
    // (always the latest closure value via `data` itself not being a dep) —
    // adding it here would re-run the observer setup on every page-1 refetch,
    // which is unrelated to what actually changes: whether there's more to
    // load and where the next offset starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadMoreNode,
    hasMoreSections,
    isFetchingMore,
    firstPageSectionCount,
    extraSections.length,
    latitude,
    longitude,
    selectedCategoryId,
    device,
  ]);

  // No resolved location: keep the query disabled and force the Location modal open.
  if (!latitude || !longitude) {
    return (
      <div className="min-h-[60vh]">
        <Location showLocation={true} setShowLocation={() => {}} />
      </div>
    );
  }

  if (isLoading && !data) return <HomeSkeleton />;

  if (modeSwitching && isFetching) return <Loader screen="full" />;

  if (data?.storeClosed) {
    return <StoreClosed />;
  }

  const layout = data?.layout;
  const sections = [...(layout?.sections || []), ...extraSections];
  const isCategoryWise = data?.home_type === "category_wise";
  const categoryTabs = isCategoryWise ? data?.category_tabs || [] : [];

  // Derived, never stored (see note above the query).
  const activeTabId = selectedCategoryId ?? categoryTabs[0]?.id ?? null;

  // No sections and no tabs to keep the bar alive → render nothing.
  if (sections.length === 0 && categoryTabs.length === 0) return null;

  // Tab-switch skeleton (sections only, tab strip stays mounted). Gated on isHydrated so SSR/crawlers never see it.
  const isSwitchingTab = isHydrated && isFetching && !modeSwitching;

  const backgroundStyle: React.CSSProperties = {};
  if (layout?.text_color) {
    backgroundStyle.color = layout.text_color;
  }

  return (
    <div style={backgroundStyle} dir={isHydrated ? language?.type : undefined}>
      <CategoryTabs
        categories={categoryTabs}
        selectedId={activeTabId}
        onSelect={setSelectedCategoryId}
        device={device}
      />

      {storeClosedSoft && <StoreClosedBanner />}

      <AnimatePresence mode="wait">
      {isSwitchingTab ? (
        // Tab strip stays mounted/interactive while sections show a skeleton.
        <motion.div
          key="skeleton"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <HomeSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {sections.length === 0 && (
            <div className="container flex items-center justify-center min-h-[70vh]">
              <NotFound
                image={NoProductSvg}
                title={t("no_data_found")}
                size={400}
                className="!py-0 [&_img]:!max-w-[400px] [&_svg]:!max-w-[400px] [&_img]:!w-full [&_svg]:!w-full"
              />
            </div>
          )}
          {sections.map((section: any, sectionIndex: number) => {
            // API moved from a flat `border_radius` number to a per-corner
            // `border_radius_corners` object ({top_left, top_right,
            // bottom_left, bottom_right}) — prefer the new shape, falling
            // back to the old one for any response that hasn't switched yet.
            const sectionRadius =
              toCssRadiusCorners(section?.border_radius_corners) ??
              toCssRadius(section?.border_radius);
            // full_width banner breaks out of .container to span viewport edge-to-edge
            const isFullBleed =
              section?.blocks?.[0]?.type === "banner_slider" &&
              section?.blocks?.[0]?.config?.carousel_style === "full_width";
            // Sections past the first page arrived from a "load more" fetch —
            // fade+slide them in so appending doesn't pop the layout instantly.
            // initial={false} for page-1 sections: they're already on screen,
            // never re-run the entrance (matches ProductsList's isNew pattern).
            const isPaginatedIn = sectionIndex >= firstPageSectionCount;
            return (
              <motion.div
                key={section?.id}
                className={isFullBleed ? "w-full" : "container"}
                initial={isPaginatedIn ? { opacity: 0, y: 24 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  marginTop: section?.margin_top || undefined,
                  marginBottom: section?.margin_bottom || undefined,
                  borderRadius: sectionRadius,
                  overflow: sectionRadius ? "hidden" : undefined,
                }}
              >
                {(section?.blocks || []).map((block: any, blockIndex: number) => (
                  <React.Fragment key={block?.id}>
                    {renderBlock(
                      block,
                      sectionRadius,
                      device,
                      resolveCategoryTree,
                      sectionIndex === 0 && blockIndex === 0,
                    )}
                  </React.Fragment>
                ))}
              </motion.div>
            );
          })}
          {hasMoreSections && (
            <div ref={setLoadMoreNode} aria-hidden="true">
              <AnimatePresence>
                {isFetchingMore && (
                  <motion.div
                    key="load-more-skeleton"
                    className="container my-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton width={180} height={24} />
                      <Skeleton width={100} height={24} />
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-4">
                      {Array(5)
                        .fill(0)
                        .map((_, index) => (
                          <div key={index} className="min-w-[200px] flex-shrink-0">
                            <Skeleton height={180} className="mb-2 rounded-md" />
                            <Skeleton width="80%" height={16} className="mb-1" />
                            <Skeleton width="50%" height={16} className="mb-1" />
                            <div className="flex justify-between items-center">
                              <Skeleton width={60} height={20} />
                              <Skeleton width={40} height={20} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
      <BackToTop />
      {/* Renders itself only when the settings API reports demo_mode: "1". */}
      <DemoBuyNow />
    </div>
  );
};

export default HomeLayout;
