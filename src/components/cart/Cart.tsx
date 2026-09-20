"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import CartProductCard from "./CartProductCard";
import CartCouponCard from "./CartCouponCard";
import { t } from "@/utils/translation";
import { useSelector, useDispatch } from "react-redux";
import {
  setCart,
  setCartCurrency,
  setCartDecimal,
  setCartProducts,
  setCartSubTotal,
  setDoorStepDeliveryMode,
  setSelfPickupMode,
  clearCartPromo,
} from "@/redux/slices/cartSlice";
import * as api from "@/api/apiRoutes";
import CouponCodeDrawer from "@/components/couponcode/CouponCodeDrawer";
import NoCartData from "@/assets/empty-state/empty-cart.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import CartPageSkeleton, { CartCouponSkeleton } from "./CartLoading";
import { useRouter } from "next/navigation";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import couponBurstAnimation from "@/assets/order_place_animation/order_placed_back_animation.json";
import useZoneHref from "@/hooks/useZoneHref";
import useCurrency from "@/hooks/useCurrency";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const Cart = () => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();
  const router = useRouter();
  const city = useSelector((state: any) => state.City.city);
  const cart = useSelector((state: any) => state.Cart);
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const activeChannel = shopMode === "quick" ? "quick" : "ecommerce";
  // Cart row shape varies by API response (guest vs server cart) — kept `any[]`,
  // matching the untyped api.getCart/getGuestCart responses.
  const [cartProductsData, setCartProductsData] = useState<any[]>([]);
  const [showCouponCode, setShowCouponCode] = useState(false);
  // Initial value is `[]` (matches the original pre-TS code) even though every
  // read is a property access (cartData?.currency, etc) — setCartData(res?.data)
  // below replaces it with the real object once the fetch resolves.
  const [cartData, setCartData] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  // Confetti burst shown briefly when a coupon is newly applied.
  const [showCouponBurst, setShowCouponBurst] = useState(false);

  // Fire the burst when the redux promo_code transitions none → applied. Covers
  // every apply path once; skips silent re-validate (same code) + removal.
  const hadCouponRef = useRef(cart?.promo_code?.promo_code || null);
  useEffect(() => {
    const nowCode = cart?.promo_code?.promo_code || null;
    const prevCode = hadCouponRef.current;
    hadCouponRef.current = nowCode;
    if (nowCode && nowCode !== prevCode) {
      setShowCouponBurst(true);
      const timer = setTimeout(() => setShowCouponBurst(false), 1600);
      return () => clearTimeout(timer);
    }
  }, [cart?.promo_code?.promo_code]);

  // Currency symbol + decimal precision. countrySetting (zone-aware, authoritative)
  // wins over any per-response /cart field or the global settings slice — see
  // useCurrency's doc comment. The redux dispatches below (setCartCurrency/
  // setCartDecimal) still run for other readers of state.Cart; this page's own
  // display no longer reads them.
  const { currency, decimals } = useCurrency();

  // Initial load + channel switch: hit the /cart API ONCE. The API is channel-scoped
  // via the request header (quick vs ecommerce), so switching Quick <-> Shop all must
  // re-fetch. After this, add/remove/qty do NOT re-call getCart — the page renders
  // from the redux cart list (kept fresh by every mutation's setCart dispatch), so we
  // avoid a getCart round-trip on every action.
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
        setCartProductsData(response.data.cart);
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
        dispatch(
          setCartCurrency({
            data: response?.data?.currency ?? "",
            channel: activeChannel,
          }),
        );
        dispatch(setCartDecimal({ data: response?.data?.decimal_point }));
      }
      setLoading(false);
      setInitialLoad(false);
    } catch (error) {
      setLoading(false);
      setInitialLoad(false);
      console.log("Error", error);
    }
  };

  const fetchCart = async () => {
    setLoading(true);
    try {
      const res = await api.getCart({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (res?.status == 1) {
        setCartProductsData(res?.data?.cart);
        // Seed the redux cart list so the redux-driven rebuild effect has a source
        // and later mutations keep the page in sync without another getCart.
        dispatch(setCart({ data: res }));
        dispatch(setCartSubTotal({ data: res?.data?.sub_total }));
        dispatch(
          setCartCurrency({
            data: res?.data?.currency ?? "",
            channel: activeChannel,
          }),
        );
        dispatch(setCartDecimal({ data: res?.data?.decimal_point }));
        dispatch(setSelfPickupMode({ data: res?.data?.self_pickup_mode }));
        dispatch(
          setDoorStepDeliveryMode({
            data: res?.data?.doorstep_delivery_mode,
          }),
        );
        setCartData(res?.data);
        setLoading(false);
        setInitialLoad(false);
        const productsData = res?.data?.cart?.map((product) => {
          return {
            product_id: product?.id,
            product_variant_id: product?.variant_id,
            qty: Number(product?.variants?.[0]?.quantity ?? product?.qty ?? 0),
          };
        });
        dispatch(setCartProducts({ data: productsData }));
      } else {
        dispatch(setCartProducts({ data: [] }));
        dispatch(setCart({ data: { data: { cart: [] } } }));
        dispatch(setCartSubTotal({ data: 0 }));
        setCartProductsData([]);
        setLoading(false);
        setInitialLoad(false);
      }
    } catch (error) {
      setLoading(false);
      setInitialLoad(false);
      console.log("error", error);
    }
  };

  useEffect(() => {
    if (cart?.isGuest && cart?.guestCart?.length == 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets cart rows when the guest cart is empty
      setCartProductsData([]);
      setInitialLoad(false);
    } else if (!cart.isGuest) {
      fetchCart();
    } else if (cart?.guestCart?.length > 0 && cart?.isGuest) {
      fetchGuestCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to shopMode only (channel switch); fetchCart/fetchGuestCart are re-created every render and cart.* mutations are synced via the redux-driven effect below, not by re-fetching here
  }, [shopMode]);

  // Redux-driven list: rebuild the on-screen rows from the full server cart that
  // lives in redux (state.Cart.cart.data.cart). Every mutation — this page's own
  // remove/qty (syncFromServerCart) AND external adds (FBT / variant modal / product
  // cards) — dispatches setCart with the full response, so this keeps the list in
  // sync WITHOUT calling getCart again. Guest carts use their own flow above.
  const reduxServerCart = cart?.cart?.data?.cart;
  useEffect(() => {
    if (cart?.isGuest) return;
    if (!Array.isArray(reduxServerCart)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives cart rows from the redux server cart
    setCartProductsData(reduxServerCart);
    setInitialLoad(false);
  }, [reduxServerCart, cart?.isGuest]);

  // Show skeleton during initial load
  if (initialLoad) {
    return (
      <>
        <BreadCrumb />
        <CartPageSkeleton />
      </>
    );
  }

  // Show empty state when no products and not loading
  if (!loading && cartProductsData?.length === 0) {
    return (
      <section>
        <BreadCrumb />
        <div className="container">
          <div className="flex items-center justify-center h-full my-auto mx-10">
            <div className="flex items-center justify-center flex-col gap-2 my-4">
              <ThemedSvg
                src={NoCartData}
                alt="No Cart Data"
                className="w-3/4 max-w-[280px] object-contain"
              />
              <h1 className="font-bold text-[22px] text-center py-2">
                {t("empty_cart_list_message")}
              </h1>
              <p className="font-bold text-xs text-center">
                {t("empty_cart_list_description")}
              </p>
              <button
                type="button"
                onClick={() => {
                  router.push(zoneHref("/products"));
                  dispatch(clearAllFilter());
                  setShowCouponCode(false);
                  dispatch(clearCartPromo());
                }}
                className="primaryBackColor text-white font-bold p-1 rounded-sm"
              >
                {t("empty_cart_list_button_name")}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Coupon-applied confetti burst — full-screen, non-blocking, plays once. */}
      {showCouponBurst && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
          <Lottie
            className="h-full w-full"
            animationData={couponBurstAnimation}
            loop={false}
            style={{ transform: "scale(1.3)" }}
          />
        </div>
      )}
      <BreadCrumb />
      <div className="container">
        {
          // Only the FIRST load shows a skeleton (handled by `initialLoad` above).
          // Add/remove/qty refetches run in the BACKGROUND — the rows already update
          // optimistically via syncFromServerCart, so re-showing the skeleton here
          // caused the whole cart to flash on every remove. Render content directly.
          <div className="my-12 px-2">
            <div className="flex flex-col gap-1">
              <h1 className="font-bold text-2xl">{t("myCart")}</h1>
              <p className="font-medium text-base">
                {`${t("there_are")} ${cartProductsData?.length} ${t(
                  "product_in_your_cart",
                )}`}
              </p>
            </div>
            <div className="grid grid-cols-12 gap-4 mt-6">
              <div className="col-span-12 lg:col-span-8 cardBorder !rounded-lg shadow-sm w-full overflow-hidden self-start">
                <div className="flex items-center justify-between gap-2 p-4 border-b backgroundColor">
                  <span className="font-bold text-lg">{t("product")}</span>
                  <span className="text-sm SecondaryTextColor">
                    {cartProductsData?.length} {t("items")}
                  </span>
                </div>
                <div className="flex flex-col">
                  {/* Render straight from the synced local list (same as the cart
                      drawer). Do NOT gate on redux cart.cartProducts qty — during the
                      optimistic +/- debounce window that lookup briefly mismatches and
                      filtered the row out, making the item vanish ("Not Found") until a
                      page refresh. syncFromServerCart already drops removed rows. */}
                  {cartProductsData?.map((product) => (
                    <CartProductCard
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
              </div>
              <div className="col-span-12 lg:col-span-4">
                {loading ? (
                  <CartCouponSkeleton />
                ) : (
                  <CartCouponCard
                    setShowCouponCode={setShowCouponCode}
                    cartData={cartData}
                  />
                )}
              </div>
            </div>
          </div>
        }
      </div>
      <CouponCodeDrawer
        showCouponCode={showCouponCode}
        setShowCouponCode={setShowCouponCode}
      />
    </section>
  );
};

export default Cart;
