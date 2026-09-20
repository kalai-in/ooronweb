"use client";

import React, { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "./Header";
import Footer from "./Footer";

// Global floating support launcher (client-only — the chat touches window).
const SupportChatWidget = dynamic(
  () => import("../chat/support/SupportChatWidget"),
  { ssr: false },
);
import { setPaymentSetting, setSetting } from "@/redux/slices/settingSlice";
import { setCountrySetting } from "@/redux/slices/countrySettingSlice";
import { useSelector, useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from "react-icons/fi";
import Loader from "../loader/Loader";
import { setFavoriteProductIds } from "@/redux/slices/FavoriteSlice";
import PushNotification from "../firebasenotification/PushNotification";
import LangFile from "@/utils/en.json";
import {
  setAvailableLanguages,
  setSelectedLanguage,
} from "@/redux/slices/languageSlice";
import {
  setChannel,
  setLayoutTheme,
  setDeliveryTime,
  setDeliveryDistance,
  setStoreClosed,
} from "@/redux/slices/shopModeSlice";
import { usePathname } from "next/navigation";
// import { useTheme } from "next-themes";
// MaintanceMode.jsx's JSDoc @param annotations are mis-inferred by tsc as a
// single `string` parameter instead of a `{message, endAt}` props object (a
// pre-existing issue in that untyped file, outside this batch's scope) — cast
// to `any` at this call site so the real (string, string) props still pass
// through unchanged.
import MaintanceModeUntyped from "../error/MaintanceMode";
const MaintanceMode = MaintanceModeUntyped as any;
import MaintenanceNotice from "../error/MaintenanceNotice";
import CookieConsent from "../cookieconsent/CookieConsent";
import { subscribePublicChannel } from "@/lib/chatWs";
import OfflineOverlay from "../offline/OfflineOverlay";
import useZoneUrlSync from "@/hooks/useZoneUrlSync";
import useZoneAdopt from "@/hooks/useZoneAdopt";
import useZoneRequired from "@/hooks/useZoneRequired";
import { HOME_LAYOUT_INITIAL_SECTION_LIMIT } from "@/constants/homeLayout";

// Per-type toast glyph — Feather icon inside an accent-filled coin (styled in globals.css).
const TOAST_ICONS: Record<string, typeof FiInfo> = {
  success: FiCheck,
  error: FiX,
  warning: FiAlertTriangle,
  info: FiInfo,
};
const renderToastIcon = ({ type }: { type?: string }) => {
  const Icon = (type && TOAST_ICONS[type]) || FiInfo;
  return (
    <span className={`appToastIcon appToastIcon--${type || "default"}`}>
      <Icon />
    </span>
  );
};

// Sets --primary-color/--light-primary-color from the theme-appropriate API field, falling back to legacy single-color fields.
const applyPrimaryColor = (webSettings: any, theme?: string) => {
  if (!webSettings) return;
  const root = document.documentElement.style;
  const isDark = theme === "dark";

  const primary = isDark
    ? webSettings.dark_mode_color || webSettings.color
    : webSettings.light_mode_color || webSettings.color;
  const light = isDark
    ? webSettings.dark_mode_color || webSettings.light_color
    : webSettings.light_mode_color || webSettings.light_color;

  if (primary) root.setProperty("--primary-color", primary);
  if (light) root.setProperty("--light-primary-color", light);
};

// Module-level once-per-page-load guards: persist across Layout remounts (route nav), reset on a hard reload.
let __settingsFetched = false;
let __languageFetched = false;
// Last lat/long the zone-based settings (payment/country) were fetched for —
// guards against React StrictMode's dev-only double-invoke AND against
// Header's city-resolve sequence dispatching setCity more than once for the
// same coordinates, both of which re-fire the effect below with an
// unchanged city. Reset happens implicitly: a real coordinate change simply
// produces a different key.
let __fetchedCityCoordsKey: string | null = null;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  // Must run before useZoneUrlSync/useZoneRequired, which read the adopted zone.
  useZoneAdopt();
  useZoneUrlSync();
  // Enforces zone-prefixable routes always carry a zone — redirects to the
  // known zone if one is stored, or forces the location modal open if none
  // is known yet. Must run after useZoneAdopt so a same-render URL zone is
  // already reflected in storedZoneSlug.
  useZoneRequired();
  const pathname = usePathname();
  const dispatch = useDispatch();
  // next-themes' resolvedTheme, not redux — redux's Theme.theme only syncs on toggle, not on load.
  // const { resolvedTheme: theme } = useTheme();
  const theme = "light";
  const setting = useSelector((state: any) => state.Setting);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  const city = useSelector((state: any) => state.City.city);
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  // Must mirror HomeLayout's selected tab so this prefetch shares its react-query cache entry.
  const selectedCategoryId = useSelector(
    (state: any) => state.ShopMode.selectedCategoryId,
  );
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  // const [showLocation, setShowLocation] = useState(false)

  // Client-side favicon override from the settings API — rendered as a real
  // React <link> below (see fetchSetting) rather than raw document DOM
  // manipulation. Every page's own generateMetadata() ALSO renders a
  // rel="icon" <link> via Next's metadata system (see buildMetadata.ts); this
  // one exists on top of that because a settings API response landing after
  // first paint needs to update the icon reactively, which a server-only
  // generateMetadata() can't do. Letting React own this node (instead of a
  // second, raw-DOM writer racing Next's own head management on the same
  // node) is what fixes a reproducible "Cannot read properties of null
  // (reading 'removeChild')" crash on every client-side navigation —
  // confirmed via bisection against a full production build.
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

  // Gates the maintenance branch on mount so server and first client render agree (setting rehydrates after first paint).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // intentional: flips mounted flag exactly once after mount so the
    // maintenance branch agrees with the server on first paint — see comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const fetchLanguage = async () => {
    try {
      const response = await api.getSystemLanguages({
        id: 0,
        isDefault: 0,
        systemType: 3,
      });
      if (response.status == 1) {
        if (response.data !== undefined) {
          if (response?.data?.length == 1) {
            try {
              const langRes = await api.getSystemLanguages({
                id: response?.data?.[0]?.id,
                isDefault: 1,
                systemType: 3,
              });
              if (langRes.status == 1) {
                document.documentElement.dir = (
                  langRes?.data?.type || "ltr"
                ).toLowerCase();
                dispatch(setSelectedLanguage({ data: langRes?.data }));
              } else {
                const language = {
                  id: 15,
                  name: "English",
                  code: "en",
                  type: "LTR",
                  system_type: 3,
                  is_default: 1,
                  json_data: LangFile,
                  display_name: "English",
                  system_type_name: "Website",
                };
                dispatch(setSelectedLanguage({ data: language }));
              }
            } catch (error) {
              console.log("error", error);
            }
          } else if (language == null) {
            const langId = response?.data?.find(
              (lang: any) => lang?.is_default == 1,
            )?.id;
            const langRes = await api.getSystemLanguages({
              id: langId,
              isDefault: 1,
              systemType: 3,
            });
            document.documentElement.dir = (
              langRes?.data?.type || "ltr"
            ).toLowerCase();
            dispatch(setSelectedLanguage({ data: langRes?.data }));
          }
          dispatch(setAvailableLanguages({ data: response.data }));
        } else {
          const language = {
            id: 15,
            name: "English",
            code: "en",
            type: "LTR",
            system_type: 3,
            is_default: 1,
            json_data: LangFile,
            display_name: "English",
            system_type_name: "Website",
          };
          dispatch(setSelectedLanguage({ data: language }));
        }
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const fetchSetting = async () => {
    setLoading(true);
    try {
      const res = await api.getSetting();
      // Settings `data` is now a plain JSON object (was a base64-encoded string before).
      const setting =
        typeof res.data === "string" ? JSON.parse(atob(res.data)) : res.data;
      dispatch(setSetting({ data: setting }));
      if (setting?.favorite_product_ids) {
        dispatch(setFavoriteProductIds({ data: setting.favorite_product_ids }));
      }
      applyPrimaryColor(setting?.web_settings, theme);
      if (setting?.favicon) {
        setFaviconUrl(setting.favicon);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.log("error", error);
    }
  };

  const fetchCountrySetting = async () => {
    try {
      const res = await api.getCountrySetting({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      const data =
        typeof res.data === "string" ? JSON.parse(atob(res.data)) : res.data;
      dispatch(setCountrySetting({ data }));
    } catch (error) {
      console.log("error", error);
    }
  };

  const fetchPaymentSetting = async () => {
    // Endpoint requires lat/long (zone-based gateways). Skip until a city is set.
    if (!city?.latitude || !city?.longitude) return;
    setLoading(true);
    try {
      const res = await api.getPaymentSetting({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      // status 0 = not deliverable here — clear rather than leave the previous zone's gateways showing.
      if (res?.status === 0) {
        dispatch(setPaymentSetting({ data: null }));
      } else {
        dispatch(setPaymentSetting({ data: JSON.parse(atob(res.data)) }));
      }
      setLoading(false);
    } catch (error) {
      dispatch(setPaymentSetting({ data: null }));
      setLoading(false);
      console.log("error", error);
    }
  };

  useEffect(() => {
    // dir/CSS expect lowercase "rtl"/"ltr", API sends "RTL"/"LTR".
    document.documentElement.dir = (language?.type || "ltr").toLowerCase();
  }, [language?.type]);

  useEffect(() => {
    if (!__settingsFetched) {
      __settingsFetched = true;
      // intentional: fetches app settings once globally, module-level guarded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSetting();
    }
    if (!__languageFetched) {
      __languageFetched = true;
      fetchLanguage();
    }
    // fetchSetting/fetchLanguage are re-created every render (close over dispatch/theme/language) —
    // adding them here would re-run this effect on unrelated renders instead of only once per __settingsFetched/__languageFetched guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language?.id]);

  // Zone-based (gateways/country vary by lat/long) — refetch whenever city coords change.
  useEffect(() => {
    if (!city?.latitude || !city?.longitude) return;
    const coordsKey = `${city.latitude},${city.longitude}`;
    if (__fetchedCityCoordsKey === coordsKey) return;
    __fetchedCityCoordsKey = coordsKey;
    // intentional: refetches payment/country settings when city coords change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPaymentSetting();
    fetchCountrySetting();
    // fetchPaymentSetting/fetchCountrySetting are re-created every render (close over city/dispatch) —
    // adding them here would re-fire this effect every render instead of only on lat/long changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.latitude, city?.longitude]);

  useEffect(() => {
    applyPrimaryColor(setting?.setting?.web_settings, theme);
  }, [theme, setting?.setting?.web_settings]);

  // HomeLayout also fetches this but only on the home page — this keeps the Header theme correct on every route.
  useEffect(() => {
    const latitude = city?.latitude || setting?.setting?.default_city?.latitude;
    const longitude =
      city?.longitude || setting?.setting?.default_city?.longitude;
    if (!latitude || !longitude) return;

    let cancelled = false;
    (async () => {
      try {
        // Same react-query key as HomeLayout uses on the home page, so fetchQuery shares its cached result instead of double-fetching.
        const result: any = await queryClient.fetchQuery({
          queryKey: [
            "home-layout",
            latitude,
            longitude,
            language?.id,
            selectedCategoryId ?? null,
            shopMode,
          ],
          queryFn: async () => {
            const response = await api.getHomeLayout({
              latitude,
              longitude,
              category_id: selectedCategoryId ?? null,
              limit: HOME_LAYOUT_INITIAL_SECTION_LIMIT,
              offset: 0,
            });
            // Match HomeLayout's sentinel shape so both consumers read the same cache entry.
            if (response?.status === 0 && response?.message) {
              return { storeClosed: true, message: response.message };
            }
            return response?.data ?? null;
          },
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 30,
        });
        if (cancelled) return;
        // Dispatched before the early return so status:0 (store closed) still updates the flag, not just the happy path.
        dispatch(
          setStoreClosed(result?.store_closed ?? (result?.storeClosed ? 1 : 0)),
        );
        if (!result || result.storeClosed) return;
        const data = result;

        dispatch(
          setChannel({
            ...data.channel,
            layout_mode: data?.layout_mode ?? data?.channel?.layout_mode,
            available_modes:
              data?.available_modes ?? data?.channel?.available_modes,
            requested: data?.requested ?? data?.channel?.requested,
            channel_label_quick:
              data?.quick_button_label ?? data?.channel_label_quick,
            channel_label_ecommerce:
              data?.ecommerce_button_label ?? data?.channel_label_ecommerce,
            zone_id: data?.zone_id,
            zone_slug: data?.zone_slug,
            search_suggestions: data?.search_suggestions,
          }),
        );
        if (data?.layout) dispatch(setLayoutTheme(data.layout));
        if (data?.time_to_deliver)
          dispatch(setDeliveryTime(data.time_to_deliver));
        if (data?.distance) dispatch(setDeliveryDistance(data.distance));
      } catch (error) {
        console.log("shop-mode sync error", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    shopMode,
    selectedCategoryId,
    city?.latitude,
    city?.longitude,
    language?.id,
    setting?.setting?.default_city?.latitude,
    setting?.setting?.default_city?.longitude,
    queryClient,
    dispatch,
  ]);

  // Realtime maintenance-mode toggle; doesn't touch `loading` (unlike fetchSetting) — no full-screen flash on every broadcast.
  useEffect(() => {
    const unsubscribe = subscribePublicChannel(
      "maintenance",
      "maintenance.toggled",
      async () => {
        try {
          const res = await api.getSetting();
          const next =
            typeof res.data === "string"
              ? JSON.parse(atob(res.data))
              : res.data;
          dispatch(setSetting({ data: next }));
          applyPrimaryColor(next?.web_settings, theme);
        } catch (error) {
          console.log("maintenance refresh failed", error);
        }
      },
    );
    return unsubscribe;
    // theme is read at fire time inside the callback — adding it here would resubscribe on every toggle.
     
  }, [dispatch]);

  // Route-change loading is handled once at the _app level, not here.

  const isMaintenanceMode =
    mounted && setting?.setting?.web_settings?.website_mode == 1;

  let content;
  if (loading) {
    content = <Loader screen="full" />;
  } else if (isMaintenanceMode) {
    content = (
      <MaintanceMode
        message={setting?.setting?.web_settings?.website_mode_remark}
        endAt={setting?.setting?.web_settings?.website_mode_end}
      />
    );
  } else {
    content = (
      <PushNotification>
        {/* Heads-up for a scheduled-but-not-live window; the full-screen splash above replaces it once live. */}
        <MaintenanceNotice />

        {/* Scoped to Header alone (not the whole page): Header reads
            useSearchParams(), which Next requires a Suspense boundary above
            for static-prerendering. Providers.tsx used to wrap the entire
            app in one Suspense for this, which meant Header's CSR-bailout
            fallback could blank out the ENTIRE page (including {children} —
            real SEO content like product price/description) whenever Next
            decided to bail Header to client-only rendering. Scoping it here
            means a Header bailout only blanks the header strip; {children}
            still renders fully server-side regardless. */}
        <Suspense fallback={<div className="h-[64px] w-full" />}>
          <Header />
        </Suspense>
        {/* Fills the viewport below the sticky header; payment-status page sizes to its own content instead. */}
        <div
          style={
            pathname === "/web-payment-status"
              ? undefined
              : {
                  minHeight:
                    "calc(100vh - var(--layout-header-h, 0px) - var(--layout-strip-h, 0px))",
                }
          }
        >
          {children}
        </div>
        <Footer />
        {/* Global Myntra-style floating support launcher (logged-in only). */}
        <SupportChatWidget />
        {/* Self-gating on cookie_consent_enabled + whether the visitor already answered. */}
        <CookieConsent />
        <ToastContainer
          theme={theme || "light"}
          rtl={language?.type === "RTL"}
          position={language?.type === "RTL" ? "top-left" : "top-right"}
          autoClose={3000}
          hideProgressBar={true}
          newestOnTop
          closeOnClick
          pauseOnHover
          pauseOnFocusLoss={false}
          draggable
          icon={renderToastIcon}
          className="appToastContainer"
          bodyClassName="appToastBody"
          toastClassName="appToast"
          progressClassName="appToastProgress"
        />
      </PushNotification>
    );
  }

  return (
    <section className="overflow-x-clip">
      {/* React 19 hoists <link>/<meta>/<title> rendered anywhere in the tree
          into <head> automatically — this is the sole owner of this node
          now (see faviconUrl's doc comment above for why the previous raw
          document.* version caused a navigation crash). Omitted entirely
          until a settings response actually supplies one, so it never
          fights the per-page favicon Next's own metadata system renders
          before this effect's fetch resolves. */}
      {faviconUrl && (
        <link
          rel="shortcut icon"
          type="image/x-icon"
          href={faviconUrl}
          sizes="16x16 32x32 64x64"
        />
      )}
      <OfflineOverlay />
      {content}
      {/* <Location showLocation={showLocation} setShowLocation={setShowLocation} /> */}
    </section>
  );
};

export default Layout;
