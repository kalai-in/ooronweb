import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tabIdFromSlug, slugFromTabId } from "@/utils/categoryTabSlug";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  setLayoutTheme,
  setSelectedCategoryId as setSelectedCategoryIdAction,
} from "@/redux/slices/shopModeSlice";
import TextSection from "./sections/TextSection";
import ProductSliderSection from "./sections/ProductSliderSection";
import BannerSliderSection from "./sections/BannerSliderSection";
import CategorySection from "./sections/CategorySection";
import BrandSection from "./sections/BrandSection";
import GridBannerSection from "./sections/GridBannerSection";
import TitleImageSection from "./sections/TitleImageSection";
import HomeSkeleton from "../homepage/HomeSkeleton";
import CategoryTabs from "../categories/CategoryTabs";
import { toCssRadius } from "@/utils/helperFunction";
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

// Must match shopModeSlice's initial `mode` or the SSR query key mismatches on hydration.
const SHOP_MODE_SSR_DEFAULT = "quick";

// Marks the first block of the first section eager (not lazy) so it's the LCP element.
const renderBlock = (block, sectionRadius, device, isLcpCandidate = false) => {
  switch (block?.type) {
    case "text_section":
      return <TextSection block={block} />;
    case "product_slider":
      return (
        <ProductSliderSection block={block} borderRadius={sectionRadius} />
      );
    case "banner_slider":
      return (
        <BannerSliderSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
        />
      );
    case "grid_banner":
      return (
        <GridBannerSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
        />
      );
    case "title_image":
      return (
        <TitleImageSection
          block={block}
          borderRadius={sectionRadius}
          device={device}
          priority={isLcpCandidate}
        />
      );
    case "category_section":
      return <CategorySection block={block} borderRadius={sectionRadius} />;
    case "brand_section":
      return <BrandSection block={block} borderRadius={sectionRadius} />;
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
const HomeLayout = ({ initialHomeLayout = null }) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const city = useSelector((state) => state.City.city);
  const setting = useSelector((state) => state.Setting.setting);
  const language = useSelector((state) => state.Language.selectedLanguage);
  // Read here too (not just inside StoreClosedBanner) so the lazy chunk only loads when needed.
  const storeClosedSoft =
    useSelector((state) => state.ShopMode?.storeClosed) === true;
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
  // Pinned to the SSR value (initialHomeLayout.shopMode, may differ from the slice default) until hydration.
  const ssrShopMode = initialHomeLayout?.shopMode || SHOP_MODE_SSR_DEFAULT;
  const persistedShopMode = useSelector((state) => state.ShopMode.mode);
  const shopMode = isHydrated ? persistedShopMode : ssrShopMode;
  const prevShopMode = useRef(shopMode);

  // Selected tab: null = backend's first tab. Source of truth is the URL (?tab=), not redux — keeps SSR/CSR in sync.
  const router = useRouter();
  const tabSlugParam =
    typeof router.query.tab === "string" ? router.query.tab : null;
  // Slug→id needs the tab list, which arrives with the data — fall back to the SSR-resolved id until then.
  const ssrCategoryId = initialHomeLayout?.categoryId ?? null;
  // Tab list to resolve ?tab= against, filtered to the current shopMode (each channel has its own list, same cache namespace).
  const knownTabs =
    queryClient
      .getQueriesData({ queryKey: ["home-layout"] })
      .filter(([key]) => key?.[5] === shopMode)
      .map(([, entry]) => entry?.category_tabs)
      .find((tabs) => Array.isArray(tabs) && tabs.length > 0) ||
    // SSR seed only valid while still on the channel the server actually rendered with.
    (shopMode === ssrShopMode
      ? initialHomeLayout?.data?.category_tabs
      : null) ||
    [];
  // URL wins once tabs are known; before that, mirror the server's own resolution.
  const resolvedFromUrl = tabIdFromSlug(knownTabs, tabSlugParam);
  const selectedCategoryId = tabSlugParam
    ? (resolvedFromUrl ?? ssrCategoryId)
    : null;

  // Tab pick → push the slug into the URL (shallow, no gSSP re-run); redux stays in sync for the rest of the app.
  const setSelectedCategoryId = (id) => {
    dispatch(setSelectedCategoryIdAction(id));
    const slug = slugFromTabId(knownTabs, id);

    // asPath (not router.pathname) carries the real zone/lang segments — middleware rewrites those onto "/" as query params.
    const [visiblePath] = router.asPath.split("?");
    const params = new URLSearchParams(router.asPath.split("?")[1] || "");
    if (slug) params.set("tab", slug);
    else params.delete("tab");
    // zone/lang belong in the path; drop them if they leak through as query params.
    params.delete("zone");
    params.delete("lang");
    const search = params.toString();
    const nextUrl = search ? `${visiblePath}?${search}` : visiblePath;

    // Both args must be the visible URL, or Next resolves the push against the rewritten "/" and loses the zone.
    // scroll:false stops Next's scroll-restoration fighting the shallow push; the explicit scrollTo replaces it.
    router.push(nextUrl, nextUrl, { shallow: true, scroll: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const [modeSwitching, setModeSwitching] = useState(false);

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
    setSelectedCategoryId(null);
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
      shopMode === ssrShopMode &&
      device === initialHomeLayout.device
        ? initialHomeLayout.data
        : undefined,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // isFetching (not queryFn) reliably clears the mode-switch loader whether data came from network or cache.
  useEffect(() => {
    if (!isFetching && modeSwitching) {
      setModeSwitching(false);
    }
  }, [isFetching, modeSwitching]);

  // Channel config/delivery labels are dispatched by Layout.jsx globally. Header theme is the exception —
  // it's per-category and only available here, so dispatch it without an extra request.
  useEffect(() => {
    const tabs = data?.category_tabs;
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    const activeId = selectedCategoryId ?? tabs[0]?.id;
    const activeTab = tabs.find((tab) => String(tab?.id) === String(activeId));
    const theme = activeTab?.background_theme ? activeTab : data?.layout;
    if (theme) dispatch(setLayoutTheme(theme));
  }, [data?.category_tabs, data?.layout, selectedCategoryId, dispatch]);

  // First tab is deliberately NOT written to state on load — that would change the query key and refetch.
  // activeTabId (below) fixes the highlight at render time instead.

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
    return <StoreClosed message={data.message} />;
  }

  const layout = data?.layout;
  const sections = layout?.sections || [];
  const isCategoryWise = data?.home_type === "category_wise";
  const categoryTabs = isCategoryWise ? data?.category_tabs || [] : [];

  // Derived, never stored (see note above the query).
  const activeTabId = selectedCategoryId ?? categoryTabs[0]?.id ?? null;

  // No sections and no tabs to keep the bar alive → render nothing.
  if (sections.length === 0 && categoryTabs.length === 0) return null;

  // Tab-switch skeleton (sections only, tab strip stays mounted). Gated on isHydrated so SSR/crawlers never see it.
  const isSwitchingTab = isHydrated && isFetching && !modeSwitching;

  const backgroundStyle = {};
  if (layout?.text_color) {
    backgroundStyle.color = layout.text_color;
  }

  return (
    <div style={backgroundStyle} dir={isHydrated ? language?.type : undefined}>
      <CategoryTabs
        categories={categoryTabs}
        selectedId={activeTabId}
        onSelect={setSelectedCategoryId}
      />

      {storeClosedSoft && <StoreClosedBanner />}

      {isSwitchingTab ? (
        // Tab strip stays mounted/interactive while sections show a skeleton.
        <div aria-busy="true">
          <HomeSkeleton />
        </div>
      ) : (
        <div>
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
          {sections.map((section, sectionIndex) => {
            const sectionRadius = toCssRadius(section?.border_radius);
            // full_width banner breaks out of .container to span viewport edge-to-edge
            const isFullBleed =
              section?.blocks?.[0]?.type === "banner_slider" &&
              section?.blocks?.[0]?.config?.carousel_style === "full_width";
            return (
              <div
                key={section?.id}
                className={isFullBleed ? "w-full" : "container"}
                style={{
                  marginTop: section?.margin_top || undefined,
                  marginBottom: section?.margin_bottom || undefined,
                  borderRadius: sectionRadius,
                  overflow: sectionRadius ? "hidden" : undefined,
                }}
              >
                {(section?.blocks || []).map((block, blockIndex) => (
                  <React.Fragment key={block?.id}>
                    {renderBlock(
                      block,
                      sectionRadius,
                      device,
                      sectionIndex === 0 && blockIndex === 0,
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <BackToTop />
      {/* Renders itself only when the settings API reports demo_mode: "1". */}
      <DemoBuyNow />
    </div>
  );
};

export default HomeLayout;
