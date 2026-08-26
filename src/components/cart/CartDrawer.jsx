import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { t } from "@/utils/translation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CartProductsCard from "./CartDrawerProductsCard";
import { useSelector, useDispatch } from "react-redux";
import * as api from "@/api/apiRoutes";
import NoCartData from "@/assets/empty-state/empty-cart.svg";
import {
  clearActiveGuestCart,
  clearCartPromo,
  setCartCurrency,
  setCartDecimal,
  setCartProducts,
  setCartPromo,
  setCartSubTotal,
  setDoorStepDeliveryMode,
  setGuestCartTotal,
  setSelfPickupMode,
} from "@/redux/slices/cartSlice";
import { useRouter } from "next/router";
import CouponCodeCard from "@/components/couponcode/CouponCodeCard";
import NoCouponFound from "@/assets/empty-state/no-coupon.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import {
  RiArrowLeftLine,
  RiDeleteBin6Line,
  RiWallet3Line,
  RiCoupon3Line,
  RiCloseFill,
} from "react-icons/ri";
import AppliedCouponCard from "./AppliedCouponCard";
import UnlockCouponNudge from "./UnlockCouponNudge";
import { toast } from "react-toastify";
import giftAnimation from "@/assets/gift.json";
import couponBurstAnimation from "@/assets/order_place_animation/order_placed_back_animation.json";
import { getPrimaryLottieRgb, recolorAnimation } from "@/utils/lottieColor";
import Link from "next/link";
import CartDrawerSkeletons from "./CartDrawerLoading.jsx";
import QuickCheckoutView from "./QuickCheckoutView.jsx";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import { parseZonePath } from "@/utils/zoneUrl";
import useLanguages from "@/hooks/useLanguages";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import NotDeliverableMessage from "@/components/not-deliverable/NotDeliverableMessage";
import { formatCurrency } from "@/utils/helperFunction";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";

