import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import emptyCartAnim from "@/assets/empty-cart.json";
import shoppingCartAnim from "@/assets/shopping-cart.json";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FaMoon, FaRegUser, FaSun } from "react-icons/fa";
import * as api from "@/api/apiRoutes";
import {
  IoCartOutline,
  IoLocationOutline,
  IoHomeOutline,
  IoHome,
  IoSearchOutline,
  IoLanguage,
  IoHeartOutline,
  IoHeart,
  IoPersonOutline,
  IoPerson,
} from "react-icons/io5";
import { LuUser } from "react-icons/lu";
import { FaPhoneVolume, FaXTwitter } from "react-icons/fa6";
import { RxHamburgerMenu } from "react-icons/rx";
import { MdCategory, MdOutlineCategory } from "react-icons/md";
// Lazy: pulls in Firebase via its own static Login import; only needed after a click.
const CartDrawer = dynamic(() => import("../cart/CartDrawer"), { ssr: false });
// Lazy, ssr:false: pulls in Firebase auth (Register/ForgetPasswordModal too), only needed after a click.
const Login = dynamic(() => import("../login/Login"), { ssr: false });
import { t } from "@/utils/translation";
import { useDispatch, useSelector } from "react-redux";
import { setShowLocation as setShowLocationAction } from "@/redux/slices/locationModalSlice";
import dynamic from "next/dynamic";
// Lottie ships ~250KB — load lazily, not in the main bundle.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const Location = dynamic(() => import("../locationmodal/Location"), {
  ssr: false,
});
import {
  BiBell,
  BiBookmarkHeart,
  BiCartAlt,
  BiUserCircle,
  BiWallet,
  BiCaretRight,
} from "react-icons/bi";
import Link from "next/link";
import { useRouter } from "next/router";
import { setCity } from "@/redux/slices/citySlice";

// Lazy + render-gated: interaction-only overlays, no reason to be in the initial bundle.
const LogoutModal = dynamic(() => import("../logoutmodal/LogoutModal"), {
  ssr: false,
});
const ProfileDrawer = dynamic(
  () => import("../profiledashboard/ProfileDrawer"),
  { ssr: false },
);
import { clearCheckout } from "@/redux/slices/checkoutSlice";
import {
  setProductBySearch,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import { setShopMode, setDefaultApplied } from "@/redux/slices/shopModeSlice";
import { isZoneCandidate } from "@/utils/reservedRoutes";
import { getPolygonCenter } from "@/utils/helperFunction";
import useLanguages from "@/hooks/useLanguages";
import {
  setCartProducts,
  setCartSubTotal,
  setCartCurrency,
  setGuestChannel,
} from "@/redux/slices/cartSlice";
import SearchComponent from "../search/SearchComponent";
import useHydratedMediaQuery from "@/hooks/useHydratedMediaQuery";
import { RiCloseFill, RiLogoutCircleRLine } from "react-icons/ri";
import { setSelectedLanguage } from "@/redux/slices/languageSlice";
import Image from "next/image";
// Mobile-only, opened from the hamburger — no reason to be in the initial bundle.
const MobileNavSidebar = dynamic(
  () => import("../mobile-nav-sidebar/MobileNavSidebar"),
  { ssr: false },
);

import useLanguageSwitch from "@/hooks/useLanguageSwitch";
import useZoneHref from "@/hooks/useZoneHref";
import useIsHydrated from "@/hooks/useIsHydrated";
import { socialIconUrl } from "@/utils/socialIcon";

/**
 * Cart icon. Shows a static flat icon while idle. Plays a Lottie animation
 * ONCE on cart change, then reverts to the static icon:
 * - count INCREASES (product added)   -> shopping-cart.json
 * - count DECREASES (product removed) -> empty-cart.json
 * `icon`/`dropKey` are accepted but ignored for back-compat.
 */
// Shifts a hex color's lightness by `delta` points (hue/saturation unchanged), matching the mobile app's gradient — not a black/white mix, which would shift hue.
const shiftLightness = (hex, delta) => {
  const h = String(hex || "")
    .trim()
    .replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return hex;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  const nextL = Math.min(100, Math.max(0, l * 100 + delta));
  return `hsl(${(hue * 360).toFixed(1)} ${(sat * 100).toFixed(1)}% ${nextL.toFixed(1)}%)`;
};

// Parse "#fff" / "#ffffff" / "rgb(...)" into normalized [r,g,b] 0..1 for Lottie.
const toLottieRgb = (css) => {
  if (!css) return [1, 1, 1];
  const c = css.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3)
      h = h
        .split("")
        .map((x) => x + x)
        .join("");
    const n = Number.parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = c.match(/(\d+(\.\d+)?)/g);
  if (m && m.length >= 3) return m.slice(0, 3).map((v) => Number(v) / 255);
  return [1, 1, 1];
};