// Lottie is client-only (touches window) — load without SSR like the rest of the app.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// `setShowLogin` is Header's, not local: closing the cart unmounts this whole
// component (Header renders it as `{showCart && <CartDrawer/>}`), so a local
// showLogin flag set in the same handler dies before the modal can paint.
// Header's Login lives outside that conditional and survives the close.
const CartDrawer = ({
  showCart,
  setShowCart,
  setShowLogin,
  setMobileActiveKey,
}) => {
  const zoneHref = useZoneHref();
  const { storeClosed, notifyClosed, closedProps } = useStoreClosed();
  const { clearAll: clearUrlFilters } = useUrlProductFilters();
  const dispatch = useDispatch();
  const router = useRouter();
  const { parseLangPath } = useLanguages();
  const city = useSelector((state) => state.City.city);
  const cart = useSelector((state) => state.Cart);
  const user = useSelector((state) => state.User);
  const setting = useSelector((state) => state.Setting.setting);
  const language = useSelector((state) => state.Language.selectedLanguage);
  const coupon = useSelector((state) => state.Cart.promo_code);
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const activeChannel = shopMode === "quick" ? "quick" : "ecommerce";

  const [cartProductsData, setCartProductsData] = useState([]);
  const [cartData, setCartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponCode, setShowCouponCode] = useState(false);
  const [couponCodes, setCouponCodes] = useState([]);
  const [couponListLoading, setCouponListLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [notDeliverableMessage, setNotDeliverableMessage] = useState(null);
  // Success tick Lottie shown briefly when a coupon applies successfully.
  const [showCouponSuccess, setShowCouponSuccess] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  // Gift loading Lottie — black parts repainted with the brand primary color
  // (keeps the existing purple + white accents). Memoized so recolor runs once.
  const giftLottie = useMemo(
    () => recolorAnimation(giftAnimation, getPrimaryLottieRgb(), "black"),
    [],
  );

  // Currency symbol + decimal precision come from the /cart API response (per-channel).
  // Settings no longer carry currency, so fall back to the per-channel cart currency
  // cached in redux (mirror of the active channel).
  const currency = cartData?.currency ?? cart?.currency ?? "";
  // Prefer the /cart response's decimal_point; keep the redux mirror as a fallback
  // so it survives remove/add responses (which omit decimal_point and would
  // otherwise drop the drawer back to 0 decimals). Settings is the last resort.
  const decimals =
    cartData?.decimal_point ??
    cart?.decimal_point ??
    setting?.decimal_point ??
    0;
  const money = (amount) => formatCurrency(amount, currency, decimals);

  // Flash the success tick Lottie when a coupon transitions from none → applied.
  // Watching the redux promo_code covers EVERY apply path (typed, list card,
  // etc.) once, without firing on the silent auto-reapply (code unchanged) or on
  // removal. `hadCouponRef` remembers the previous applied code.
  const hadCouponRef = useRef(coupon?.promo_code || null);
  useEffect(() => {
    const nowCode = coupon?.promo_code || null;
    const prevCode = hadCouponRef.current;
    if (nowCode && nowCode !== prevCode && showCart) {
      setShowCouponSuccess(true);
      const timer = setTimeout(() => setShowCouponSuccess(false), 1600);
      hadCouponRef.current = nowCode;
      return () => clearTimeout(timer);
    }
    hadCouponRef.current = nowCode;
  }, [coupon?.promo_code, showCart]);

  const fetchCart = async () => {
    setLoading(true);
    setNotDeliverableMessage(null);
    try {
      const cartData = await api.getCart({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      // Deliverability is driven SOLELY by `is_deliverable_address` (1 = OK,
      // 0 = not serviceable). It must NOT empty the cart — products stay; only a
      // banner is shown when undeliverable.
      const isDeliverable =
        Number(cartData?.data?.is_deliverable_address) === 1;

      if (cartData?.status == 1) {
        const normalizedCart = cartData?.data?.cart?.map((item) => {
          const variant = item?.variants?.[0] || {};
          return {
            ...item,
            product_id: item?.id,
            product_variant_id: item?.variant_id,
            qty: variant?.quantity ?? item?.quantity,
            image_url: item?.images?.[0]?.image_url,
            attributes_text: variant?.attributes_text,
            variant_attributes:
              variant?.variant_attributes ?? item?.variant_attributes ?? [],
            // Per-product purchase cap from the API. Do NOT alias to stock — stock is
            // much larger than the allowed limit, so aliasing lets + run past the cap.
            total_allowed_quantity: item?.total_allowed_quantity ?? item?.stock,
          };
        });
        setCartProductsData(normalizedCart);
        dispatch(setCartSubTotal({ data: cartData?.data?.sub_total }));
        dispatch(setCartDecimal({ data: cartData?.data?.decimal_point }));
        dispatch(
          setCartCurrency({
            data: cartData?.data?.currency ?? "",
            channel: activeChannel,
          }),
        );
        dispatch(setSelfPickupMode({ data: cartData?.data?.self_pickup_mode }));
        dispatch(
          setDoorStepDeliveryMode({
            data: cartData?.data?.doorstep_delivery_mode,
          }),
        );
        setCartData(cartData?.data);
        // Undeliverable address → keep items, show banner (don't clear cart).
        setNotDeliverableMessage(
          isDeliverable
            ? null
            : t("sorry_we_are_not_delivering_on_selected_address"),
        );
        await handleApplyCoupon(cartData?.data?.sub_total);
        const productsData = normalizedCart?.map((product) => {
          return {
            product_id: product?.product_id,
            product_variant_id: product?.product_variant_id,
            qty: product?.qty,
          };
        });

        dispatch(setCartProducts({ data: productsData }));
        setLoading(false);
      } else {
        dispatch(setCartProducts({ data: [] }));
        dispatch(setCartSubTotal({ data: 0 }));
        setCartProductsData([]);
        if (cartData?.data && cartData?.message) {
          setNotDeliverableMessage(cartData.message);
        }
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      console.log("error", error);
    }
  };

  const handleApplyCoupon = async (currentAmount) => {
    setCouponLoading(true);
    try {
      const response = await api.setPromoCode({
        promoCodeName: coupon?.promo_code,
        amount: currentAmount ?? cart?.cartSubTotal,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
        setShowCouponCode(false);
      } else {
        await handleRemoveCoupon();
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setCouponLoading(false);
    }
  };

  // Apply a coupon the user typed/pasted directly (no list needed).
  const handleApplyTypedCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    try {
      const response = await api.setPromoCode({
        promoCodeName: code,
        amount: cart?.cartSubTotal,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
        setCouponInput("");
        setShowCouponCode(false);
      } else {
        toast.error(response.message || t("invalid_coupon_code"));
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleViewCoupons = async () => {
    setShowCouponCode(true);
    setCouponListLoading(true);
    try {
      const response = await api.getPromo({
        amount: cart?.cartSubTotal,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      setCouponCodes(response?.data || []);
    } catch (error) {
      console.log("Error", error);
    } finally {
      setCouponListLoading(false);
    }
  };

  const fetchGuestCart = async () => {
    setLoading(true);
    try {
      const variantIds = cart?.guestCart?.map((p) => p.product_variant_id);
      const quantities = cart?.guestCart?.map((p) => p.qty);
      const response = await api.getGuestCart({
        latitude: city?.latitude,
        longitude: city?.longitude,
        variant_ids: variantIds?.join(","),
        quantities: quantities?.join(","),
      });
      if (response.status == 1) {
        const normalizedCart = response?.data?.cart?.map((item) => {
          const variant = item?.variants?.[0] || {};
          return {
            ...item,
            product_id: item?.id,
            product_variant_id: item?.variant_id,
            qty: variant?.quantity ?? item?.quantity,
            image_url: item?.images?.[0]?.image_url,
            attributes_text: variant?.attributes_text,
            variant_attributes:
              variant?.variant_attributes ?? item?.variant_attributes ?? [],
            // Per-product purchase cap from the API. Do NOT alias to stock — stock is
            // much larger than the allowed limit, so aliasing lets + run past the cap.
            total_allowed_quantity: item?.total_allowed_quantity ?? item?.stock,
          };
        });
        setCartProductsData(normalizedCart);
        setCartData(response?.data);
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
        dispatch(setGuestCartTotal({ data: response?.data?.sub_total }));
        dispatch(
          setCartCurrency({
            data: response?.data?.currency ?? "",
            channel: activeChannel,
          }),
        );
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showCart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets coupon panel visibility when the drawer opens
      setShowCouponCode(false);
      if (cart?.isGuest && cart?.guestCart?.length == 0) {
        setCartProductsData([]);
      } else if (!cart.isGuest) {
        fetchCart();
      } else if (cart?.guestCart?.length > 0 && cart?.isGuest) {
        fetchGuestCart();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-fetches only when the drawer opens/closes; fetchCart/fetchGuestCart are re-created every render and cart.* mutations are reflected via their own dispatch flow, not by re-running this effect
  }, [showCart]);

  // Memoized so QuickCheckoutView's onClose-dependent effect (closing the
  // drawer on a payment-status route change) doesn't re-run every render.
  const closeCartDrawer = useCallback(() => setShowCart(false), [setShowCart]);

  const handleCheckoutbtnClick = () => {
    if (storeClosed) {
      notifyClosed();
      return;
    }
    // Quick + logged-in + items renders the single-page checkout instead (no
    // button). This handler only runs for guests (→ login) and non-quick (→
    // full checkout page).
    // Gate on the token too, not just `isGuest`: the two can desync (isGuest
    // only flips back to true on explicit logout/delete/401, so a cleared or
    // expired token can leave it false). The button already labels itself off
    // jwtToken, so checking only isGuest sent a token-less user to /checkout
    // instead of opening the login modal.
    if (cart.isGuest || !user?.jwtToken) {
      setShowCart(false);
      setShowLogin(true);
    } else {
      router.push(zoneHref("/checkout"));
    }
  };

  const isCouponApplied = cart?.promo_code != null;
  // "wallet" apply-type coupons are cashback, NOT a price discount: the order
  // total is not reduced — the amount is credited back to the wallet after the
  // order. "instant" coupons (flat or percentage) reduce the price up-front.
  const isCashbackCoupon = cart?.promo_code?.discount_apply_type === "wallet";
  const promoDiscount = Number(cart?.promo_code?.discount || 0);
  const savedAmount = Number(cartData?.saved_amount || 0);
  const cartTotalWithCoupon =
    isCouponApplied && !isCashbackCoupon
      ? cart?.cartSubTotal - savedAmount - promoDiscount
      : cart?.cartSubTotal - savedAmount;
  const handleRemoveCoupon = async () => {
    setCouponLoading(true);
    dispatch(clearCartPromo());
    setCouponLoading(false);
  };
  // "Shop Now" means browse everything, so the whole filter state has to go —
  // clearAllFilter resets category/brand/seller/search AND listing_source.
  //
  // When the user is ALREADY on the products listing we must cancel the
  // navigation instead of letting the <Link> run. Zone URLs (/{zone}/products)
  // exist only as middleware rewrites, not as real page files, so Next's client
  // router can't match them and falls back to a FULL PAGE LOAD — which reloads
  // the same listing and wipes the filter reset we just dispatched. Clearing
  // filters + closing the drawer is the entire job here anyway; there is nowhere
  // to navigate to.
  const isOnProductsRoute = () => {
    const path = router.asPath.split(/[?#]/)[0];
    const { rest: afterLang } = parseLangPath(path);
    const { rest } = parseZonePath("/" + afterLang.join("/"));
    return rest[0] === "products" && rest.length === 1;
  };

  const handleShopNow = (e) => {
    dispatch(clearAllFilter());
    // Filter VALUES live in the URL now — the redux reset above only clears
    // the non-filter bookkeeping. Must also strip the URL's own filter params,
    // or "Shop Now" while already on a filtered /products leaves them applied.
    clearUrlFilters();
    setShowCart(false);
    if (isOnProductsRoute()) e.preventDefault();
  };

  // Single-page checkout: in quick mode a logged-in user with items sees ONE
  // combined view (items + address + payment + bill), never a separate cart step.
  // Guests must log in first (checkout needs an account), so they keep the cart
  // view + its login-to-checkout button. Both channels (quick + ecommerce) use
  // the single-page drawer checkout; the delivery-time badge inside it stays
  // quick-only (ecommerce ships, no local ETA).
  const useSinglePageCheckout =
    !cart?.isGuest &&
    user?.jwtToken &&
    cartProductsData?.length > 0 &&
    !notDeliverableMessage;

  let drawerTitle = t("shoppingCart");
  if (showCouponCode) {
    drawerTitle = t("coupons");
  } else if (useSinglePageCheckout) {
    drawerTitle = t("checkout");
  }

  const renderCouponList = () => {
    if (couponListLoading) return <CartDrawerSkeletons />;
    if (couponCodes?.length > 0) {
      return (
        <div className="flex flex-col gap-3">
          {couponCodes?.map((coupon) => (
            <CouponCodeCard
              key={coupon?.id}
              coupon={coupon}
              setShowCouponCode={setShowCouponCode}
            />
          ))}
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <ThemedSvg
          src={NoCouponFound}
          alt={"Image not found"}
          className="h-48 w-48"
        />
        <p className="text-lg font-bold">{t("no_coupon_code_available")}</p>
      </div>
    );
  };

  // Coupon entry box (guest/no-coupon), applied-coupon card, or the gift
  // loading animation while a coupon is being validated.
  const renderCouponFooter = () => {
    if (couponLoading) {
      return (
        <div className="mb-2 flex items-center justify-center py-2">
          <Lottie
            animationData={giftLottie}
            loop={true}
            className="h-16 w-16"
          />
        </div>
      );
    }
    if (!cart?.isGuest && !isCouponApplied) {
      return (
        <div className="mb-2 flex flex-col gap-2">
          {/* Type / paste a coupon, then Apply. Ticket icon tile on the
              left, embedded Apply pill on the right. */}
          <div className="flex h-12 items-center gap-2 rounded-xl border cardBorder bg-white pl-2 pr-1.5 transition-colors focus-within:primaryColorBorder dark:bg-zinc-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
              <RiCoupon3Line size={17} />
            </span>
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyTypedCoupon()}
              placeholder={t("enter_coupon_code") || "Enter coupon code"}
              className="min-w-0 flex-grow bg-transparent text-sm font-bold uppercase tracking-wide outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:SecondaryTextColor textColor"
            />
            <button
              type="button"
              onClick={handleApplyTypedCoupon}
              disabled={!couponInput.trim() || couponLoading}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed"
              style={{
                backgroundColor: couponInput.trim()
                  ? "var(--primary-color)"
                  : "color-mix(in srgb, var(--primary-color) 35%, #fff)",
              }}
            >
              {couponLoading ? "..." : t("apply") || "Apply"}
            </button>
          </div>

          {/* Coupon panel — its own card below the input. */}
          <UnlockCouponNudge
            code={cartData?.unlock_promo_code}
            message={cartData?.unlock_message}
            onViewAll={handleViewCoupons}
          />
        </div>
      );
    }
    if (!cart?.isGuest && isCouponApplied) {
      return (
        // key on the code → the success micro-interaction replays each
        // time a new coupon is applied.
        <AppliedCouponCard
          key={cart?.promo_code?.promo_code}
          code={cart?.promo_code?.promo_code}
          savedAmount={money(cart?.promo_code?.discount)}
          discountType={cart?.promo_code?.discount_type}
          onRemove={handleRemoveCoupon}
          loading={couponLoading}
        />
      );
    }
    return null;
  };

  const handleClearCart = async () => {
    setClearLoading(true);
    try {
      // Guest carts live in Redux only (no server cart). Clear the active
      // channel's bucket locally instead of calling deleteCart().
      if (cart?.isGuest) {
        dispatch(clearActiveGuestCart());
        setCartProductsData([]);
        setCartData([]);
        dispatch(clearCartPromo());
        setShowCouponCode(false);
        return;
      }
      const response = await api.deleteCart();
      if (response?.status == 1) {
        setCartProductsData([]);
        setCartData([]);
        dispatch(setCartProducts({ data: [] }));
        dispatch(setCartSubTotal({ data: 0 }));
        dispatch(clearCartPromo());
        setShowCouponCode(false);
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setClearLoading(false);
    }
  };

  const renderCartWithItems = () => (
    <>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-sm font-medium SecondaryTextColor">
          {cartProductsData?.length} {t("items")}
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-red-500 transition-opacity hover:opacity-80 disabled:opacity-50"
          onClick={handleClearCart}
          disabled={clearLoading}
        >
          <RiDeleteBin6Line size={16} />
          {clearLoading ? "..." : t("clear_cart")}
        </button>
      </div>
      <div className="flex flex-grow flex-col gap-2 overflow-y-auto px-3 pb-3">
        {cartProductsData?.map((product) => (
          <CartProductsCard
            key={product?.id}
            product={product}
            cartProductsData={cartProductsData}
            setCartProductsData={setCartProductsData}
            setCartData={setCartData}
            currency={currency}
            decimals={decimals}
          />
        ))}
      </div>
      {/* Delivery banner — cart stays visible, only delivery is blocked */}
      {notDeliverableMessage && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {notDeliverableMessage}
          </p>
        </div>
      )}
      <div className="sticky bottom-0 w-full border-t bg-white p-4 dark:bg-zinc-900">
        {renderCouponFooter()}

        <div className="space-y-2">
          {!cart.isGuest && (
            <div className="flex justify-between text-sm SecondaryTextColor">
              <span>{t("subtotal")}</span>
              <span>{money(cart?.cartSubTotal)}</span>
            </div>
          )}
          {!cart.isGuest && isCouponApplied && !isCashbackCoupon && (
            <div className="flex justify-between text-sm primaryColor dark:text-green-400">
              <span>{t("coupon_discount")}</span>
              <span>-{money(promoDiscount)}</span>
            </div>
          )}
          {!cart.isGuest && cartData?.saved_amount > 0 && (
            <div className="flex justify-between text-sm primaryColor dark:text-green-400">
              <span>{t("you_save")}</span>
              <span>{money(cartData?.saved_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold textColor">
            <span>{t("total")}</span>
            <span>
              {cart.isGuest
                ? money(cart?.guestCartTotal)
                : money(cartTotalWithCoupon)}
            </span>
          </div>
        </div>

        {/* Cashback is NOT part of the total — it is credited to the wallet
            after the order. Shown as a separate reward callout, never as a
            line in the price breakdown above. */}
        {!cart.isGuest && isCouponApplied && isCashbackCoupon && (
          <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <RiWallet3Line size={18} />
            </span>
            <div className="min-w-0 flex-grow">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {t("you_will_earn_cashback")} {money(promoDiscount)}
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                {t("cashback_added_to_wallet")}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          {/* <button
              className="cardBorder textColor flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
              onClick={() => router.push(zoneHref("/cart"))}
            >
              {t("view_cart")}
            </button> */}
          <button
            type="button"
            {...closedProps}
            className={`primaryBackColor flex-[1.5] rounded-lg py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 disabled:cursor-not-allowed ${closedProps.className ?? ""}`}
            onClick={handleCheckoutbtnClick}
            disabled={!!notDeliverableMessage}
          >
            {!user?.jwtToken ? t("login_to_checkout") : t("checkout")}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <Sheet open={showCart}>
      <SheetContent
        side={language?.type == "RTL" ? "left" : "right"}
        className="p-0 w-full sm:!max-w-md lg:!max-w-lg flex flex-col h-[100dvh]"
      >
        {/* Coupon-applied success burst — confetti fills the drawer with a
              centered tick on top, like the order-placed celebration. */}
        {showCouponSuccess && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/5 backdrop-blur-[1px]">
            <Lottie
              className="absolute inset-0 h-full w-full"
              animationData={couponBurstAnimation}
              loop={false}
            />
          </div>
        )}
        <SheetHeader className="px-4 py-3 border-b text-left">
          <SheetTitle className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {showCouponCode && (
                <button
                  type="button"
                  className="hover:cursor-pointer"
                  onClick={() => setShowCouponCode(false)}
                  aria-label={t("back")}
                >
                  <RiArrowLeftLine size={24} />
                </button>
              )}
              <p className="text-xl font-bold">{drawerTitle}</p>
            </div>
            <button
              type="button"
              className="closeButtonBg flex items-center justify-center rounded-full p-2 transition-colors hover:opacity-80"
              onClick={() => setShowCart(false)}
              aria-label={t("close")}
            >
              <RiCloseFill size={22} />
            </button>
          </SheetTitle>
        </SheetHeader>

        {showCouponCode ? (
          <div className="flex-grow overflow-y-auto p-3">
            {renderCouponList()}
          </div>
        ) : loading ? (
          <CartDrawerSkeletons />
        ) : useSinglePageCheckout ? (
          <QuickCheckoutView
            onClose={closeCartDrawer}
            money={money}
            currency={currency}
            decimals={decimals}
            cartProductsData={cartProductsData}
            setCartProductsData={setCartProductsData}
            setCartData={setCartData}
            onViewCoupons={handleViewCoupons}
          />
        ) : cartProductsData?.length !== 0 ? (
          renderCartWithItems()
        ) : notDeliverableMessage ? (
          <NotDeliverableMessage
            message={notDeliverableMessage}
            onActionClick={() => setShowCart(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <ThemedSvg
                src={NoCartData}
                alt="No Cart Data"
                className="w-48 object-contain sm:w-64"
              />
              <h1 className="text-xl font-bold">
                {t("empty_cart_list_message")}
              </h1>
              <p className="text-sm opacity-60">
                {t("empty_cart_list_description")}
              </p>
              <Link
                href={zoneHref("/products")}
                className="primaryBackColor mt-2 rounded-md px-6 py-2 font-bold text-white transition-opacity hover:opacity-90"
                onClick={handleShopNow}
              >
                {t("empty_cart_list_button_name")}
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