// Deep-clone Lottie data and overwrite every solid color (shape `c.k`) with rgb.
const tintLottie = (data, rgb) => {
  const clone = structuredClone(data);
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      // fill (fl) / stroke (st) shapes hold color at node.c.k = [r,g,b,a]
      if (
        (node.ty === "fl" || node.ty === "st") &&
        node.c &&
        Array.isArray(node.c.k)
      ) {
        node.c.k = [rgb[0], rgb[1], rgb[2], node.c.k[3] ?? 1];
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(clone);
  return clone;
};

const CartIconAnimation = ({ count, badgeClass, size = 26 }) => {
  // count is persisted (0 on server) — gate the badge on hydration to avoid a mismatch.
  const isHydrated = useIsHydrated();
  const showBadge = isHydrated && count > 0;
  const lottieRef = useRef(null);
  const prevCount = useRef(count);
  // null = static icon; otherwise the animation to play once
  const [anim, setAnim] = useState(null);

  // Tint animations to the header text color (CSS var --layout-header-text).
  const tinted = useMemo(() => {
    if (!anim || typeof window === "undefined") return anim;
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue("--layout-header-text")
      .trim();
    return tintLottie(anim, toLottieRgb(css));
  }, [anim]);

  useEffect(() => {
    if (count > prevCount.current) {
      setAnim(shoppingCartAnim); // added
    } else if (count < prevCount.current) {
      setAnim(emptyCartAnim); // removed
    }
    prevCount.current = count;
  }, [count]);

  return (
    <span className="relative inline-flex flex-shrink-0">
      {anim ? (
        <Lottie
          lottieRef={lottieRef}
          animationData={tinted}
          loop={false}
          autoplay
          onComplete={() => setAnim(null)}
          style={{ width: size, height: size }}
        />
      ) : (
        <IoCartOutline size={size} className="layoutHeaderText" />
      )}
      {showBadge && <span className={badgeClass}>{count}</span>}
    </span>
  );
};

const Header = () => {
  const switchLanguageUrl = useLanguageSwitch();
  const zoneHref = useZoneHref();
  // const { theme, setTheme } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const { parseLangPath } = useLanguages();

  // Zone slug from a shared URL (e.g. /bhuj-quick) — parsed from asPath since middleware strips it from router.query.
  const zoneSlugFromUrl = useMemo(() => {
    // Strip the language segment first, or e.g. "ur" would parse as the zone slug.
    const path = (router?.asPath || "").split("?")[0];
    const { rest } = parseLangPath(path);
    const first = rest?.[0];
    return first && isZoneCandidate(first) ? first : null;
  }, [router?.asPath, parseLangPath]);

  // Gates branches that depend on redux-persist (client-only) so first client render matches SSR.
  const isHydrated = useIsHydrated();

  // const themes = useSelector((state) => state.Theme);
  const cart = useSelector((state) => state.Cart);
  const setting = useSelector((state) => state.Setting);
  // Scoped primitives for fetchCity's effect below — avoids re-running it on unrelated Setting object changes.
  const defaultCityLat = useSelector(
    (state) => state.Setting?.setting?.default_city?.latitude,
  );
  const defaultCityLng = useSelector(
    (state) => state.Setting?.setting?.default_city?.longitude,
  );
  const user = useSelector((state) => state.User);
  const cartCurrency = cart?.currency || "";
  // Total units across lines, not line count — so bumping a qty moves the badge.
  const sumQty = (list) =>
    Array.isArray(list)
      ? list.reduce((n, p) => n + (Number(p?.qty) || 0), 0)
      : 0;
  const cartItemCount =
    cart?.isGuest === true
      ? sumQty(cart?.guestCart)
      : sumQty(cart?.cartProducts);
  const cartTotal =
    Number(
      cart?.isGuest === true
        ? cart?.guestCartTotal
        : cart?.cartSubTotal || cart?.cart?.data?.sub_total,
    ) || 0;
  // City as primitives, not the whole slice — avoids re-running Header/cart effects on unrelated City changes.
  const cityLat = useSelector((state) => state.City.city?.latitude);
  const cityLng = useSelector((state) => state.City.city?.longitude);
  const cityStatus = useSelector((state) => state.City.status);
  const cityAddress = useSelector(
    (state) => state.City.city?.formatted_address,
  );
  const cityDistance = useSelector((state) => state.City.city?.distance);
  const hasCity = useSelector((state) => state.City.city != null);
  const filter = useSelector((state) => state.ProductFilter);
  // Search text is URL-owned (?q=) only on /products; local state elsewhere, pushed to the URL on commit.
  const { setSearch: setUrlSearch } = useUrlProductFilters();
  const [searchText, setSearchText] = useState("");
  const language = useSelector((state) => state.Language);
  const fcmToken = useSelector((state) => state.User?.fcm_token);
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const deliveryTime = useSelector((state) => state.ShopMode.deliveryTime);
  const deliveryDistance = useSelector(
    (state) => state.ShopMode.deliveryDistance,
  );

  const fetchCartForMode = async () => {
    if (!user?.jwtToken) return;
    // Snapshot which channel this request is for, so a late response doesn't write the wrong bucket.
    const channel = shopMode === "quick" ? "quick" : "ecommerce";
    try {
      const cartData = await api.getCart({
        latitude: cityLat,
        longitude: cityLng,
      });
      // Update currency even on an empty cart, or the previous channel's symbol stays cached.
      if (cartData?.data?.currency) {
        dispatch(setCartCurrency({ data: cartData.data.currency, channel }));
      }
      if (cartData?.status == 1) {
        const productsData = cartData?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCartProducts({ data: productsData }));
        dispatch(setCartSubTotal({ data: cartData?.data?.sub_total }));
      } else {
        dispatch(setCartProducts({ data: [] }));
        dispatch(setCartSubTotal({ data: 0 }));
      }
    } catch (error) {
      console.log("fetchCartForMode error", error);
    }
  };

  // Just sets the mode — the shopMode effect below drives the cart refetch, avoiding a race on the channel header.
  const handleModeToggle = (mode) => {
    dispatch(setShopMode({ mode }));
  };

  // Currency is per-channel, only returned by the cart APIs — refetch on channel change.
  const fetchGuestCartCurrency = async () => {
    if (!(cart?.isGuest === true && cart?.guestCart?.length > 0)) return;
    const channel = shopMode === "quick" ? "quick" : "ecommerce";
    try {
      const response = await api.getGuestCart({
        latitude: cityLat,
        longitude: cityLng,
        variant_ids: cart.guestCart.map((p) => p.product_variant_id).join(","),
        quantities: cart.guestCart.map((p) => p.qty).join(","),
      });
      if (response?.status == 1 && response?.data?.currency) {
        dispatch(setCartCurrency({ data: response.data.currency, channel }));
      }
    } catch (error) {
      console.log("guest cart currency error", error);
    }
  };

  // Points the cart slice at the active channel's guest-cart bucket on channel switch.
  useEffect(() => {
    if (!shopMode) return;
    const channel = shopMode === "quick" ? "quick" : "ecommerce";
    dispatch(setGuestChannel({ channel }));
  }, [shopMode, cart?.guestCartByChannel, dispatch]);

  useEffect(() => {
    if (!shopMode) return;
    if (user?.jwtToken) {
      // getCart needs latitude server-side — wait for coords or it 0-returns "latitude required".
      if (cityLat == null) return;
      fetchCartForMode();
    } else {
      fetchGuestCartCurrency();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shopMode,
    user?.jwtToken,
    cart?.isGuest,
    cart?.guestCart?.length,
    cityLat,
    cityLng,
  ]);

  // Channel config from the home_layout API (stored in the ShopMode slice):
  //   layout_mode: "both" -> show Quick / All Shop toggle
  //                else    -> single channel, hide toggle, force that mode (quick UI)
  //   requested:   default shop mode when both are available (defaults to "quick")
  const layoutMode = useSelector((state) => state.ShopMode.layoutMode);
  const requestedMode = useSelector((state) => state.ShopMode.requested);
  const defaultApplied = useSelector((state) => state.ShopMode.defaultApplied);
  const layoutTheme = useSelector((state) => state.ShopMode.layoutTheme);
  // Channel toggle labels from the home_layout API, falling back to t() strings.
  const quickLabel = useSelector((state) => state.ShopMode.quickLabel) || "";
  const ecommerceLabel =
    useSelector((state) => state.ShopMode.ecommerceLabel) || "";
  const availableModes = useSelector((state) => state.ShopMode.availableModes);
  // Gated on hydration — availableModes is persisted, so reading it raw would flip the toggle's presence and cause a #418 mismatch.
  const showShopModeToggle = isHydrated && availableModes === "both";

  useEffect(() => {
    const root = document.documentElement;
    if (!layoutTheme) return;
    if (
      layoutTheme.background_theme === "image" &&
      layoutTheme.background_image_url
    ) {
      // Paints the header wrapper; shop-mode pills stay flat since they don't read this var.
      const img = `url(${layoutTheme.background_image_url})`;
      root.style.setProperty("--layout-header-gradient", img);
      root.style.setProperty("--layout-header-gradient-continue", img);
      // One continuous image spans header + category strip (separate DOM subtrees), sized to their combined height.
      // Floored at 100% so a 0-height strip (no category tabs) doesn't shrink the image to nothing.
      const total =
        "max(100%, calc(var(--layout-header-h) + var(--layout-strip-h)))";
      root.style.setProperty("--layout-header-bg-size", `100% ${total}`);
      root.style.setProperty("--layout-header-bg-pos", "left top");
      root.style.setProperty("--layout-strip-bg-size", `100% ${total}`);
      root.style.setProperty(
        "--layout-strip-bg-pos",
        "left calc(-1 * var(--layout-header-h))",
      );
      root.style.setProperty("--layout-header-bg-image", "none");
      root.style.removeProperty("--layout-header-bg");
    } else if (layoutTheme.background_color) {
      // Single brand color -> vertical gradient, split as ONE continuous ramp across header + strip (no seam at the join).
      // Stops via lightness shift (not black/white mix, which shifts hue) to match the mobile app's gradient exactly.
      const base = layoutTheme.background_color;
      const headerDark = shiftLightness(base, -14);
      const headerLight = shiftLightness(base, 6);
      const stripEnd = shiftLightness(base, 12);
      const gradient = `linear-gradient(180deg, ${headerDark} 0%, ${headerLight} 100%)`;
      const gradientContinue = `linear-gradient(180deg, ${headerLight} 0%, ${stripEnd} 100%)`;
      root.style.setProperty("--layout-header-bg", base); // flat-color fallback
      root.style.setProperty("--layout-header-gradient", gradient);
      root.style.setProperty(
        "--layout-header-gradient-continue",
        gradientContinue,
      );
      root.style.setProperty("--layout-header-bg-size", "cover");
      root.style.setProperty("--layout-header-bg-pos", "center");
      root.style.setProperty("--layout-strip-bg-size", "cover");
      root.style.setProperty("--layout-strip-bg-pos", "center");
      root.style.setProperty("--layout-header-bg-image", "none");
    }
    if (layoutTheme.text_color) {
      root.style.setProperty("--layout-header-text", layoutTheme.text_color);
    }
  }, [layoutTheme]);

  useEffect(() => {
    if (!layoutMode && !availableModes) return;
    // When both channels are available, seed the default ONCE (never force again, or the toggle would snap back).
    if (availableModes === "both") {
      if (!defaultApplied) {
        const def =
          layoutMode === "allShop" || requestedMode === "allShop"
            ? "allShop"
            : "quick";
        dispatch(setShopMode({ mode: def }));
        dispatch(setDefaultApplied());
      }
    } else {
      dispatch(
        setShopMode({ mode: layoutMode === "allShop" ? "allShop" : "quick" }),
      );
    }
  }, [layoutMode, availableModes, requestedMode, defaultApplied, dispatch]);

  const hasLocation = cityStatus === "fulfill";
  const settingsDeliveryTime =
    setting?.setting?.web_settings?.delivery_time ||
    setting?.setting?.delivery_time ||
    10;
  // deliveryTime (home_layout) is a ready-made string with its own unit(s) — render as-is, don't strip to "first number".
  const quickDeliveryTime = deliveryTime || settingsDeliveryTime;
  const quickDeliveryHasUnit = !!deliveryTime;
  const showQuickDelivery = shopMode === "quick" && hasLocation;
  // Backend sends distance pre-formatted with unit (e.g. "7.1 km") — hide when missing or zero.
  const rawDistance = deliveryDistance || cityDistance;
  const distanceKm =
    rawDistance && !/^0(\.0+)?\s*km/i.test(String(rawDistance).trim())
      ? String(rawDistance).trim()
      : null;

  // Hydration-safe: react-responsive has no matchMedia on the server, avoids a #418 mismatch on first client render.
  const isMobile = useHydratedMediaQuery("(max-width: 765px)");

  const [showCart, setShowCart] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [mobileActiveKey, setMobileActiveKey] = useState(1);
  const [selectedTab, setSelectedTab] = useState("profile");
  const [showProfile, setShowProfile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // In Redux so the footer's country selector can open it too.
  const showLocation = useSelector(
    (state) => state?.LocationModal?.showLocation,
  );
  const setShowLocation = useCallback(
    (value) => dispatch(setShowLocationAction(!!value)),
    [dispatch],
  );

  const [mobileSearch, setMobileSearch] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [isSuggLoading, setIsSuggLoading] = useState(false);
  const [isSuggError, setIsSuggError] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Gates presence-only blocks (social links, support number) that depend on client-filled redux, to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Seeds the search box from ?q= when landing on /products directly.
  useEffect(() => {
    if (router?.pathname === "/products" && router?.isReady) {
      setSearchText(typeof router.query?.q === "string" ? router.query.q : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router?.pathname, router?.isReady]);

  useEffect(() => {
    if (router?.pathname != "/checkout") {
      dispatch(clearCheckout());
    }
  }, [router, dispatch]);

  useEffect(() => {
    // if mobile screen is dragged to desktop screen close the mobile search
    if (isMobile === false && mobileSearch === true) {
      setMobileSearch(false);
    }
    // mobileSearch is read only to guard the setState call; including it would re-fire this effect on every search toggle instead of only on isMobile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Seeds City from a shared zone URL slug (mirrors server resolveZoneBySlug). Returns true if it dispatched setCity.
  const seedCityFromZoneSlug = async (slug) => {
    const zonesRes = await api.getZones();
    const zones = zonesRes?.data || [];
    const zone = zones.find((z) => z?.slug === slug);
    if (!zone) return false;
    const center = getPolygonCenter(zone.polygon_boundary);
    if (!center) return false;
    const response = await api.getZone({
      latitude: center.lat,
      longitude: center.lng,
      skipChannel: true,
    });
    if (response?.status !== 1) return false;
    dispatch(
      setCity({
        data: {
          ...response.data,
          // getZone has no formatted_address — fall back to the zone name.
          formatted_address: response.data?.formatted_address || zone.name,
          latitude: center.lat,
          longitude: center.lng,
        },
      }),
    );
    return true;
  };

  const fetchingCityRef = useRef(false);
  const fetchCity = async () => {
    // Guards against two overlapping runs both seeing hasCity=false and firing setCity in parallel.
    if (hasCity || fetchingCityRef.current) return;
    fetchingCityRef.current = true;
    try {
      // A shared zone URL wins over default_city, so the link opens in the zone it points at.
      if (zoneSlugFromUrl) {
        const seeded = await seedCityFromZoneSlug(zoneSlugFromUrl);
        if (seeded) return;
      }
      if (setting?.setting?.default_city) {
        const latitude = Number.parseFloat(
          setting.setting.default_city?.latitude,
        );
        const longitude = Number.parseFloat(
          setting.setting.default_city?.longitude,
        );
        const response = await api.getZone({
          latitude: latitude,
          longitude: longitude,
        });
        if (response.status === 1) {
          dispatch(
            setCity({ data: { ...response.data, latitude, longitude } }),
          );
        } else {
          // default_city isn't a serviceable zone — prompt for a location instead of stalling on "Loading...".
          setShowLocation(true);
        }
      } else if (setting?.setting && !hasCity) {
        // No default_city and no saved city — same dead end, same fix.
        setShowLocation(true);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      fetchingCityRef.current = false;
    }
  };

  useEffect(() => {
    fetchCity();
    // Depends on the specific fields fetchCity reads, not the whole setting object (which changes reference on every rehydrate/refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!setting?.setting, defaultCityLat, defaultCityLng, zoneSlugFromUrl]);
  useEffect(() => {
    // Syncs bottom-nav highlight with the current route.
    if (router.pathname.includes("/wishlist")) {
      setMobileActiveKey(3); // Favourites
    } else if (router.pathname.includes("/profile")) {
      setMobileActiveKey(4); // Profile
    } else if (router.pathname.startsWith("/categories")) {
      setMobileActiveKey(2); // Categories
    } else if (router.pathname === "/") {
      setMobileActiveKey(1); // Home
    }
  }, [router.pathname]);

  const handleLanguageChange = async (language) => {
    try {
      const response = await api.getSystemLanguages({
        id: language?.id,
        isDefault: 0,
        systemType: 3,
      });
      if (response.status == 1) {
        dispatch(setSelectedLanguage({ data: response?.data }));
        document.documentElement.dir = response?.data?.type;
        // Same user action as the URL move, so the language segment and Redux stay in step.
        switchLanguageUrl(response?.data?.code);
        // Auth-gated (401 without a JWT); isolated try so a token failure doesn't break the language switch.
        if (user?.jwtToken && fcmToken) {
          try {
            await api.updateFcmToken({
              langaugeId: response?.data?.admin_lang_id_for_fcm,
              fcmToken,
            });
          } catch (fcmErr) {
            console.log("FCM token update failed:", fcmErr?.message);
          }
        }
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleCartOpen = () => {
    if (router.pathname == "/checkout") {
      router.push(zoneHref("/cart"));
    } else {
      setShowCart(true);
    }
  };

  const handleLoginOpen = () => {
    setShowLogin(true);
  };

  const handleOpenLocation = () => {
    setShowLocation(true);
  };

  const handleHomeClick = () => {
    setMobileActiveKey(1);
    // Home is a zone route (/{zone} is the zone home) — keep the zone and
    // language rather than dropping to the bare, location-less home.
    router.push(zoneHref("/"));
  };

  const handleCategoriesClick = () => {
    setMobileActiveKey(2);
    dispatch(setCategoryBreadcrumb({ data: [] }));
    router.push(zoneHref("/categories"));
  };

  const handleFavouritesClick = () => {
    setMobileActiveKey(3);
    if (user?.jwtToken) {
      router.push(zoneHref("/profile/wishlist"));
    } else {
      setShowLogin(true);
    }
  };

  const handleProfileClick = () => {
    setMobileActiveKey(4);
    if (user?.jwtToken) {
      setShowProfile(true);
    } else {
      setShowLogin(true);
    }
  };

  const handleSearchData = async (searchValue) => {
    setIsSuggLoading(true);
    setIsSuggError(false);
    try {
      const response = await api.getProductByFilter({
        latitude: cityLat,
        longitude: cityLng,
        filters: {
          search: searchValue,
          category_id: filter?.searchedCategory,
        },
      });
      dispatch(setProductBySearch({ data: response?.data }));
      setIsSuggLoading(false);
    } catch (error) {
      setIsSuggLoading(false);
      setIsSuggError(true);
      console.log("Error", error?.message);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchText(value);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (value.trim() === "") {
      dispatch(setProductBySearch({ data: [] }));
      if (router?.pathname === "/products") setUrlSearch(null);
      setIsSuggError(false);
      return;
    }
    setIsSuggLoading(true);
    typingTimeoutRef.current = setTimeout(() => {
      handleSearchData(value);
      // Same 400ms settle as the suggestion fetch — avoids a replace on every keystroke.
      if (router?.pathname === "/products") setUrlSearch(value);
    }, 400);
  };

  const handleSearchRetry = () => {
    if (searchText?.trim()) {
      handleSearchData(searchText);
    }
  };

  const handleMobileSearch = () => {
    setMobileSearch(!mobileSearch);
  };

  const handleMobileNav = () => {
    setMobileNav(!mobileNav);
  };

  const renderShopModeToggle = () => {
    // No track background (header gradient shows through) — each half carries its own pill.
    return (
      <div
        dir="ltr"
        className="relative grid grid-cols-2 items-center rounded-lg p-1 gap-1.5 select-none flex-shrink-0"
      >
        <button
          type="button"
          onClick={() => handleModeToggle("quick")}
          className={`flex items-center justify-center gap-1.5 px-3 lg:px-4 h-[32px] text-xs font-semibold whitespace-nowrap rounded-lg transition-colors duration-300 outline-none focus:outline-none ${
            shopMode === "quick"
              ? "bg-white text-gray-900 shadow-sm"
              : "bg-black/35 text-white"
          }`}
        >
          <span>{quickLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeToggle("allShop")}
          className={`flex items-center justify-center gap-1.5 px-3 lg:px-4 h-[32px] text-xs font-semibold whitespace-nowrap rounded-lg transition-colors duration-300 outline-none focus:outline-none ${
            shopMode === "allShop"
              ? "bg-white text-gray-900 shadow-sm"
              : "bg-black/35 text-white"
          }`}
        >
          <span>{ecommerceLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <>
      <header
        id="site-header"
        className="sticky top-0 z-50 w-full layoutHeaderGradient layoutHeaderText"
      >
        {/* ═══════════ ROW 1: Top Utility Bar (Desktop only) ═══════════ */}
        <div className="w-full layoutHeaderText hidden md:block">
          <div className="w-full flex justify-between items-center h-[38px] px-4 md:px-8 lg:px-10">
            {/* Social links */}
            <div className="flex items-center gap-1">
              {mounted && setting?.setting?.social_media?.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium opacity-90">
                    {t("follow_us")}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {setting?.setting?.social_media?.map((social) => {
                      // Uploaded icons render as an image; icon-font entries
                      // render the glyph. socialIconUrl() returns "" for the
                      // latter — their icon_url exists but is not an image.
                      const iconUrl = socialIconUrl(social);
                      const iconName = social?.icon?.toLowerCase() || "";
                      let socialIcon;
                      if (iconUrl) {
                        socialIcon = (
                          <Image
                            src={iconUrl}
                            alt=""
                            width={16}
                            height={16}
                            className="h-4 w-4 object-contain"
                          />
                        );
                      } else if (iconName.includes("wechat")) {
                        socialIcon = <i className="fab fa-weixin text-sm"></i>;
                      } else if (iconName.includes("twitter")) {
                        socialIcon = <FaXTwitter size={13} />;
                      } else {
                        socialIcon = (
                          <i className={`${social?.icon} text-sm`}></i>
                        );
                      }
                      return (
                        <Link
                          key={social?.id}
                          href={social?.link || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={
                            social?.name || social?.icon || "Social link"
                          } // icon-only link needs a name
                          className="w-8 h-8 inline-flex items-center justify-center shrink-0 rounded-full hover:bg-white/15 transition-colors duration-200"
                        >
                          {socialIcon}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Utility controls */}
            <div className="flex items-center gap-1">
              {/* Support number */}
              {mounted && setting?.setting?.support_number && (
                <Link
                  href={`tel:${setting?.setting?.support_number}`}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/15 transition-colors duration-200 text-sm"
                >
                  <FaPhoneVolume size={12} />
                  <span>{setting?.setting?.support_number}</span>
                </Link>
              )}

              {/* Divider */}
              {mounted && setting?.setting?.support_number && (
                <span className="w-px h-4 bg-white/30 mx-1"></span>
              )}

              {/* Theme toggle — commented out, app is pinned to light theme
                  (see ThemeProvider's forcedTheme in _app.js). Left in place
                  rather than deleted in case the toggle needs to come back. */}
              {/* <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-white/15 transition-colors duration-200 text-sm border-none outline-none">
                  {mounted && themes?.theme === "dark" ? (
                    <FaMoon size={13} />
                  ) : (
                    <FaSun size={13} />
                  )}
                  <span className="hidden xl:inline">
                    {mounted ? t(themes?.theme) : "Light"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[120px]">
                  <DropdownMenuItem
                    onSelect={() => handleChangeTheme("light")}
                    className="flex gap-2 cursor-pointer"
                  >
                    <FaSun size={14} />
                    {t("light")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleChangeTheme("dark")}
                    className="flex gap-2 cursor-pointer"
                  >
                    <FaMoon size={14} />
                    {t("dark")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}

              {/* Divider */}
              <span className="w-px h-4 bg-white/30 mx-1"></span>

              {/* Language selector */}
              <DropdownMenu>
                {mounted && language?.availableLanguages?.length > 1 ? (
                  <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-white/15 transition-colors duration-200 text-sm border-none outline-none">
                    <IoLanguage size={15} />
                    <span>{language?.selectedLanguage?.name || "English"}</span>
                  </DropdownMenuTrigger>
                ) : (
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border-none outline-none opacity-80"
                    type="button"
                  >
                    <IoLanguage size={15} />
                    <span>
                      {mounted
                        ? language?.selectedLanguage?.name || "English"
                        : "English"}
                    </span>
                  </button>
                )}
                <DropdownMenuContent className="min-w-[120px]">
                  {language?.availableLanguages?.map((lang) => (
                    <DropdownMenuItem
                      onSelect={() => handleLanguageChange(lang)}
                      key={lang?.id}
                      className="cursor-pointer"
                    >
                      {lang?.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ═══════════ ROW 2: Main Header ═══════════ */}
        <div className="layoutHeaderText">
          <div className="w-full px-4 md:px-4 lg:px-10">
            {/* ── Desktop Main Row (md+) ── */}
            <div className="hidden md:flex flex-col xl:flex-row xl:items-center xl:h-[68px] xl:gap-5">
              {/* Row 1: Logo + Location + ShopMode + Cart + Profile */}
              <div className="flex items-center h-[68px] xl:h-auto xl:flex-1 gap-2 xl:gap-5">
                {/* Logo */}
                <Link
                  href={zoneHref("/")}
                  aria-label="Home" // static label so the link is named pre-mount too; not t() to avoid an SSR/locale mismatch
                  className="relative flex-shrink-0 h-[38px] w-[115px] lg:w-[140px]"
                >
                  {mounted && setting?.setting?.web_settings?.web_logo && (
                    <Image
                      src={setting?.setting?.web_settings?.web_logo}
                      alt="Logo"
                      fill
                      priority={true}
                      fetchPriority="high"
                      loading="eager"
                      className="object-contain"
                    />
                  )}
                </Link>

                {/* Location — md+. Doesn't grow below xl (search is on Row 2
                    there), so the logo+location group stays left and cart+profile
                    pin right via ml-auto instead of a stretched location leaving
                    an awkward gap. */}
                <span className="w-px h-8 shortDescriptionTextBg flex-shrink-0" />
                <button
                  type="button"
                  className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 flex-none hover:opacity-70 transition-opacity min-w-0 text-start"
                  onClick={handleOpenLocation}
                >
                  <IoLocationOutline
                    size={18}
                    className="shortDescriptionText flex-shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    {mounted && showQuickDelivery ? (
                      <span className="text-sm font-extrabold leading-tight whitespace-nowrap">
                        {t("delivery_in")} {quickDeliveryTime}{" "}
                        {!quickDeliveryHasUnit && t("minutes")}
                        {distanceKm && (
                          <span className="text-sm font-extrabold leading-tight whitespace-nowra ">
                            {" · "}
                            {distanceKm}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] shortDescriptionText leading-none uppercase tracking-wide mb-0.5">
                        {mounted ? t("deliver_to") : "Deliver to"}
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-0.5 leading-tight max-w-full lg:max-w-[180px] xl:max-w-[260px] ${
                        mounted && showQuickDelivery
                          ? "text-[11px] font-normal shortDescriptionText"
                          : "text-sm font-bold"
                      }`}
                    >
                      {mounted &&
                      (cityAddress || setting?.setting?.default_city?.name) ? (
                        <span className="truncate min-w-0">
                          {cityAddress || setting?.setting?.default_city?.name}
                        </span>
                      ) : (
                        <span className="opacity-50 text-xs font-normal">
                          {mounted ? t("loading") : "Loading"}
                        </span>
                      )}
                      <BiCaretRight
                        size={10}
                        className="rotate-90 flex-shrink-0 opacity-40"
                      />
                    </span>
                  </div>
                </button>
                {/* Search inline — xl+ only (fills the row). Below xl (incl. the
                    1024px lg range) it drops to the full-width Row 2, so Row 1
                    doesn't cram search + toggle + cart + profile into one line. */}
                <span className="hidden xl:block w-px h-8 shortDescriptionTextBg flex-shrink-0" />
                <div className="hidden xl:flex flex-1 min-w-0">
                  <SearchComponent
                    isSuggLoading={isSuggLoading}
                    isSuggError={isSuggError}
                    onRetrySearch={handleSearchRetry}
                    isMobile={isMobile}
                    searchText={searchText}
                    handleSearch={handleSearch}
                  />
                </div>
                <span className="hidden xl:block w-px h-8 shortDescriptionTextBg flex-shrink-0" />

                {/* Shop mode toggle — xl+ inline; below xl it moves to the search
                    row below to keep Row 1 from overflowing on tablets/small
                    laptops (the 1024px range was cramped). */}
                {showShopModeToggle && (
                  <>
                    <div className="hidden xl:block flex-shrink-0">
                      {renderShopModeToggle()}
                    </div>
                    <span className="hidden xl:block w-px h-8 shortDescriptionTextBg flex-shrink-0" />
                  </>
                )}

                {/* Cart — pinned to the right below xl (ml-auto) so it and the
                    profile sit at the row's end; at xl the inline search fills the
                    middle, so the auto margin is removed. */}
                <button
                  type="button"
                  className="flex items-center gap-2 cursor-pointer flex-shrink-0 ml-auto xl:ml-0 px-2 py-1.5 rounded-xl transition-colors duration-200"
                  onClick={handleCartOpen}
                >
                  <CartIconAnimation
                    count={cartItemCount}
                    size={28}
                    badgeClass="flex absolute -top-1 -right-1.5 bodyTextColor textBackground rounded-full h-[16px] w-[16px] items-center justify-center font-bold text-[9px]"
                  />
                  {mounted && cartItemCount > 0 && (
                    <div className="hidden lg:flex flex-col text-start">
                      <span className="text-xs shortDescriptionText leading-tight">
                        {t("your_cart")}
                      </span>
                      <span className="text-sm font-bold leading-tight">
                        {cartCurrency}
                        {cartTotal?.toFixed(
                          setting?.setting?.decimal_point || 0,
                        )}
                      </span>
                    </div>
                  )}
                </button>

                {/* Profile / Login — gate on mounted: the JWT comes from
                    redux-persist (localStorage), invisible to the server, so the
                    server always renders the guest button. Without the gate the
                    client's logged-in dropdown mismatches the server's button. */}
                {mounted && user?.jwtToken !== "" ? (
                  <div
                    className="flex-shrink-0"
                    onMouseEnter={() => setProfileOpen(true)}
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <DropdownMenu
                      open={profileOpen}
                      onOpenChange={setProfileOpen}
                    >
                      <DropdownMenuTrigger className="flex items-center gap-1.5 border-none outline-none shadow-none px-3 py-2 rounded-xl">
                        <LuUser size={20} className="shortDescriptionText" />
                        <span className="hidden lg:inline text-sm font-semibold max-w-[120px] truncate">
                          {user?.user?.name || t("profile")}
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[220px] p-1.5"
                        sideOffset={0}
                        onMouseEnter={() => setProfileOpen(true)}
                        onMouseLeave={() => setProfileOpen(false)}
                      >
                        <Link href={zoneHref("/profile")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <BiUserCircle size={20} className="opacity-70" />
                            <span className="font-medium">
                              {t("editProfile")}
                            </span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href={zoneHref("/profile/activeorders")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <BiCartAlt size={20} className="opacity-70" />
                            <span className="font-medium">{t("orders")}</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href={zoneHref("/profile/wishlist")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <BiBookmarkHeart size={20} className="opacity-70" />
                            <span className="font-medium">{t("wishlist")}</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href={zoneHref("/profile/notifications")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <BiBell size={20} className="opacity-70" />
                            <span className="font-medium">
                              {t("notification")}
                            </span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href={zoneHref("/profile/address")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <IoLocationOutline
                              size={20}
                              className="opacity-70"
                            />
                            <span className="font-medium">
                              {t("myAddress")}
                            </span>
                          </DropdownMenuItem>
                        </Link>
                        <Link href={zoneHref("/profile/wallethistory")}>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer">
                            <BiWallet size={20} className="opacity-70" />
                            <span className="font-medium">
                              {t("walletBalance")}
                            </span>
                          </DropdownMenuItem>
                        </Link>
                        <div className="my-1 h-px shortDescriptionTextBg"></div>
                        <DropdownMenuItem
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-red-500"
                          onSelect={() => setShowLogout(true)}
                        >
                          <RiLogoutCircleRLine size={18} />
                          <span className="font-medium">{t("logout")}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 px-3 py-2 rounded-xl"
                    onClick={handleLoginOpen}
                  >
                    <LuUser size={20} className="shortDescriptionText" />
                    <span className="hidden lg:inline text-sm font-semibold">
                      {mounted ? t("login") : "Login"}
                    </span>
                  </button>
                )}
              </div>
              {/* end Row 1 */}

              {/* Row 2: md + lg (below xl). Row 1 has no inline search/toggle
                  below xl, so both live here on a full-width row. At xl+
                  everything is inline in Row 1, so this row is hidden. */}
              <div className="flex xl:hidden items-center gap-3 pb-3">
                <div className="flex-1 min-w-0">
                  <SearchComponent
                    isSuggLoading={isSuggLoading}
                    isSuggError={isSuggError}
                    onRetrySearch={handleSearchRetry}
                    isMobile={isMobile}
                    searchText={searchText}
                    handleSearch={handleSearch}
                  />
                </div>
                {showShopModeToggle && (
                  <div className="flex-shrink-0">{renderShopModeToggle()}</div>
                )}
              </div>
            </div>

            {/* ── Mobile Mode Row: Quick/eCommerce toggle ── */}
            {showShopModeToggle && (
              <div
                dir="ltr"
                className="flex md:hidden items-center w-full gap-1.5 rounded-lg p-1 pt-1.5 select-none"
              >
                <button
                  type="button"
                  onClick={() => handleModeToggle("quick")}
                  className={`flex flex-1 items-center justify-center gap-1.5 h-[28px] text-[12px] font-semibold rounded-lg transition-colors duration-300 outline-none ${
                    shopMode === "quick"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "bg-black/35 text-white"
                  }`}
                >
                  <span>{quickLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeToggle("allShop")}
                  className={`flex flex-1 items-center justify-center gap-1.5 h-[28px] text-[12px] font-semibold rounded-lg transition-colors duration-300 outline-none ${
                    shopMode === "allShop"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "bg-black/35 text-white"
                  }`}
                >
                  <span>{ecommerceLabel}</span>
                </button>
              </div>
            )}

            {/* ── Mobile Top Row: Hamburger + Location + Cart ── */}
            <div className="flex md:hidden items-center gap-2 pt-1 pb-0.5">
              {/* Hamburger */}
              <button
                type="button"
                onClick={handleMobileNav}
                className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200 flex-shrink-0"
                aria-label="Menu"
              >
                <RxHamburgerMenu size={22} />
              </button>

              {/* Location — inline, takes remaining width */}
              <button
                type="button"
                onClick={handleOpenLocation}
                className="flex items-center gap-1.5 flex-1 min-w-0 active:opacity-70 transition-opacity text-start"
              >
                <IoLocationOutline
                  size={16}
                  className="shortDescriptionText flex-shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  {/* `showQuickDelivery` reads persisted ShopMode.mode + City.status
                      (empty on server). Gate on `mounted` so this row matches the
                      server on first paint — mirrors the desktop row at ~942. */}
                  {mounted && showQuickDelivery ? (
                    <span className="text-[13px] font-extrabold leading-tight layoutHeaderText flex items-center gap-1">
                      <span className="truncate">
                        {t("delivery_in")} {quickDeliveryTime}{" "}
                        {!quickDeliveryHasUnit && t("minutes")}
                        {distanceKm && (
                          <span className="font-normal shortDescriptionText">
                            {" · "}
                            {distanceKm}
                          </span>
                        )}
                      </span>
                      <BiCaretRight
                        size={11}
                        className="rotate-90 opacity-40 flex-shrink-0"
                      />
                    </span>
                  ) : (
                    <span className="text-[10px] shortDescriptionText leading-none mb-0.5">
                      {mounted ? t("deliver_to") : "Deliver to"}
                    </span>
                  )}
                  <span
                    className={`truncate leading-tight layoutHeaderText ${mounted && showQuickDelivery ? "text-[11px] font-normal shortDescriptionText" : "text-[13px] font-semibold flex items-center gap-1"}`}
                  >
                    {mounted &&
                    (cityAddress || setting?.setting?.default_city?.name) ? (
                      cityAddress || setting?.setting?.default_city?.name
                    ) : (
                      <span className="opacity-40">
                        {mounted ? t("loading") : "Loading"}
                      </span>
                    )}
                    {!(mounted && showQuickDelivery) && (
                      <BiCaretRight
                        size={11}
                        className="rotate-90 opacity-40 flex-shrink-0"
                      />
                    )}
                  </span>
                </div>
              </button>

              {/* Cart */}
              <button
                type="button"
                onClick={handleCartOpen}
                className="p-1.5 rounded-lg relative flex-shrink-0"
                aria-label="Cart"
              >
                <CartIconAnimation
                  count={cartItemCount}
                  size={24}
                  badgeClass="flex absolute -top-1 -right-1 bodyTextColor textBackground rounded-full min-w-[14px] h-[14px] px-1 items-center justify-center text-center font-bold text-[8px] leading-none ring-2 ring-white dark:ring-zinc-900"
                />
              </button>
            </div>

            {/* ── Mobile Sub Row: Search bar ── */}
            <div className="flex md:hidden flex-col gap-1 pb-1.5">
              {/* Full-width search bar — opens the search Sheet on tap */}
              <button
                type="button"
                onClick={handleMobileSearch}
                className="flex items-center gap-2 w-full bg-white dark:bg-zinc-800 rounded-xl px-3 h-[38px] shadow-sm active:opacity-80 transition-opacity"
                aria-label="Search"
              >
                <IoSearchOutline
                  size={20}
                  className="text-zinc-400 flex-shrink-0"
                />
                <span className="text-[13px] text-zinc-400 truncate">
                  {mounted ? t("search") : "Search"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ Modals & Drawers ═══════════ */}
      <Sheet open={mobileSearch} onOpenChange={setMobileSearch}>
        <SheetContent
          className="p-0 w-full sm:w-[900px]"
          side={language?.selectedLanguage?.type === "RTL" ? "left" : "right"}
        >
          <SheetHeader>
            <SheetTitle className="flex justify-between px-4 py-3 items-center border-b">
              <span className="text-lg font-bold">{t("search")}</span>
              <SheetTrigger className="focus:outline-none closeButtonBg rounded-full p-2 cursor-pointer hover:opacity-80 transition-opacity">
                <RiCloseFill size={20} />
              </SheetTrigger>
            </SheetTitle>
            <SheetDescription>
              <SearchComponent
                isSuggLoading={isSuggLoading}
                isSuggError={isSuggError}
                onRetrySearch={handleSearchRetry}
                isMobile={isMobile}
                searchText={searchText}
                mobileSearch={mobileSearch}
                setMobileSearch={setMobileSearch}
                handleSearch={handleSearch}
              />
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
      {/* Each overlay below is render-gated on its own "is open" flag, not just
          lazily imported. next/dynamic starts fetching the chunk as soon as the
          component is RENDERED, so mounting them unconditionally would pull
          every chunk on first paint and defeat the split — the gate is what
          keeps them off the critical path until the user opens one. They hold
          no state across close (it all lives in Redux/props), so unmounting is
          behaviour-preserving. */}
      {mobileNav && (
        <MobileNavSidebar
          open={mobileNav}
          setOpen={setMobileNav}
          handleLanguageChange={handleLanguageChange}
        />
      )}
      {showCart && (
        <CartDrawer
          showCart={showCart}
          setShowCart={setShowCart}
          setShowLogin={setShowLogin}
          setMobileActiveKey={setMobileActiveKey}
        />
      )}
      {showLogin && (
        <Login
          showLogin={showLogin}
          setShowLogin={setShowLogin}
          setMobileActiveKey={setMobileActiveKey}
        />
      )}
      {showLocation && (
        <Location
          showLocation={showLocation}
          setShowLocation={setShowLocation}
        />
      )}
      {showLogout && (
        <LogoutModal showLogout={showLogout} setShowLogout={setShowLogout} />
      )}

      {/* ═══════════ Mobile Bottom Navigation ═══════════ */}
      {/* `user.jwtToken` is persisted auth — absent on the server, present on the
          first client paint for a logged-in user. It drives the column count, the
          Favourites tab's PRESENCE, and the last tab's label, so reading it raw
          flips the whole nav structure and discards the tree (#418). Gate on
          `mounted` so the first client render matches the server (logged-out
          layout); the logged-in nav appears on the next render. */}
      <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden">
        <div className="bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700/60 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
          <div
            className={`grid ${
              mounted && user?.jwtToken ? "grid-cols-4" : "grid-cols-3"
            } items-stretch px-1 pt-2 pb-1.5`}
          >
            {[
              {
                key: 1,
                label: mounted ? t("home") : "Home",
                onClick: handleHomeClick,
                Active: IoHome,
                Inactive: IoHomeOutline,
                size: 22,
              },
              {
                key: 2,
                label: mounted ? t("categories") : "Categories",
                onClick: handleCategoriesClick,
                Active: MdCategory,
                Inactive: MdOutlineCategory,
                size: 21,
              },
              // Wishlist/Favourites only for logged-in users.
              ...(mounted && user?.jwtToken
                ? [
                    {
                      key: 3,
                      label: t("favourites"),
                      onClick: handleFavouritesClick,
                      Active: IoHeart,
                      Inactive: IoHeartOutline,
                      size: 22,
                    },
                  ]
                : []),
              {
                key: 4,
                label:
                  mounted && user?.jwtToken
                    ? user?.user?.name || t("profile")
                    : mounted
                      ? t("login")
                      : "Login",
                onClick: handleProfileClick,
                Active: IoPerson,
                Inactive: IoPersonOutline,
                size: 21,
              },
            ].map((tab) => {
              const isActive = mobileActiveKey === tab.key;
              const Icon = isActive ? tab.Active : tab.Inactive;
              return (
                <button
                  type="button"
                  key={tab.key}
                  className="flex flex-col items-center justify-center gap-1 py-1 min-w-0"
                  onClick={tab.onClick}
                  aria-label={tab.label}
                >
                  <Icon
                    size={tab.size}
                    className={
                      isActive
                        ? "primaryColor"
                        : "text-zinc-500 dark:text-zinc-400"
                    }
                  />
                  <span
                    className={`max-w-full truncate text-[11px] leading-tight transition-colors duration-200 ${
                      isActive
                        ? "primaryColor font-semibold"
                        : "text-zinc-500 dark:text-zinc-400 font-medium"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
      {showProfile && (
        <ProfileDrawer
          showProfile={showProfile}
          setShowProfile={setShowProfile}
          setSelectedTab={setSelectedTab}
          selectedTab={selectedTab}
        />
      )}
    </>
  );
};

export default Header;
