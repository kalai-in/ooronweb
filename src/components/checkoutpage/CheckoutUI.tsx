"use client";
import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import {
  FiMapPin,
  FiPlus,
  FiMinus,
  FiTrash2,
  FiCreditCard,
  FiShoppingBag,
  FiTag,
  FiChevronRight,
  FiChevronLeft,
  FiEdit2,
  FiHome,
  FiBriefcase,
  FiMoreVertical,
  FiCheck,
  FiInfo,
} from "react-icons/fi";
import { CiWallet } from "react-icons/ci";
import { FaMoneyBillWave } from "react-icons/fa";
import { MdOutlineCelebration, MdRemoveShoppingCart } from "react-icons/md";
import { RiCouponLine, RiWallet3Line, RiCloseFill } from "react-icons/ri";
import { TbDiscount } from "react-icons/tb";
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

import * as api from "@/api/apiRoutes";
import { t } from "@/utils/translation";
import {
  formatCurrency,
  hasMissingRequiredPrescriptions,
  getMaxAddableQuantity,
} from "@/utils/helperFunction";
import { useDebouncedQuantity, FlushCtx } from "@/hooks/useDebouncedQuantity";
// PrescriptionUpload.jsx (out of scope for this migration batch) is still untyped
// JS; under this project's allowJs/checkJs:false config TS misinfers its exported
// component type from its JSDoc param comments as `(string | number)`. Cast to
// `any` at the import boundary — same pattern used in the cart/** files above.
import PrescriptionUploadRaw from "@/components/prescription/PrescriptionUpload";
const PrescriptionUpload = PrescriptionUploadRaw as any;
import { isRtl } from "@/lib/utils";
import { LuTriangleAlert } from "react-icons/lu";
import {
  Dialog as DialogRaw,
  DialogContent as DialogContentRaw,
  DialogOverlay as DialogOverlayRaw,
} from "@/components/ui/dialog";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import CheckoutSkeleton from "./CheckoutSkeleton";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneNumberInput from "@/components/phonenumberinput/PhoneNumberInput";
import useBillingDetails from "@/hooks/useBillingDetails";
import useCurrency from "@/hooks/useCurrency";

// src/components/ui/dialog.tsx (out of scope for this migration batch, owned by a
// concurrent agent) is a .tsx file but its exports are still untyped forwardRef
// components, so TS infers overly-narrow prop types for them. Cast to `any` at the
// boundary rather than touch the shared ui component — same pattern as
// StripeModal.tsx / VariantsModal.tsx elsewhere in this migration.
const Dialog = DialogRaw as any;
const DialogContent = DialogContentRaw as any;
const DialogOverlay = DialogOverlayRaw as any;

// Brand payment-gateway logos (same SVGs as the wallet recharge modal) so each
// method shows its real logo instead of a generic GPay/card icon.
import RazorpayLogo from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalLogo from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackLogo from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StripeLogo from "@/assets/payment_methods_svgs/ic_stripe.svg";
import CashfreeLogo from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import MidtransLogo from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeLogo from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsLogo from "@/assets/payment_methods_svgs/ic_paytabs.svg";

const HomeVerticleProductCard = dynamic(
  () => import("../productcards/HomeVerticleProductCard"),
  { ssr: false },
);

import {
  clearCartPromo,
  clearPrescriptions,
  setCartCheckout,
  setCartProducts,
  setCartPromo,
} from "@/redux/slices/cartSlice";
import {
  setAllAddresses,
  setSelectedAddresForEdit,
} from "@/redux/slices/addressSlice";
import {
  setAddress,
  setCheckoutTotal,
  setPhonePeCheckoutDetails,
  setOrderType,
  setPaymentMethod,
  setWalletChecked,
  setUserWalletBalance,
  setOrderNote,
} from "@/redux/slices/checkoutSlice";
import { setCurrentUser } from "@/redux/slices/userSlice";

const NewAddressModal = dynamic(
  () => import("../newaddressmodal/NewAddressModal"),
  { ssr: false },
);
const StripeModal = dynamic(() => import("./StripeModal"), { ssr: false });
import UnlockCouponNudge from "@/components/cart/UnlockCouponNudge";
const CouponCodeDrawer = dynamic(
  () => import("../couponcode/CouponCodeDrawer"),
  { ssr: false },
);
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import couponBurstAnimation from "@/assets/order_place_animation/order_placed_back_animation.json";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";

// @paystack/inline-js touches `window` at module scope, so a static top-level
// import throws during SSR now that this component is imported directly
// (no longer behind next/dynamic's ssr:false). Same lazy-load pattern already
// used by WalletBalanceModal.jsx for the same package.
// No bundled types for this package — `any` is the pragmatic choice for a
// third-party payment SDK internal, per this project's typing policy.
let PaystackPop: any;
if (typeof window !== "undefined") {
  import("@paystack/inline-js").then((module) => {
    PaystackPop = module.default;
  });
}

interface CheckoutItemRowProps {
  /** checkout cart line shape from api.getCart(checkout:1) — no exported type,
   * kept `any` per this migration's pragmatic-TS policy for API row shapes. */
  product: any;
  money: (amount?: number | string) => string;
  onCommitQty: (
    product: any,
    variantId: number | string,
    nextQty: number,
    ctx?: FlushCtx,
  ) => void | Promise<void>;
  onRemoveUnits: (
    product: any,
    variantId: number | string,
    units?: number,
    ctx?: FlushCtx,
  ) => void | Promise<void>;
  /** Store-wide cap on total cart quantity (setting?.setting?.max_cart_items_count
   * from the parent). Missing/unlimited → no store-wide cap. */
  maxCartItemsCount?: number | string | null;
  /** Cart's total quantity across every other line (i.e. itemCount minus this
   * line's own current qty) — the headroom left under maxCartItemsCount before
   * this line's own qty is added back in. */
  otherLinesQty?: number;
}

// One cart line. Owns its optimistic+debounced stepper so rapid +/- clicks fire
// a single network call (matches HomeVerticleProductCard). Parent supplies the
// commit/remove side effects (they refetch checkout totals + reapply coupon).
const CheckoutItemRow = ({
  product,
  money,
  onCommitQty,
  onRemoveUnits,
  maxCartItemsCount,
  otherLinesQty,
}: CheckoutItemRowProps) => {
  const { guard: guardClosed, closedProps } = useStoreClosed();
  const variant = product?.variants?.[0] || {};
  const unitPrice =
    product?.discounted_price && product?.discounted_price != 0
      ? product?.discounted_price
      : product?.price;
  const productName = product?.product?.translations?.name || product?.name;
  const imageUrl = product?.images?.[0]?.image_url || variant?.image;
  const serverQty = Number(variant?.quantity ?? product?.qty ?? 0);
  const variantText = variant?.attributes_text;
  const variantId = variant?.id ?? product?.variant_id;

  const maxQty = getMaxAddableQuantity({
    maxCartItemsCount,
    otherLinesQty,
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: product?.is_unlimited_stock !== 0,
    stock: product?.stock,
  });

  // Out of stock: limited stock (is_unlimited_stock === 0) AND nothing left.
  // Variant stock takes precedence when present, else the product-level stock.
  const stockLeft = Number(variant?.stock ?? product?.stock ?? 0);
  const outOfStock =
    Number(product?.is_unlimited_stock) === 0 && stockLeft <= 0;

  const { displayQty, increment, decrement } = useDebouncedQuantity({
    serverQty,
    onCommit: (qty, ctx) => onCommitQty(product, variantId, qty, ctx),
    onRemove: (units, ctx) => onRemoveUnits(product, variantId, units, ctx),
    max: Number.isFinite(maxQty) ? maxQty : undefined,
    onMax: () =>
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      }),
  });

  const qty = displayQty;
  // At the cap (max_cart_items_count headroom, total_allowed_quantity, or stock
  // when limited) → grey out "+", matching CartProductCard / HomeVerticleProductCard.
  // The hook already refuses to go past `maxQty`; this stops the button looking
  // clickable when it can only ever fire the max-limit toast. maxQty folds in all
  // three ceilings, so atMaxQty derives from it alone rather than recomputing.
  const atMaxQty = Number.isFinite(maxQty) && qty >= maxQty;

  // Strike-through original price + % off when the item is discounted.
  const basePrice = Number(product?.price) || 0;
  const hasDiscount = unitPrice && basePrice && unitPrice < basePrice;
  const offPercent = hasDiscount
    ? Math.round(((basePrice - unitPrice) / basePrice) * 100)
    : 0;

  return (
    <div className="flex gap-3 md:gap-4 px-4 md:px-5 py-4 border-t hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
      {/* image */}
      <div className="relative w-[72px] h-[72px] md:w-20 md:h-20 rounded-xl overflow-hidden cardBorder shrink-0 bg-white dark:bg-zinc-900">
        <ImageWithPlaceholder
          src={imageUrl}
          alt={productName}
          width={160}
          height={160}
          className={`w-full h-full object-contain p-1.5 ${
            outOfStock ? "opacity-40 grayscale" : ""
          }`}
        />
      </div>

      {/* details */}
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        {/* top row: name (left) + line total (right) — Flipkart-style alignment */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm md:text-base line-clamp-2 leading-snug">
              {productName}
            </h3>
            {variantText && (
              <p className="text-xs SecondaryTextColor truncate mt-0.5">
                {variantText}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="font-bold text-sm md:text-base whitespace-nowrap">
              {money(unitPrice * qty)}
            </span>
            {qty > 1 && (
              <span className="text-[11px] SecondaryTextColor whitespace-nowrap">
                {qty} × {money(unitPrice)}
              </span>
            )}
          </div>
        </div>

        {/* unit price + strike + % off */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold textColor">
            {money(unitPrice)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-xs SecondaryTextColor line-through">
                {money(basePrice)}
              </span>
              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                {offPercent}% {t("off")}
              </span>
            </>
          )}
        </div>

        {product?.slab_discount_message && (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/15 px-2 py-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
            <TbDiscount size={14} className="shrink-0" />
            {product?.slab_discount_message}
          </p>
        )}

        {/* qty stepper + inline prescription upload + remove — one row when empty
            (3 together); uploaded file link wraps to its own line below. */}
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {outOfStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-500 dark:text-red-400">
              <MdRemoveShoppingCart size={14} className="shrink-0" />
              {t("sold_out") || "Sold Out"}
            </span>
          ) : (
            <div
              {...closedProps}
              className={`flex items-center primaryColorBorder border rounded-lg overflow-hidden ${closedProps.className ?? ""}`}
            >
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center primaryColor dark:text-white disabled:opacity-30 hover:primaryLightBack transition"
                onClick={decrement}
                disabled={qty <= 1}
              >
                <FiMinus size={14} />
              </button>
              <span className="text-sm font-bold w-8 text-center primaryColor dark:text-white">
                {qty}
              </span>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center primaryColor dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:primaryLightBack transition"
                onClick={guardClosed(increment)}
                disabled={atMaxQty}
                title={atMaxQty ? t("max_cart_limit_error") : undefined}
              >
                <FiPlus size={14} />
              </button>
            </div>
          )}
          {/* prescription — medical (product_type 5) only */}
          {Number(product?.product_type) === 5 && (
            <PrescriptionUpload
              variantId={variantId}
              isRequired={product?.is_prescription_required}
              inline
            />
          )}
          <button
            type="button"
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            onClick={() => onRemoveUnits(product, variantId, qty)}
            aria-label={t("delete")}
          >
            <FiTrash2 size={15} />
            <span className="hidden sm:inline">{t("delete")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckoutUI = () => {
  const zoneHref = useZoneHref();
  const { storeClosed, notifyClosed, closedProps } = useStoreClosed();
  const router = useRouter();
  const dispatch = useDispatch();
  const rtl = isRtl();

  const cart = useSelector((state: any) => state.Cart);
  const address = useSelector((state: any) => state.Addresses);
  const user = useSelector((state: any) => state.User.user);
  const setting = useSelector((state: any) => state.Setting);
  const checkout = useSelector((state: any) => state.Checkout);
  const prescriptions = useSelector((state: any) => state.Cart.prescriptions);
  const city = useSelector((state: any) => state.City.city);
  const theme = useSelector((state: any) => state.Theme.theme);
  // Active sales channel (quick vs ecommerce). Header keeps cart.activeChannel
  // in sync with the shop-mode toggle; we watch it so the checkout refetches
  // when the channel changes mid-checkout (was stale before — no channel dep).
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const activeChannel = cart?.activeChannel;

  // Redux cart line count — drives a checkout refetch when an item is added or
  // removed OUTSIDE this page's own handlers (e.g. the Frequently Bought Together
  // strip, which dispatches setCartProducts). Without watching this, adding a
  // cross-sell product left "Your Cart" showing the stale list until reload.
  const reduxCartCount = cart?.cartProducts?.length ?? 0;
  const guestCartCount = cart?.guestCart?.length ?? 0;

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  // Checkout (/cart?checkout=1) response payload — no exported type, kept `any`
  // per this migration's pragmatic-TS policy for API response shapes.
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [checkOutError, setCheckOutError] = useState(false);
  // Delivery validation is SEPARATE from cart contents. status:0 ("not delivering
  // on selected address") must NOT empty the cart — it only means charges/total
  // can't be computed for this address. Cart items stay visible from the last
  // successful checkout response held in `lastCartRef`.
  const [deliveryError, setDeliveryError] = useState("");
  const lastCartRef = useRef<any>(null);
  // Guard against out-of-order responses when the user switches addresses fast.
  const fetchSeqRef = useRef(0);
  const [crossSell, setCrossSell] = useState<any[]>([]);
  const [upSell, setUpSell] = useState<any[]>([]);
  // Confetti burst shown briefly when a coupon is newly applied.
  const [showCouponBurst, setShowCouponBurst] = useState(false);

  const [showAddAddres, setShowAddAddres] = useState(false);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  // Address pending deletion — drives the styled confirm modal (replaces the
  // native window.confirm). null = modal closed.
  const [addressToDelete, setAddressToDelete] = useState<any>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);

  // Currency symbol + decimal precision — countrySetting (zone-aware,
  // refetched on city change) is authoritative for this LIVE checkout screen;
  // checkout/cart response fields have been seen carrying a stale/wrong
  // currency (e.g. the merchant's default INR even in an AED zone), so they
  // are only used when countrySetting hasn't loaded yet.
  const {
    currency: liveCurrency,
    currencyCode: liveCurrencyCode,
    decimals: liveDecimals,
  } = useCurrency();
  const currency =
    liveCurrency || checkoutData?.currency || cart?.currency;
  const decimals = liveDecimals || checkoutData?.decimal_point || 0;
  const currencyCode =
    liveCurrencyCode || checkoutData?.currency_code || cart?.currency_code;

  const [discountInput, setDiscountInput] = useState("");
  const [showCouponCode, setShowCouponCode] = useState(false);
  // Payment picker drawer. Collapsed payment card shows just the selected method
  // + "Change"; the drawer lists all enabled methods. Keeps the right column
  // short so Order Summary + Place Order stay visible even with 10-12 gateways.
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  // Inline "+ Add delivery instruction" below the cart. Collapsed by default;
  // opens a textarea when clicked (or when a note already exists).
  const [showNotesInput, setShowNotesInput] = useState(false);

  const billingDetails = useBillingDetails();

  // Ecom orders are detailed by order_item_id (?type=ecommerce). place_order
  // RETURNS order_item_id ONLY for ecom orders (Quick orders don't), so its
  // presence is the reliable ecom signal — more reliable than cart.activeChannel,
  // which can read "quick" (shop-mode header) even when the order went out on the
  // ecommerce channel.
  const orderItemIdRef = useRef<number | string | null>(null);
  // Suffix appended to every status URL: for ecom orders, carries the
  // order_item_id + order_from=ecommerce so the status page routes View Order to
  // the ecom detail. Empty for Quick.
  const statusOrderSuffix = () =>
    orderItemIdRef.current
      ? `&order_item_id=${orderItemIdRef.current}&order_from=ecommerce`
      : "";
  const [showStripe, setShowStripe] = useState(false);
  const [stripeOrderId, setStripeOrderId] = useState<number | string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeTransactionId, setStripeTransactionId] = useState<string | null>(null);

  const getCurrentUser = async () => {
    try {
      // Pass city coords so user_details is zone-scoped (wallet/serviceability
      // vary by location); bare call returns unscoped/stale data on checkout.
      const response = await api.getUser({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      dispatch(setCurrentUser({ data: response.data }));
    } catch (error) {
      console.log("error", error);
    }
  };

  const validateCouponCode = async () => {
    if (
      !cart?.promo_code?.promo_code ||
      !checkout?.address?.latitude ||
      !checkout?.address?.longitude
    )
      return;
    try {
      const response = await api.setPromoCode({
        promoCodeName: cart?.promo_code?.promo_code,
        amount: cart?.cartSubTotal,
        latitude: checkout?.address?.latitude,
        longitude: checkout?.address?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
      } else {
        dispatch(clearCartPromo());
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handleFetchCheckout = async () => {
    const couponseCodeId = cart?.promo_code?.promo_code_id;
    // Blinkit-style: products must show even before an address is picked. Use
    // the selected delivery address coords when available, otherwise fall back
    // to the active city coords so getCart returns the cart immediately. Once
    // the user selects an address (checkout.address.id changes), this refetches
    // with the precise coords so delivery/zone charges recompute correctly.
    const latitude = checkout?.address?.latitude ?? city?.latitude;
    const longitude = checkout?.address?.longitude ?? city?.longitude;
    const orderType = checkout?.orderType;

    // No location at all (no address AND no city) — release the skeleton so a
    // channel switch before any location is set doesn't leave it stuck.
    if (!latitude || !longitude || !orderType) {
      setLoading(false);
      return;
    }

    // Sequence token: only the latest request is allowed to commit state, so a
    // slow response for a previously-selected address can't clobber a newer one.
    const seq = ++fetchSeqRef.current;
    console.log("[checkout] cart request →", {
      seq,
      addressId: checkout?.address?.id ?? null,
      latitude,
      longitude,
      orderType,
      promocode_id: couponseCodeId,
    });

    try {
      const response = await api.getCart({
        latitude,
        longitude,
        checkout: 1,
        promocode_id: couponseCodeId,
        address_id: checkout?.address?.id,
      });

      // Drop stale response (a newer fetch already fired).
      if (seq !== fetchSeqRef.current) {
        console.log("[checkout] cart response IGNORED (stale)", {
          seq,
          latest: fetchSeqRef.current,
        });
        return;
      }
      // Deliverability is driven SOLELY by `is_deliverable_address` (1 = OK,
      // 0 = address not serviceable). It is independent of cart contents — the
      // cart is always populated from the response so products stay visible.
      const isDeliverable =
        Number(response?.data?.is_deliverable_address) === 1;
      console.log("[checkout] cart response ←", {
        seq,
        status: response?.status,
        is_deliverable_address: response?.data?.is_deliverable_address,
        cartBefore: (checkoutData?.cart ?? lastCartRef.current?.cart ?? [])
          .length,
      });

      if (response?.status == 1) {
        // status:1 = valid cart response. ALWAYS populate the cart (items +
        // currency etc.) regardless of deliverability so products never vanish.
        dispatch(setCartCheckout({ data: response?.data }));
        dispatch(
          setCheckoutTotal({ data: Number(response?.data?.total_amount || 0) }),
        );
        setCheckoutData(response?.data);
        lastCartRef.current = response?.data; // remember last good cart

        if (isDeliverable) {
          // Serviceable → normal checkout flow, charges/total valid.
          setCheckOutError(false);
          setDeliveryError("");
        } else {
          // NOT serviceable → keep cart visible, block checkout, show banner.
          setCheckOutError(true);
          setDeliveryError(
            t("sorry_we_are_not_delivering_on_selected_address") ||
              "Sorry, We are not delivering on selected address",
          );
        }
        console.log("[checkout] store updated", {
          deliverable: isDeliverable,
          cartAfter: response?.data?.cart?.length ?? 0,
          total: response?.data?.total_amount,
        });
      } else {
        // status:0 with an HTTP response = the cart is EMPTY for this channel
        // (e.g. {"status":0,"message":"No item(s) found in users cart"}). This is
        // NOT a network failure (those throw → catch). Clear the on-screen cart so
        // an empty channel doesn't keep showing the other channel's items/total.
        // Genuine network failures never reach here; they go to catch, which
        // preserves whatever is on screen.
        console.warn("[checkout] empty cart for channel — clearing", {
          seq,
          message: response?.message,
        });
        dispatch(setCartCheckout({ data: null }));
        dispatch(setCheckoutTotal({ data: 0 }));
        setCheckoutData(null);
        lastCartRef.current = null;
        setCheckOutError(false);
        setDeliveryError("");
      }
    } catch (error) {
      console.log("[checkout] cart request error", error);
      if (seq === fetchSeqRef.current) setCheckOutError(true);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  };

  // Cross-sell ("frequently bought together") + upsell ("upgrade your pick")
  // suggestions. Kept as two distinct buckets so each renders its own section.
  const fetchRecommendations = async () => {
    const latitude = checkout?.address?.latitude ?? city?.latitude;
    const longitude = checkout?.address?.longitude ?? city?.longitude;
    if (!latitude || !longitude) return;
    try {
      const response = await api.getCartRecommendations({
        latitude,
        longitude,
      });
      if (response?.status == 1) {
        setCrossSell(response?.data?.cross_sell?.products || []);
        setUpSell(response?.data?.upsell?.products || []);
      } else {
        setCrossSell([]);
        setUpSell([]);
      }
    } catch (error) {
      console.log("Error", error);
      setCrossSell([]);
      setUpSell([]);
    }
  };

  // `opts.selectNewestFrom` = list of address ids that existed BEFORE an add.
  // When provided, the address whose id is not in that list (the one just
  // added) is auto-selected, so adding an address from checkout immediately
  // makes it the active delivery address and recomputes charges.
  const fetchAddress = async (opts: { selectNewestFrom?: any[] } = {}) => {
    const { selectNewestFrom } = opts;
    try {
      const response: any = await api.getAddress();
      if (response.status == 1) {
        const list = response.data || [];
        dispatch(setAllAddresses({ data: list }));
        const defaultAddress = list.find((a: any) => a.is_default == 1);

        if (Array.isArray(selectNewestFrom)) {
          // Pick the freshly added address (id absent from the pre-add list).
          const prevIds = new Set(selectNewestFrom);
          const added = list.find((a: any) => !prevIds.has(a.id));
          dispatch(setAddress({ data: added || defaultAddress || list[0] }));
        } else if (checkout?.address != null) {
          // keep current selection
        } else if (!defaultAddress) {
          dispatch(setAddress({ data: list[0] }));
        } else {
          dispatch(setAddress({ data: defaultAddress }));
        }
      } else {
        dispatch(setAllAddresses({ data: [] }));
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddress();
    getCurrentUser();
    dispatch(setOrderType({ data: "doorstep" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once on mount only
  }, []);

  useEffect(() => {
    validateCouponCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validateCouponCode is redefined every render (not memoized); only the coupon/subtotal inputs it reads should re-trigger it
  }, [cart?.promo_code?.promo_code, cart?.cartSubTotal]);

  // Confetti burst when a coupon transitions from none → applied. Watching the
  // redux promo_code covers every apply path once, and skips the silent
  // re-validate (same code) + removal. `hadCouponRef` holds the previous code.
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when address/city/channel/coupon change
    handleFetchCheckout();
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleFetchCheckout/fetchRecommendations are redefined every render (not memoized); deps below are the intentional trigger list
  }, [
    cart?.promo_code?.promo_code_id,
    checkout?.address?.id,
    // City coords are the fallback location when no address is selected — refetch
    // the cart when the active city changes so products/pricing stay correct.
    city?.latitude,
    city?.longitude,
    checkout?.orderType,
    // Refetch when the sales channel changes (quick <-> ecommerce). The axios
    // middleware tags requests with the active channel, so a refetch returns the
    // correct channel's cart/pricing. Watching both the cart bucket and the raw
    // shop mode covers either propagating first.
    activeChannel,
    shopMode,
    // Refetch when the cart contents change from OUTSIDE this page (e.g. the
    // Frequently Bought Together strip adds a line) so "Your Cart" stays in sync.
    reduxCartCount,
    guestCartCount,
  ]);

  // Drop stale checkout data the instant the channel changes and show the
  // skeleton (not the previous channel's products, nor a false "empty cart"
  // flash) until the refetch for the new channel resolves. handleFetchCheckout
  // clears `loading` when it completes.
  const didMountChannel = useRef(false);
  useEffect(() => {
    // Skip the initial mount — the mount effect already drives the first load.
    if (!didMountChannel.current) {
      didMountChannel.current = true;
      return;
    }
    // Channel switch: DROP the previous channel's cart. The /cart API returns
    // status != 1 for an empty cart, which handleFetchCheckout's else-branch
    // treats as a soft failure and *preserves* whatever is on screen. Without
    // clearing here, switching into an empty channel (e.g. Quick has items,
    // Shop all is empty) would keep showing the other channel's items with a
    // ₹0 total. The `loading` skeleton masks the brief blank until the refetch
    // for the new channel resolves; lastCartRef must clear too or `products`
    // falls back to it.
    console.log("[checkout] channel changed → refetching", {
      activeChannel,
      shopMode,
    });
    lastCartRef.current = null;
    setCheckoutData(null);
    setCheckOutError(false);
    setDeliveryError("");
    setLoading(true);
  }, [activeChannel, shopMode]);

  // ---- cart quantity handlers ----
  // Commit a NET INCREASE: upsert the absolute target qty. Called by each row's
  // debounced stepper after clicks settle. Stale guard drops a slow earlier
  // response so it can't overwrite the latest totals.
  const handleCommitQty = async (
    product: any,
    variantId: number | string,
    nextQty: number,
    ctx?: FlushCtx,
  ) => {
    if (nextQty < 1) return;
    try {
      const response = await api.addToCart({
        product_id: product?.id,
        product_variant_id: variantId,
        qty: nextQty,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (ctx?.isStale?.()) return;
      if (response.status == 1) {
        await handleFetchCheckout();
        fetchRecommendations();
        await reapplyCoupon(response.sub_total);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // Drop `units` from a line (debounced decrease) OR remove the whole line (the
  // trash button passes the full qty). ctx may be undefined for the trash path.
  //
  // OPTIMISTIC: update the on-screen cart + redux IMMEDIATELY, then hit the remove
  // API in the background. This kills the skeleton/refetch flash the user saw —
  // the row disappears (or its qty drops) instantly instead of waiting a full
  // round-trip. A quiet handleFetchCheckout afterwards reconciles totals/charges
  // (it doesn't touch `loading`, so no skeleton). On API failure we refetch to
  // restore the true server state.
  const handleRemoveUnits = async (
    product: any,
    variantId: number | string,
    unitsArg?: number,
    ctx?: FlushCtx,
  ) => {
    const units = unitsArg ?? 1;
    // 1) Optimistically patch local checkout cart: remove the line when all its
    //    units go, else decrement its quantity.
    setCheckoutData((prev: any) => {
      if (!prev?.cart) return prev;
      const nextCart = prev.cart
        .map((item: any) => {
          const itemVariantId = item?.variants?.[0]?.id ?? item?.variant_id;
          if (itemVariantId != variantId) return item;
          const curQty = Number(
            item?.variants?.[0]?.quantity ?? item?.qty ?? 0,
          );
          const nextQty = curQty - units;
          if (nextQty <= 0) return null;
          return {
            ...item,
            qty: nextQty,
            variants: item?.variants?.[0]
              ? [
                  { ...item.variants[0], quantity: nextQty },
                  ...item.variants.slice(1),
                ]
              : item?.variants,
          };
        })
        .filter(Boolean);
      return { ...prev, cart: nextCart };
    });

    // 2) Optimistically patch redux cartProducts so item count / other screens
    //    (header badge, cross-sell filter) reflect the removal right away.
    const nextRedux = (cart?.cartProducts ?? [])
      .map((p: any) => {
        if (p?.product_variant_id != variantId) return p;
        const nextQty = Number(p?.qty ?? 0) - units;
        return nextQty <= 0 ? null : { ...p, qty: nextQty };
      })
      .filter(Boolean);
    dispatch(setCartProducts({ data: nextRedux }));

    // 3) Fire the remove in the background; reconcile totals quietly on success,
    //    or refetch to restore true state on failure.
    try {
      const response = await api.removeFromCart({
        product_id: product?.id,
        product_variant_id: variantId,
        qty: units,
      });
      if (ctx?.isStale?.()) return;
      const alreadyGone =
        response?.status != 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status == 1 || alreadyGone) {
        handleFetchCheckout();
        fetchRecommendations();
        await reapplyCoupon(response?.sub_total);
      } else {
        toast.error(response.message);
        // Server rejected the removal — resync so the UI matches the server.
        handleFetchCheckout();
      }
    } catch (error) {
      console.log("error", error);
      // Network failure — restore the true server cart.
      handleFetchCheckout();
    }
  };

  const reapplyCoupon = async (total?: number) => {
    const latitude = checkout?.address?.latitude;
    const longitude = checkout?.address?.longitude;
    if (!cart?.promo_code?.promo_code || !latitude || !longitude) return;
    try {
      const response = await api.setPromoCode({
        promoCodeName: cart?.promo_code?.promo_code,
        amount: total,
        latitude,
        longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
      } else {
        dispatch(clearCartPromo());
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // ---- discount code ----
  const handleApplyDiscount = async () => {
    const latitude = checkout?.address?.latitude;
    const longitude = checkout?.address?.longitude;
    if (!discountInput?.trim() || !latitude || !longitude) return;
    try {
      const response = await api.setPromoCode({
        promoCodeName: discountInput.trim(),
        amount: cart?.cartSubTotal,
        latitude,
        longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
        toast.success(response.message);
        setDiscountInput("");
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handleRemoveDiscount = () => {
    dispatch(clearCartPromo());
  };

  // ---- address ----
  const handleSelectAddress = (addr: any) => {
    console.log("[checkout] address selected", {
      id: addr?.id,
      type: addr?.type,
      latitude: addr?.latitude,
      longitude: addr?.longitude,
    });
    // Clear any prior delivery error immediately; the refetch (triggered by the
    // address.id dep) will re-validate. Cart items are NOT touched here.
    setDeliveryError("");
    dispatch(setAddress({ data: addr }));
  };

  // Open the address modal in EDIT mode: stash the row in redux so the modal
  // prefills + calls updateAddress (matches AddressCard's edit flow).
  const handleEditAddress = (addr: any) => {
    dispatch(setSelectedAddresForEdit({ data: addr }));
    setIsAddressSelected(true);
    setShowAddAddres(true);
  };

  // Open the styled confirm modal (was native window.confirm).
  const handleDeleteAddress = (addr: any) => setAddressToDelete(addr);

  const confirmDeleteAddress = async () => {
    const addr = addressToDelete;
    if (!addr) return;
    setDeletingAddress(true);
    try {
      const response = await api.deleteAddress({ id: addr?.id });
      if (response?.status == 1) {
        toast.success(response?.message || t("deleted"));
        // If the deleted address was selected, clear it so checkout falls back to city.
        if (checkout?.address?.id === addr?.id)
          dispatch(setAddress({ data: null }));
        fetchAddress();
        setAddressToDelete(null);
      } else {
        toast.error(response?.message);
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setDeletingAddress(false);
    }
  };

  const formatAddress = (a: any) =>
    [a?.address, a?.area, a?.city, a?.state, a?.pincode, a?.country]
      .filter(Boolean)
      .join(", ");

  // ---- wallet ----
  const handleWalletToggle = () => {
    const nextChecked = !checkout?.isWalletChecked;
    if (nextChecked) {
      const balance = Number(user?.balance || 0);
      const total = Number(checkoutData?.total_amount || 0);
      const used = Math.min(balance, total);
      dispatch(setUserWalletBalance({ data: used }));
      // Only when the wallet covers the FULL order is "wallet" a complete
      // payment method (status 2, no gateway). On PARTIAL cover the wallet is
      // just a deduction — the remaining balance still needs a real method, so
      // don't set "wallet" as the selected method (leave the user to pick one).
      if (balance >= total && total > 0) {
        dispatch(setPaymentMethod({ data: "wallet" }));
      } else if (checkout?.selectedPaymentMethod === "wallet") {
        // was full-cover, now partial (e.g. total grew) — clear stale "wallet".
        dispatch(setPaymentMethod({ data: null }));
      }
    } else {
      dispatch(setUserWalletBalance({ data: 0 }));
      if (checkout?.selectedPaymentMethod === "wallet") {
        dispatch(setPaymentMethod({ data: null }));
      }
    }
    dispatch(setWalletChecked({ data: nextChecked }));
  };

  // ---- payment gateways (parity with Checkout.jsx) ----
  const initializeRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayCancel = async (order_id: number | string) => {
    await api.deleteOrder({ orderId: order_id });
  };

  const handleRozarpayPayment = async (
    order_id: number | string,
    razorpay_transaction_id: string,
    amount: number,
    capitalizedMethod: string,
  ) => {
    try {
      const res = await initializeRazorpay();
      if (!res) {
        console.error("RazorPay SDK Load Failed");
        return;
      }
      // Razorpay SDK's request/response shapes are third-party payment SDK
      // internals with no bundled types — `any` is the pragmatic choice here,
      // matching useOrderPlacement.tsx's identical Razorpay integration.
      const options: any = {
        key: setting?.payment_setting?.razorpay_key,
        amount: Math.floor(amount * 100),
        currency: currencyCode ?? "",
        name: user?.name,
        description: setting?.setting?.app_name,
        image: setting?.setting?.web_settings?.web_logo,
        order_id: razorpay_transaction_id,
        handler: async (res: any) => {
          if (res.razorpay_payment_id) {
            try {
              setPaymentLoading(true);
              const response = await api.addTransaction({
                orderId: order_id,
                transactionId: res.razorpay_payment_id,
                paymentMethod: capitalizedMethod,
                type: "order",
              });
              if (response.status === 1) {
                setPaymentLoading(false);
                return router.push(
                  zoneHref(
                    `/web-payment-status?status=success&type=order&payment_method=${checkout?.selectedPaymentMethod}&order_id=${order_id}${statusOrderSuffix()}`,
                  ),
                );
              }
              setPaymentLoading(false);
              toast.error(response.message);
            } catch (error) {
              console.error("Transaction error:", error);
            }
          }
        },
        modal: {
          confirm_close: true,
          ondismiss: async () => {
            // Always clean up the order on dismiss (deleteOrder is idempotent);
            // the old `reason === undefined` gate left orphaned orders when
            // Razorpay passed a defined dismiss reason.
            await handleRazorpayCancel(order_id);
          },
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: setting?.setting?.web_settings?.color },
      };
      // window.Razorpay is injected by the SDK script loaded above; no bundled
      // types exist for it, so it's accessed via `any` — matches the identical
      // cast in useOrderPlacement.tsx's handleRazorpayPayment.
      const rzpay = new (window as any).Razorpay(options);
      rzpay.on("payment.cancel", () => handleRazorpayCancel(order_id));
      rzpay.on("payment.failed", () => api.deleteOrder({ orderId: order_id }));
      rzpay.open();
    } catch (error) {
      console.error("Error initializing Razorpay:", error);
    }
  };

  const handlePayStackPayment = async (
    orderId: number | string,
    amount: number | string,
    capitalizedMethod: string,
  ) => {
    try {
      const handler = PaystackPop.setup({
        key: setting?.payment_setting?.paystack_public_key,
        email: user?.email,
        amount: Number.parseFloat(String(amount)) * 100,
        currency: setting?.payment_setting?.paystack_currency_code,
        ref: new Date().getTime().toString(),
        label: setting?.setting?.support_email,
        onClose: () => api.deleteOrder({ orderId }),
        callback: async (res: any) => {
          try {
            setPaymentLoading(true);
            const response = await api.addTransaction({
              orderId,
              transactionId: res.reference,
              paymentMethod: capitalizedMethod,
              type: "order",
            });
            if (response.status == 1) {
              setPaymentLoading(false);
              return router.push(
                zoneHref(
                  `/web-payment-status?status=success&type=order&payment_method=${checkout?.selectedPaymentMethod}&order_id=${orderId}${statusOrderSuffix()}`,
                ),
              );
            }
            setPaymentLoading(false);
            toast.error(response.message);
          } catch (error) {
            console.log("Error", error);
          }
        },
      });
      handler.openIframe();
    } catch (error) {
      console.log("Paystack Error", error);
    }
  };

  const handleInitiateTransaction = async (
    currentOrderID: number | string,
    capitalizedMethod: string,
  ) => {
    try {
      const method = checkout?.selectedPaymentMethod;
      if (method == "COD" || method == "wallet") {
        return router.push(
          zoneHref(
            `/web-payment-status?status=success&type=order&payment_method=${method}&order_id=${currentOrderID}${statusOrderSuffix()}`,
          ),
        );
      }
      if (method == "paystack") {
        // charge the wallet-reduced amount, not the full total
        return handlePayStackPayment(
          currentOrderID,
          payable,
          capitalizedMethod,
        );
      }
      const response = await api.initiateTrasaction({
        orderId: currentOrderID,
        paymentMethod: capitalizedMethod,
        type: "order",
      });
      if (response.status == 1) {
        if (method == "phonepe")
          dispatch(setPhonePeCheckoutDetails(response?.data));
        if (method == "razorpay") {
          handleRozarpayPayment(
            currentOrderID,
            response?.data?.transaction_id,
            payable,
            capitalizedMethod,
          );
        } else if (method == "stripe") {
          setStripeOrderId(currentOrderID);
          setStripeClientSecret(response?.data?.client_secret);
          setStripeTransactionId(response?.data?.id);
          setShowStripe(true);
        } else {
          dispatch(clearCartPromo());
          const paymentUrls: Record<string, string | undefined> = {
            cashfree: response?.data?.redirectUrl,
            phonepe: response?.data?.redirectUrl,
            paytabs: response?.data?.redirectUrl,
            paypal: response?.data?.paypal_redirect_url,
            midtrans: response?.data?.snapUrl,
          };
          const redirectUrl = paymentUrls[method];
          if (redirectUrl) router.push(redirectUrl);
          else console.error("Unsupported payment method:", method);
        }
      } else {
        // Delete the order we just created (currentOrderID), not the stale
        // component-state orderId which is empty on the first attempt.
        await api.deleteOrder({ orderId: currentOrderID });
        toast.error(response?.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // place_order doesn't return the created order_id, so after a successful place
  // we read it back from the user's most-recent order. Returns the order id (its
  // `id`, matching the field the status/detail pages use) or null.
  const fetchLatestOrderId = async () => {
    try {
      const res = await api.getOrders({
        limit: 1,
        offset: 0,
        type: "",
        orderType: "",
      });
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return row?.id ?? row?.order_id ?? null;
    } catch (error) {
      console.log("[placeOrder] fetchLatestOrderId failed", error);
      return null;
    }
  };

  const handlePlaceOrder = async () => {
    if (storeClosed) {
      notifyClosed();
      return;
    }
    const method = checkout?.selectedPaymentMethod;
    const capitalizedMethod =
      String(method).charAt(0).toUpperCase() + String(method).slice(1);
    const status = method === "COD" || method === "wallet" ? 2 : 1;
    try {
      // Hard block: can't place an order to an undeliverable address.
      if (deliveryError) {
        toast.error(deliveryError);
        return;
      }
      if (method == null) {
        toast.error(t("please_select_payment_method"));
        return;
      }
      // Guard: "wallet" as the sole method is only valid when the wallet covers
      // the FULL order. On partial cover the remaining amount needs another
      // method — never let a wallet-only order through (would skip real payment).
      if (
        method === "wallet" &&
        Number(user?.balance || 0) < Number(checkoutData?.total_amount || 0)
      ) {
        toast.error(t("please_select_payment_method"));
        return;
      }
      if (checkout?.address == null && checkout?.orderType == "doorstep") {
        toast.error(t("please_select_address"));
        return;
      }
      // Block: required prescriptions (medical, is_prescription_required=1) missing.
      if (hasMissingRequiredPrescriptions(products, prescriptions)) {
        toast.error(
          t("please_upload_required_prescription") ||
            "Please upload a prescription for all required medical items",
        );
        return;
      }
      // Block: billing details incomplete when "same as shipping" is off.
      if (!billingDetails.isValid) {
        toast.error(
          t("please_fill_billing_details") || "Please fill in billing details",
        );
        return;
      }
      setCheckoutLoading(true);
      const response = await api.placeOrder({
        productVariantId: cart?.checkout?.product_variant_id,
        quantity: cart?.checkout?.quantity,
        total: cart?.checkout?.sub_total,
        deliveryCharge: cart?.checkout?.delivery_charge,
        finalTotal: checkout?.checkoutTotal,
        walletUsed: checkout?.isWalletChecked,
        walletBalance: checkout?.usedWalletBalance,
        addressId: checkout?.address?.id,
        orderNote: checkout?.orderNote,
        paymentMethod: method,
        promocodeId: cart?.promo_code?.promo_code_id,
        status,
        order_type: checkout?.orderType,
        prescriptions,
        billingSameAsShipping: billingDetails.billing.sameAsShipping,
        billingName: billingDetails.billing.name,
        billingMobile: billingDetails.billing.mobile,
        billingCountryCode: billingDetails.billing.countryCode,
        billingAddress: billingDetails.billing.address,
        billingCity: billingDetails.billing.city,
        billingState: billingDetails.billing.state,
        billingPincode: billingDetails.billing.pincode,
        billingCountry: billingDetails.billing.country,
        billingRegionId: billingDetails.regionIdToSend,
      });
      if (response?.status == 1) {
        // place_order responds with only { status, message } — it does NOT return
        // the created order_id, so the success URL showed `#undefined`. Prefer any
        // id the API might send (order_id top-level or nested), else fall back to
        // fetching the user's newest order and using its `id`.
        let placedOrderId = response?.order_id ?? response?.data?.order_id;
        if (!placedOrderId) {
          placedOrderId = await fetchLatestOrderId();
        }
        // Capture the ecom order_item_id — but ONLY when this order was actually
        // placed on the ecommerce channel. place_order returns order_item_id on
        // EVERY order now, Quick included (confirmed via a raw request: a
        // `channel: quick` call came back with data.order_item_id set), so the
        // field's mere presence is no longer a valid ecom signal on its own —
        // using it alone false-positived Quick/COD orders as ecom (View Orders
        // then routed to the ecom detail page, which showed "No Orders").
        // activeChannel, captured at the moment this request was sent, is what
        // actually set the `channel` header the backend read for this order —
        // same principle useOrderPlacement.js's quick-checkout flow follows,
        // where the status URL never carries order_item_id/order_from at all.
        orderItemIdRef.current =
          activeChannel === "ecommerce"
            ? (response?.order_item_id ?? response?.data?.order_item_id ?? null)
            : null;
        // Order created — prescription files are uploaded; drop them so they don't
        // linger for the next order.
        dispatch(clearPrescriptions());
        // Same call for both COD/wallet and gateway methods — awaiting it keeps
        // the button disabled until the gateway modal/redirect is handed off
        // (or the COD/wallet redirect completes), preventing a double placeOrder
        // on double-click.
        await handleInitiateTransaction(placedOrderId, capitalizedMethod);
        setCheckoutLoading(false);
      } else {
        setCheckoutLoading(false);
        toast.error(response?.message);
      }
    } catch (error: any) {
      setCheckoutLoading(false);
      // The order may ALREADY be placed by the time we get here (place_order
      // succeeded, then the redirect threw). Swallowing this silently left the
      // user parked on /checkout with no feedback while the order existed —
      // surface it instead of only logging.
      console.error(
        "[placeOrder] failed AFTER order may have been created:",
        error,
      );
      toast.error(error?.message || t("something_went_wrong"));
    }
  };

  // ---- derived values ----
  // Cart items decoupled from delivery validation: prefer the current response,
  // else the last good checkout cart, else the redux cart bucket. This keeps
  // products visible when the selected address is out of the delivery zone
  // (status:0), and prevents the empty-flash while switching addresses.
  // Intentional: lastCartRef must be current DURING this render (handleFetchCheckout
  // writes it synchronously before the state update that would otherwise trigger
  // a re-render), so the fallback below can't wait for an effect. `products` (and
  // everything derived from it below, through the JSX return) carries this same
  // ref read, hence the disable spans the rest of the render body.
  /* eslint-disable react-hooks/refs */
  const products =
    checkoutData?.cart ||
    lastCartRef.current?.cart ||
    cart?.checkout?.cart ||
    [];
  console.log("[checkout] render", {
    items: products.length,
    deliveryError: deliveryError || null,
    checkOutError,
    loading,
  });
  // Hide cross-sell suggestions already in the cart (match on product id).
  // Upsell shows exactly what the API returns — no client-side filtering.
  const cartProductIds = new Set(products.map((p) => p?.id));
  const crossSellItems = crossSell.filter((p) => !cartProductIds.has(p?.id));
  const upSellItems = upSell;
  // Enabled selectable payment methods (COD + active online gateways) as a single
  // list — drives both the collapsed "selected + Change" row and the picker drawer.
  // `value` is what's dispatched/compared against checkout.selectedPaymentMethod.
  const paymentOptions = [
    ...(checkoutData?.cod_allowed == "1"
      ? [{ value: "COD", label: t("cash_on_delivery") }]
      : []),
    ...paymentMethodKeys
      .filter((m) => setting?.payment_setting?.[m.key] === "1")
      .map((m) => ({ value: m.label, label: t(m.label) })),
  ];
  const selectedPayment = paymentOptions.find(
    (o) => o.value === checkout?.selectedPaymentMethod,
  );
  const itemCount = products.reduce(
    (sum, p) => sum + Number(p?.variants?.[0]?.quantity ?? p?.qty ?? 0),
    0,
  );
  // Delivery charge + its tax — backend has been seen sending this as a plain
  // `delivery_charge` scalar, a `delivery_charge` object with
  // total_delivery_charge/tax_amount/tax_name, OR a separate `delivery_charges`
  // (plural) object with amount/tax_amount/tax_name. All three are checked so
  // neither the amount nor its tax silently goes missing depending on which
  // shape a given response uses.
  const deliveryChargeObj =
    (typeof checkoutData?.delivery_charge === "object"
      ? checkoutData?.delivery_charge
      : null) || checkoutData?.delivery_charges;
  const shipping =
    deliveryChargeObj?.total_delivery_charge ??
    deliveryChargeObj?.amount ??
    (typeof checkoutData?.delivery_charge === "object"
      ? undefined
      : checkoutData?.delivery_charge);
  const deliveryChargeTax = deliveryChargeObj;
  // Per-tax breakdown (IGST/CGST/SGST) shown as a Subtotal tooltip rather than
  // its own bill rows — zero-amount entries dropped so a tax bucket the
  // backend still lists at ₹0 doesn't appear in the tooltip. Gated on the
  // array itself having real rows rather than a separate
  // tax_breakdown_available flag — that flag isn't reliably set even when
  // tax_breakdown carries real data.
  const taxBreakdownRows = !checkOutError
    ? (checkoutData?.tax_breakdown || []).filter(
        (tx: any) => Number(tx?.amount) > 0,
      )
    : [];
  const walletUsed = checkout?.isWalletChecked
    ? Number(checkout?.usedWalletBalance || 0)
    : 0;
  // Wallet fully covers the order → the whole total is paid from the wallet, so
  // no other payment method is needed. When the toggle is ON in this case, hide
  // COD + online gateways (nothing left to pay via them).
  const walletCoversFull =
    checkout?.isWalletChecked &&
    Number(user?.balance || 0) >= Number(checkoutData?.total_amount || 0) &&
    Number(checkoutData?.total_amount || 0) > 0;
  const payable = checkOutError
    ? cart?.cartSubTotal
    : Math.max(Number(checkoutData?.total_amount || 0) - walletUsed, 0);
  // "wallet" apply-type coupons are cashback, not a price discount: credited after
  // the order, so they don't reduce the payable total and aren't counted as a
  // saving here. "instant" coupons (flat or percentage) reduce up-front.
  const isCashbackCoupon =
    (checkoutData?.promocode_details?.discount_apply_type ??
      cart?.promo_code?.discount_apply_type) === "wallet";
  const promoDiscount = Number(checkoutData?.promocode_details?.discount || 0);
  // Savings shown in the bill hero — read straight from the API's
  // `saved_amount`, which already accounts for the applied promo code. Adding
  // promoDiscount on top of it double-counted the coupon.
  const totalSaved = checkOutError
    ? 0
    : Number(checkoutData?.saved_amount || 0);

  const money = (val: number | string = 0) => formatCurrency(val, currency, decimals);

  // Shared notch-mask gradient for the applied-coupon ticket (used identically
  // by both WebkitMaskImage and maskImage below) — mirrors horizontally for RTL.
  const notchMaskImage = rtl
    ? "radial-gradient(circle 7px at 32% 0, transparent 7px, #000 7.5px), radial-gradient(circle 7px at 32% 100%, transparent 7px, #000 7.5px)"
    : "radial-gradient(circle 7px at 68% 0, transparent 7px, #000 7.5px), radial-gradient(circle 7px at 68% 100%, transparent 7px, #000 7.5px)";

  if (loading) return <CheckoutSkeleton />;
  if (paymentLoading) return <CheckoutSkeleton />;

  return (
    <section className="backgroundColor min-h-screen pb-40 md:pb-28 lg:pb-8">
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
      <div className="container py-4 md:py-8">
        {/* page heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl primaryLightBack primaryColor dark:text-white flex items-center justify-center shrink-0">
              <FiShoppingBag size={20} />
            </span>
            <div>
              <h1 className="font-bold text-2xl md:text-3xl leading-tight">
                {t("checkout")}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6 items-start">
          {/* ---------- LEFT ---------- */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 md:gap-6">
            {/* Delivery Address */}
            <div className="bodyBackgroundColor cardBorder !rounded-lg shadow-sm">
              <div className="flex justify-between items-center gap-3 p-4 md:p-5 border-b">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <SectionHeader
                    icon={<FiMapPin size={18} />}
                    title={t("delivery_address")}
                  />
                </div>
                {address?.allAddresses?.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm font-semibold primaryColor dark:text-white shrink-0 hover:opacity-80 transition"
                    onClick={() => {
                      setIsAddressSelected(false);
                      setShowAddAddres(true);
                    }}
                  >
                    <FiPlus size={16} />
                    {t("add_address")}
                  </button>
                )}
              </div>

              <div className="p-4 md:p-5">
                {address?.allAddresses?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {address.allAddresses.map((addr) => (
                      <AddressCard
                        key={addr?.id}
                        addr={addr}
                        active={checkout?.address?.id === addr?.id}
                        onSelect={() => handleSelectAddress(addr)}
                        onEdit={() => handleEditAddress(addr)}
                        onDelete={() => handleDeleteAddress(addr)}
                        formatAddress={formatAddress}
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddressSelected(false);
                      setShowAddAddres(true);
                    }}
                    className="primaryDashedBorder rounded-xl p-6 w-full flex flex-col items-center justify-center gap-2 font-bold text-base primaryColor dark:text-white"
                  >
                    <span className="w-12 h-12 rounded-full primaryLightBack flex items-center justify-center">
                      <FiPlus size={22} />
                    </span>
                    {t("add_address")}
                  </button>
                )}

                {/* Delivery validation banner — shown when the selected address
                    is outside the delivery zone (status:0). Cart stays intact. */}
                {deliveryError && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3.5 py-2.5">
                    <FiMapPin
                      size={16}
                      className="text-red-500 shrink-0 mt-0.5"
                    />
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {deliveryError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Billing Details — collapsed by default ("same as shipping"); the
                same country/region <Select> + PhoneNumberInput pattern used in
                NewAddressModal.tsx, driven by the shared useBillingDetails hook
                so the checkout page and quick-checkout drawer stay in sync. */}
            <div className="bodyBackgroundColor cardBorder !rounded-lg shadow-sm overflow-hidden">
              <label className="flex items-center justify-between gap-3 p-4 md:p-5 cursor-pointer">
                <SectionHeader
                  icon={<FiCreditCard size={18} />}
                  title={t("billing_details") || "Billing Details"}
                />
                <span className="flex items-center gap-2 text-sm font-semibold textColor">
                  {t("billing_same_as_shipping") || "Same as shipping address"}
                  <Checkbox
                    checked={billingDetails.billing.sameAsShipping}
                    onCheckedChange={(checked) =>
                      billingDetails.setSameAsShipping(checked === true)
                    }
                    className="primaryColorBorder data-[state=checked]:primaryBackColor"
                  />
                </span>
              </label>
              {!billingDetails.billing.sameAsShipping && (
                <div className="flex flex-col gap-3.5 p-4 md:p-5 border-t">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("name")}</Label>
                    <Input
                      type="text"
                      className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                      placeholder={t("name")}
                      value={billingDetails.billing.name}
                      onChange={(e) => billingDetails.setField("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("mobileNumber")}</Label>
                      {/* PhoneNumberInput bakes in its own mt-1.5 (expects to sit
                          directly under a label with no gap); this wrapper's own
                          gap-1.5 would double that spacing, so cancel it here. */}
                      <div className="-mt-1.5">
                        <PhoneNumberInput
                          value={billingDetails.billing.mobile}
                          countryCode={billingDetails.billing.countryCode}
                          onChange={billingDetails.handleMobileChange}
                          onCountryReady={billingDetails.handleMobileCountryReady}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("enter_city")}</Label>
                      <Input
                        type="text"
                        className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                        placeholder={t("enter_city")}
                        value={billingDetails.billing.city}
                        onChange={(e) => billingDetails.setField("city", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold textColor">{t("address")}</Label>
                    <Input
                      type="text"
                      className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                      placeholder={t("address")}
                      value={billingDetails.billing.address}
                      onChange={(e) => billingDetails.setField("address", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("enter_pincode")}</Label>
                      <Input
                        type="text"
                        className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                        placeholder={t("enter_pincode")}
                        value={billingDetails.billing.pincode}
                        onChange={(e) => billingDetails.setField("pincode", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("enter_country")}</Label>
                      <Select
                        value={billingDetails.billing.countryId || undefined}
                        onValueChange={billingDetails.handleCountryChange}
                      >
                        <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                          <SelectValue placeholder={t("enter_country")} />
                        </SelectTrigger>
                        <SelectContent>
                          {billingDetails.countries.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold textColor">{t("enter_region")}</Label>
                      {/* Countries with no region list on file (e.g. Italy)
                          get a free-text field instead of a stuck-empty
                          dropdown — regionId doubles as the typed name. */}
                      {billingDetails.regionsEmpty ? (
                        <Input
                          type="text"
                          className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent"
                          placeholder={t("enter_region")}
                          value={billingDetails.billing.regionId}
                          onChange={(e) =>
                            billingDetails.handleRegionChange(e.target.value)
                          }
                        />
                      ) : (
                        <Select
                          value={billingDetails.billing.regionId || undefined}
                          onValueChange={billingDetails.handleRegionChange}
                          disabled={!billingDetails.billing.countryId}
                        >
                          <SelectTrigger className="h-auto py-2.5 bg-[#f4f5f7] dark:bg-zinc-800 border-transparent focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]">
                            <SelectValue placeholder={t("enter_region")} />
                          </SelectTrigger>
                          <SelectContent>
                            {billingDetails.regions.map((region: any) => (
                              <SelectItem key={region.id} value={String(region.id)}>
                                {region.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Your Cart */}
            <div className="bodyBackgroundColor cardBorder !rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 md:p-5">
                <SectionHeader
                  icon={<FiShoppingBag size={18} />}
                  title={t("your_cart")}
                  count={`${itemCount} ${t("items")}`}
                />
              </div>
              <div className="flex flex-col">
                {products.map((product) => (
                  <CheckoutItemRow
                    key={product?.variant_id || product?.id}
                    product={product}
                    money={money}
                    maxCartItemsCount={setting?.setting?.max_cart_items_count}
                    otherLinesQty={
                      itemCount -
                      Number(
                        product?.variants?.[0]?.quantity ?? product?.qty ?? 0,
                      )
                    }
                    onCommitQty={handleCommitQty}
                    onRemoveUnits={handleRemoveUnits}
                  />
                ))}
                {products.length === 0 && (
                  <p className="text-sm SecondaryTextColor p-5 border-t">
                    {t("no_data_found")}
                  </p>
                )}

                {/* Delivery instruction — collapsed "+ Add" trigger below the
                    last item; click to reveal the textarea. Quick channel only
                    (all-shop ships, no delivery-partner note). Auto-open when a
                    note already exists so it stays editable. */}
                {shopMode === "quick" && products.length > 0 && (
                  <div className="border-t p-4 md:px-5">
                    {!showNotesInput && !checkout?.orderNote ? (
                      <button
                        type="button"
                        onClick={() => setShowNotesInput(true)}
                        className="flex items-center gap-2 text-sm font-semibold primaryColor dark:text-white hover:opacity-80 transition"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full primaryLightBack">
                          <FiPlus size={15} />
                        </span>
                        {t("add_delivery_instruction") ||
                          t("order_notes") ||
                          "Add delivery instruction"}
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold textColor">
                            {t("order_notes")}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNotesInput(false);
                              dispatch(setOrderNote({ data: "" }));
                            }}
                            className="text-xs font-medium text-red-500 hover:text-red-600 transition"
                          >
                            {t("delete")}
                          </button>
                        </div>
                        <p className="text-xs SecondaryTextColor mt-0.5">
                          {t("order_notes_hint")}
                        </p>
                        <textarea
                          rows={3}
                          autoFocus
                          aria-label={t("order_notes_placeholder")}
                          value={checkout?.orderNote || ""}
                          onChange={(e) =>
                            dispatch(setOrderNote({ data: e.target.value }))
                          }
                          placeholder={t("order_notes_placeholder")}
                          className="mt-2 w-full cardBorder rounded-lg px-3 py-2 text-sm bg-transparent outline-none resize-none focus:primaryColorBorder transition"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Frequently bought together (cross-sell) */}
            <RecommendationStrip
              id="cross"
              title={t("frequently_bought_together")}
              products={crossSellItems}
            />

            {/* Upgrade your order (upsell) */}
            <RecommendationStrip
              id="upsell"
              title={t("upgrade_your_order")}
              products={upSellItems}
            />
          </div>

          {/* ---------- RIGHT ---------- */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 md:gap-6 lg:sticky lg:top-24 lg:self-start">
            {/* Order Summary — payment method now lives inside it (above Place
                Order), so there's a single payment surface on the page. */}
            <div className="bodyBackgroundColor cardBorder !rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b">
                <span className="font-bold text-lg md:text-xl flex items-center gap-2">
                  <FiTag size={18} className="primaryColor dark:text-white" />
                  {t("order_summary")}
                </span>
              </div>
              <div className="px-4 md:px-5 py-4 md:py-5 flex flex-col gap-3">
                {!checkOutError && checkoutData?.unlock_message && (
                  <UnlockCouponNudge
                    code={checkoutData?.unlock_promo_code}
                    message={checkoutData?.unlock_message}
                  />
                )}

                <Row
                  label={
                    <>
                      {t("sub_total")} ({itemCount} {t("items")}){" "}
                      {/* API's subtotal is already tax-inclusive (tax_breakdown is
                          reported separately and not added on top) — same wording
                          as FinalCheckoutSummary's order-detail bill, only shown
                          when a real tax amount is actually part of it. */}
                      {taxBreakdownRows.length > 0 && (
                        <span className="text-[11px]">
                          ({t("incl_tax") || "Incl. Tax"})
                        </span>
                      )}
                    </>
                  }
                  value={money(
                    checkOutError
                      ? cart?.cartSubTotal
                      : checkoutData?.sub_total,
                  )}
                  // Per-tax (IGST/CGST/SGST) split lives in the (i) tooltip
                  // (same slot as a per-charge tax note), not its own bill
                  // rows, so the bill stays visually calm.
                  taxNote={
                    taxBreakdownRows.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {taxBreakdownRows.map((tx: any, i: number) => (
                          <div
                            key={`subtotal-tax-${i}`}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {tx?.rate != null
                                ? `${tx?.name} (${tx?.rate}%)`
                                : tx?.name}
                            </span>
                            <span className="tabular-nums">
                              {money(tx?.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                />

                {!checkOutError && checkout?.orderType == "doorstep" && (
                  <Row
                    label={t("delivery_charge")}
                    value={money(shipping)}
                    taxNote={
                      Number(deliveryChargeTax?.tax_amount) > 0 &&
                      `${t("incl") || "Incl."} ${deliveryChargeTax?.tax_name || t("tax") || "Tax"} ${money(deliveryChargeTax?.tax_amount)}`
                    }
                  />
                )}

                {checkoutData?.additional_charges?.map((charge, i) => (
                  <Row
                    key={charge?.id ?? `${charge?.title}-${i}`}
                    label={charge?.title}
                    value={money(charge?.amount)}
                  />
                ))}

                {!checkOutError &&
                  checkoutData?.surge_charges?.map((charge, i) => (
                    <Row
                      key={charge?.id ?? `surge-${charge?.label}-${i}`}
                      label={charge?.label}
                      value={money(charge?.charge)}
                      badge={{ refundable: charge?.is_refundable }}
                      taxNote={
                        Number(charge?.tax_amount) > 0 &&
                        `${t("incl") || "Incl."} ${charge?.tax_name || t("tax") || "Tax"} ${money(charge?.tax_amount)}${
                          charge?.is_refundable
                            ? ` (${t("tax_not_refundable") || "tax not refundable"})`
                            : ""
                        }`
                      }
                    />
                  ))}

                {!checkOutError &&
                  checkoutData?.zone_additional_charges?.map((charge, i) => (
                    <Row
                      key={charge?.id ?? `zone-${charge?.name}-${i}`}
                      label={charge?.name}
                      value={money(charge?.amount)}
                      badge={{ refundable: charge?.is_refundable }}
                      taxNote={
                        Number(charge?.tax_amount) > 0 &&
                        `${t("incl") || "Incl."} ${charge?.tax_name || t("tax") || "Tax"} ${money(charge?.tax_amount)}${
                          charge?.is_refundable
                            ? ` (${t("tax_not_refundable") || "tax not refundable"})`
                            : ""
                        }`
                      }
                    />
                  ))}

                {checkoutData?.promocode_details && !checkOutError && (
                  <div
                    className="relative flex items-stretch rounded-lg"
                    style={{
                      // Half-circle notches carved out of top & bottom edges at 66%
                      // via radial-gradient masks (transparent discs). Clean bites,
                      // no overlapping bordered circles.
                      backgroundImage:
                        "linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 14%, var(--category-card-bg)), color-mix(in srgb, var(--primary-color) 7%, var(--category-card-bg)))",
                      // Same notch mask for both the prefixed and standard
                      // properties — computed once, shared below.
                      WebkitMaskImage: notchMaskImage,
                      maskImage: notchMaskImage,
                      WebkitMaskComposite: "source-in",
                      maskComposite: "intersect",
                    }}
                  >
                    {/* dashed tear line between the two notches */}
                    <span
                      className={`pointer-events-none absolute ${rtl ? "left-[32%]" : "left-[68%]"} top-3 bottom-3 -translate-x-1/2 border-l border-dashed border-[color-mix(in_srgb,var(--primary-color)_45%,transparent)] dark:border-white/40`}
                    />

                    {/* left: icon + label + code */}
                    <div className="flex items-center gap-2.5 min-w-0 basis-[68%] grow px-2.5 sm:px-3.5 py-2.5 sm:py-3.5">
                      <span
                        className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: "var(--primary-color)" }}
                      >
                        <MdOutlineCelebration size={18} />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium primaryColor dark:text-white leading-tight truncate">
                          {t("promoCodeSuccess")}
                        </span>
                        <span className="text-sm sm:text-base font-extrabold textColor truncate leading-tight tracking-wide uppercase">
                          {cart?.promo_code?.promo_code ||
                            checkoutData?.promocode_details?.promo_code}
                        </span>
                      </div>
                    </div>

                    {/* right (stub): discount + remove */}
                    <div className="flex items-center justify-center gap-1 sm:gap-2 shrink-0 basis-[32%] grow pl-3 sm:pl-4 pr-2 sm:pr-3 py-2.5 sm:py-3.5">
                      <div className="flex flex-col items-center leading-tight min-w-0">
                        <span className="text-sm sm:text-lg font-extrabold primaryColor dark:text-white truncate max-w-full">
                          {isCashbackCoupon
                            ? money(promoDiscount)
                            : `-${money(promoDiscount)}`}
                        </span>
                        <span className="text-[9px] font-bold SecondaryTextColor uppercase tracking-wide">
                          {isCashbackCoupon
                            ? t("cashback")
                            : t("you_save") || "Saved"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveDiscount}
                        aria-label={t("delete")}
                        className="flex items-center justify-center text-gray-400 hover:text-red-500 transition shrink-0"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {walletUsed > 0 && (
                  <Row
                    label={t("store_credit_applied")}
                    value={`- ${money(walletUsed)}`}
                  />
                )}

                {/* Discount code + view-all (Flipkart coupon row) */}
                <div className="flex items-center gap-2 cardBorder rounded-lg px-3 py-2 focus-within:primaryColorBorder transition">
                  <FiTag size={16} className="SecondaryTextColor shrink-0" />
                  <input
                    type="text"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder={t("discount_code")}
                    className="flex-1 bg-transparent outline-none text-sm min-w-0"
                  />
                  <button
                    type="button"
                    className="font-bold primaryColor dark:text-white text-sm shrink-0 px-1"
                    onClick={handleApplyDiscount}
                  >
                    {t("apply")}
                  </button>
                </div>

                <button
                  type="button"
                  className={`flex items-center justify-between text-sm font-semibold primaryColor dark:text-white hover:opacity-80 transition ${rtl ? "text-right" : "text-left"}`}
                  onClick={() => setShowCouponCode(true)}
                >
                  <span className="flex items-center gap-1.5">
                    <RiCouponLine size={16} />
                    {t("view_all_coupons")}
                  </span>
                  {rtl ? (
                    <FiChevronLeft size={16} />
                  ) : (
                    <FiChevronRight size={16} />
                  )}
                </button>
                {/* grand total */}
                <div className="border-t border-dashed pt-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-base textColor">
                      {t("total_with_vat")}
                    </span>
                    <span className="text-[11px] SecondaryTextColor">
                      {itemCount} {t("items")}
                    </span>
                  </div>
                  <span className="font-bold text-xl primaryColor dark:text-white">
                    {money(payable)}
                  </span>
                </div>

                {/* Savings card — soft emerald→teal gradient with a thin accent bar
                    and a slow shine sweep. Green = savings; calm next to the CTA. */}
                {totalSaved > 0 && (
                  <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-3.5 py-2.5 dark:border-emerald-500/25 dark:from-emerald-500/10 dark:via-green-500/10 dark:to-teal-500/10">
                    <span className="savings-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/15" />
                    <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <MdOutlineCelebration size={18} />
                    </span>
                    <p className="relative min-w-0 flex-grow text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("you_saved")}{" "}
                      <span className="font-extrabold">
                        {money(totalSaved)}
                      </span>{" "}
                      <span className="font-normal text-emerald-600/80 dark:text-emerald-400/70">
                        {t("you_saved_on_this_order")}
                      </span>
                    </p>
                  </div>
                )}

                {/* Cashback reward — separate from the payable total (credited to
                    the wallet after the order, not deducted here). */}
                {isCashbackCoupon && promoDiscount > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/[0.08] px-3 py-2.5">
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

                {/* Payment method — lives inside the summary, right above Place
                    Order, so the user confirms how they'll pay at the point of
                    action. Opens the picker modal; the modal owns the full list.
                    When the wallet covers the whole order, no method is needed. */}
                {walletCoversFull ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-3.5 py-3">
                    <span className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                      <RiWallet3Line size={18} />
                    </span>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {t("wallet_covers_full_order") ||
                        "Your wallet balance covers the full order. No other payment needed."}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaymentPicker(true)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 md:p-3.5 text-left transition ${
                      selectedPayment
                        ? "primaryColorBorder primaryLightBack dark:border-white dark:bg-white/5"
                        : "border-dashed cardBorder hover:primaryColorBorder"
                    }`}
                  >
                    <span className="w-9 h-9 rounded-lg bg-white dark:bg-white/10 border cardBorder shadow-sm flex items-center justify-center shrink-0 primaryColor dark:text-white">
                      {selectedPayment ? (
                        payMethodIcon(selectedPayment.value)
                      ) : (
                        <FiCreditCard size={18} />
                      )}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide SecondaryTextColor leading-tight">
                        {t("payment_method")}
                      </span>
                      <span className="font-semibold text-sm md:text-[15px] textColor capitalize truncate">
                        {selectedPayment
                          ? selectedPayment.label
                          : t("select_payment_method") ||
                            "Select Payment Method"}
                      </span>
                    </span>
                    {selectedPayment && (
                      <span className="text-xs font-semibold primaryColor dark:text-white shrink-0">
                        {t("change") || "Change"}
                      </span>
                    )}
                    {rtl ? (
                      <FiChevronLeft
                        size={18}
                        className="SecondaryTextColor shrink-0"
                      />
                    ) : (
                      <FiChevronRight
                        size={18}
                        className="SecondaryTextColor shrink-0"
                      />
                    )}
                  </button>
                )}

                {/* Desktop place-order — plain button at the end of the summary
                    (mobile uses the fixed bottom bar). */}
                <button
                  type="button"
                  {...closedProps}
                  className={`hidden lg:flex items-center justify-center gap-1.5 w-full primaryBackColor text-white font-bold py-3 !rounded-xl transition hover:opacity-95 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 disabled:cursor-not-allowed ${closedProps.className ?? ""}`}
                  disabled={
                    checkoutLoading ||
                    products.length === 0 ||
                    !!deliveryError ||
                    hasMissingRequiredPrescriptions(products, prescriptions)
                  }
                  onClick={handlePlaceOrder}
                >
                  {t("place_order")}
                  {rtl ? (
                    <FiChevronLeft size={18} />
                  ) : (
                    <FiChevronRight size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile place-order bar */}
      <div className="lg:hidden fixed bottom-[60px] md:bottom-0 left-0 right-0 z-50 bodyBackgroundColor border-t shadow-[0_-2px_12px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-bold textColor leading-tight">
            {money(payable)}
          </span>
          <span className="text-[11px] SecondaryTextColor uppercase tracking-wide">
            {t("total_with_vat")}
          </span>
        </div>
        <button
          type="button"
          {...closedProps}
          className={`ml-auto flex-1 max-w-[60%] primaryBackColor text-white font-bold py-3 !rounded-xl flex items-center justify-center gap-1 transition disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 disabled:cursor-not-allowed ${closedProps.className ?? ""}`}
          disabled={
            checkoutLoading ||
            products.length === 0 ||
            !!deliveryError ||
            hasMissingRequiredPrescriptions(products, prescriptions)
          }
          onClick={handlePlaceOrder}
        >
          {t("place_order")}
          {rtl ? <FiChevronLeft size={18} /> : <FiChevronRight size={18} />}
        </button>
      </div>

      {showAddAddres && (
        <NewAddressModal
          fetchAddress={fetchAddress}
          showAddAddres={showAddAddres}
          setShowAddAddres={setShowAddAddres}
          isAddressSelected={isAddressSelected}
        />
      )}
      {showCouponCode && (
        <CouponCodeDrawer
          showCouponCode={showCouponCode}
          setShowCouponCode={setShowCouponCode}
        />
      )}

      {/* Payment method picker — full list lives here so the inline card stays a
          single row. Scrolls internally when many gateways are enabled. */}
      <Dialog open={showPaymentPicker} onOpenChange={setShowPaymentPicker}>
        <DialogOverlay
          className={theme == "light" ? "bg-black/50" : "bg-black/70"}
        />
        <DialogContent
          className="max-w-md rounded-3xl p-0 overflow-hidden"
          title={t("select_payment_method")}
        >
          {/* Close — pinned to the top-right corner of the dialog, independent
              of the header's flex layout so it never drifts to center. */}
          <button
            type="button"
            onClick={() => setShowPaymentPicker(false)}
            aria-label={t("close") || "Close"}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full SecondaryTextColor hover:backgroundColor transition"
          >
            <RiCloseFill size={20} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 pr-14">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl primaryLightBack primaryColor dark:text-white">
              <FiCreditCard size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-base md:text-lg leading-tight">
                {t("payment_method")}
              </h2>
              <p className="text-xs SecondaryTextColor mt-0.5">
                {t("select_payment_method") || "Choose how to pay"}
              </p>
            </div>
          </div>

          {/* Method list — grouped: Cash, Wallet, Online */}
          <div className="max-h-[62vh] overflow-y-auto custom-scrollbar px-4 pb-4 pt-1 flex flex-col gap-3">
            {/* Cash on Delivery */}
            {paymentOptions.some((o) => o.value === "COD") && (
              <div className="flex flex-col gap-2">
                <p className="px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] SecondaryTextColor">
                  {t("cash_on_delivery")}
                </p>
                {paymentOptions
                  .filter((o) => o.value === "COD")
                  .map((opt) => (
                    <PayPickRow
                      key={opt.value}
                      opt={opt}
                      active={checkout?.selectedPaymentMethod === opt.value}
                      onPick={() => {
                        dispatch(setPaymentMethod({ data: opt.value }));
                        setShowPaymentPicker(false);
                      }}
                    />
                  ))}
              </div>
            )}

            {/* Wallet — toggle (used on top of the selected method, not a
                standalone method). Shown only when the user has balance. */}
            {user?.balance >= 1 && (
              <div className="flex flex-col gap-2">
                <p className="px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] SecondaryTextColor">
                  {t("walletBalance")}
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl border cardBorder p-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-xl iconBackgroundColor primaryColor dark:text-white flex items-center justify-center shrink-0">
                      <CiWallet size={20} />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <p className="font-semibold text-sm md:text-[15px] truncate">
                        {t("use_wallet_balance")}
                      </p>
                      <p className="text-xs SecondaryTextColor">
                        {money(user?.balance)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checkout?.isWalletChecked}
                    onClick={handleWalletToggle}
                    className={`relative w-11 h-6 rounded-lg shrink-0 transition ${
                      checkout?.isWalletChecked
                        ? "primaryBackColor"
                        : "iconBackgroundColor"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-lg bg-white dark:bg-zinc-900 transition-transform ${
                        checkout?.isWalletChecked ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Online gateways */}
            {paymentOptions.some((o) => o.value !== "COD") && (
              <div className="flex flex-col gap-2">
                <p className="px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] SecondaryTextColor">
                  {t("pay_online") || "Pay Online"}
                </p>
                {paymentOptions
                  .filter((o) => o.value !== "COD")
                  .map((opt) => (
                    <PayPickRow
                      key={opt.value}
                      opt={opt}
                      active={checkout?.selectedPaymentMethod === opt.value}
                      onPick={() => {
                        dispatch(setPaymentMethod({ data: opt.value }));
                        setShowPaymentPicker(false);
                      }}
                    />
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete-address confirm (styled — replaces native window.confirm) */}
      <Dialog open={!!addressToDelete}>
        <DialogOverlay
          className={theme == "light" ? "bg-white/80" : "bg-black/80"}
        />
        <DialogContent
          className="max-w-sm rounded-2xl p-0 overflow-hidden"
          title={t("delete_address") || t("delete")}
        >
          <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
              <LuTriangleAlert
                size={28}
                className="text-red-600 dark:text-red-400"
              />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("delete_address") || t("delete")}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t("delete_address_confirm") ||
                "Are you sure you want to delete this address?"}
            </p>
            {addressToDelete && (
              <p className="mt-3 w-full rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-xs SecondaryTextColor line-clamp-2">
                {formatAddress(addressToDelete)}
              </p>
            )}
            <div className="mt-6 flex w-full gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-gray-200 dark:border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                onClick={() => setAddressToDelete(null)}
                disabled={deletingAddress}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                onClick={confirmDeleteAddress}
                disabled={deletingAddress}
              >
                {deletingAddress ? `${t("delete")}…` : t("delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {showStripe && (
        <StripeModal
          showStripe={showStripe}
          setShowStripe={setShowStripe}
          amount={payable}
          // stripeClientSecret/stripeTransactionId/stripeOrderId are separate state
          // atoms TS can't correlate with `showStripe`, but showStripe is only ever
          // set true after they're populated (see handleInitiateTransaction's
          // stripe branch) — the `?? ""` default never actually fires at runtime.
          clientSecret={stripeClientSecret ?? ""}
          stripeTransId={stripeTransactionId ?? undefined}
          stripeOrderId={stripeOrderId != null ? String(stripeOrderId) : undefined}
          type="order"
        />
      )}
    </section>
  );
  /* eslint-enable react-hooks/refs */
};

const paymentMethodKeys = [
  { key: "razorpay_payment_method", label: "razorpay" },
  { key: "paypal_payment_method", label: "paypal" },
  { key: "paystack_payment_method", label: "paystack" },
  { key: "stripe_payment_method", label: "stripe" },
  { key: "cashfree_payment_method", label: "cashfree" },
  { key: "midtrans_payment_method", label: "midtrans" },
  { key: "phonepay_payment_method", label: "phonepe" },
  { key: "paytabs_payment_method", label: "paytabs" },
];

// Real brand logo per gateway (same SVGs as the wallet recharge modal) so each
// method shows its own logo — no more generic GPay icon for cashfree/phonepe/
// paytabs/midtrans/paystack. COD has no brand logo → keep the cash icon.
const payMethodLogos = {
  razorpay: RazorpayLogo,
  paypal: PaypalLogo,
  paystack: PaystackLogo,
  stripe: StripeLogo,
  cashfree: CashfreeLogo,
  midtrans: MidtransLogo,
  phonepe: PhonePeLogo,
  paytabs: PaytabsLogo,
};

const payMethodIcon = (method: string) => {
  if (method === "COD") return <FaMoneyBillWave size={18} />;
  const logo = (payMethodLogos as Record<string, any>)[method];
  if (logo) {
    return (
      <Image
        src={logo}
        alt={method}
        width={24}
        height={24}
        unoptimized
        className="h-6 w-6 object-contain"
      />
    );
  }
  return <FiCreditCard size={18} />;
};

// Compact selectable delivery-address row. Radio left, type icon + name +
// default, single-line address. Edit/delete tucked in a 3-dot menu.
interface AddressCardProps {
  /** address row shape from api.getAddress() — no exported type, kept `any`. */
  addr: any;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatAddress: (a: any) => string;
}

const AddressCard = ({
  addr,
  active,
  onSelect,
  onEdit,
  onDelete,
  formatAddress,
}: AddressCardProps) => {
  const type = (addr?.type || "").toLowerCase();
  let TypeIcon = FiMapPin;
  if (type === "home") {
    TypeIcon = FiHome;
  } else if (type === "work" || type === "office") {
    TypeIcon = FiBriefcase;
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <label
      className={`relative flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
        active
          ? "primaryColorBorder dark:border-white dark:bg-white/5"
          : "cardBorder hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <input
        type="radio"
        name="delivery_address"
        className="sr-only"
        checked={active}
        onChange={onSelect}
      />

      {/* radio */}
      <span
        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
          active
            ? "   dark:border-white"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {active && (
          <span className="w-2 h-2 rounded-full primaryBackColor dark:bg-white" />
        )}
      </span>

      {/* type icon */}
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          active
            ? "primaryBackColor text-white"
            : "primaryLightBack primaryColor dark:text-white"
        }`}
      >
        <TypeIcon size={15} />
      </span>

      {/* details */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate">
            {addr?.type || addr?.name}
          </span>
          {addr?.is_default == 1 && (
            <span className="text-[10px] font-semibold primaryColor dark:text-white shrink-0">
              • {t("default")}
            </span>
          )}
        </div>
        <span className="text-xs SecondaryTextColor leading-snug line-clamp-1">
          {formatAddress(addr)}
        </span>
      </div>

      {/* 3-dot menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={t("action") || "Actions"}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
            menuOpen
              ? "primaryLightBack primaryColor dark:text-white"
              : "SecondaryTextColor hover:backgroundColor"
          }`}
        >
          <FiMoreVertical size={17} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border cardBorder bodyBackgroundColor shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-1 origin-top-right animate-[fadeIn_.12s_ease-out]">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onEdit();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium textColor hover:primaryLightBack transition"
            >
              <span className="w-6 h-6 rounded-md primaryLightBack primaryColor dark:text-white flex items-center justify-center shrink-0">
                <FiEdit2 size={13} />
              </span>
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <span className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <FiTrash2 size={13} />
              </span>
              {t("delete")}
            </button>
          </div>
        )}
      </div>
    </label>
  );
};

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: React.ReactNode;
}

// Icon-led section header.
const SectionHeader = ({ icon, title, count }: SectionHeaderProps) => (
  <span className="font-bold text-lg md:text-xl flex items-center gap-2 min-w-0">
    {icon && (
      <span className="primaryColor dark:text-white shrink-0">{icon}</span>
    )}
    <span className="truncate">{title}</span>
    {count && (
      <span className="SecondaryTextColor font-normal text-sm md:text-base shrink-0">
        ({count})
      </span>
    )}
  </span>
);

interface RecommendationStripProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** recommendation product rows from api.getCartRecommendations() — no
   * exported type, kept `any[]`. */
  products: any[];
}

// Product Swiper for cart recommendations (cross-sell / upsell). Renders nothing
// when empty. Reuses HomeVerticleProductCard so add-to-cart / variant / favorite
// all work as-is. Arrow navigation (no raw scrollbar); ~4 cards/row on desktop.
// `id` makes the prev/next nav targets unique so the two strips don't collide.
const RecommendationStrip = ({ id, title, subtitle, products }: RecommendationStripProps) => {
  const rtl = isRtl();
  if (!products || products.length === 0) return null;
  return (
    <div className="bodyBackgroundColor cardBorder !rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 md:p-5">
        <div className="min-w-0">
          <span className="font-bold text-lg md:text-xl">{title}</span>
          {subtitle && (
            <p className="text-xs SecondaryTextColor mt-1">{subtitle}</p>
          )}
        </div>
        {products.length > 1 && (
          <div
            className={`hidden md:flex gap-2 shrink-0 ${rtl ? "flex-row-reverse" : ""}`}
          >
            <button
              type="button"
              className={`group textColor cardBorder rounded-full rec-prev-${id} p-2 hover:primaryBackColor hover:text-white transition-all`}
              aria-label={t("previous") || "Previous"}
            >
              <IoMdArrowBack
                size={18}
                className="group-hover:text-white transition-colors"
              />
            </button>
            <button
              type="button"
              className={`group textColor cardBorder rounded-full rec-next-${id} p-2 hover:primaryBackColor hover:text-white transition-all`}
              aria-label={t("next") || "Next"}
            >
              <IoMdArrowForward
                size={18}
                className="group-hover:text-white transition-colors"
              />
            </button>
          </div>
        )}
      </div>
      <div className="px-4 md:px-5 pb-4 md:pb-5">
        {/* React stringifies key internally; String(rtl) keeps the exact same
            runtime key ("true"/"false") while satisfying TS's Key type. */}
        <Swiper
          key={String(rtl)}
          modules={[Navigation]}
          spaceBetween={12}
          // Pad inside the swiper so the last/first card's border + box-shadow have
          // room to render — without it the edge cards get clipped by Swiper's own
          // overflow:hidden when slidesPerView fits the row exactly.
          slidesOffsetBefore={2}
          slidesOffsetAfter={2}
          style={{ paddingTop: 4, paddingBottom: 4 }}
          navigation={{ prevEl: `.rec-prev-${id}`, nextEl: `.rec-next-${id}` }}
          breakpoints={{
            0: { slidesPerView: 1.5, spaceBetween: 10 },
            500: { slidesPerView: 2.2, spaceBetween: 10 },
            768: { slidesPerView: 3, spaceBetween: 12 },
            1024: { slidesPerView: 4, spaceBetween: 12 },
          }}
        >
          {products.map((product) => (
            <SwiperSlide
              key={product?.variant_id || product?.id}
              className="h-auto"
            >
              <HomeVerticleProductCard product={product} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

// One selectable row in the payment picker dialog (icon + label + radio).
// Short, reassuring one-liner under each method name. Keys match paymentOptions
// values; missing keys just render no subtitle (kept optional on purpose).
const payMethodSubtitle = (method: string) => {
  const map: Record<string, string> = {
    COD: t("pay_when_delivered") || "Pay in cash when your order arrives",
    razorpay: t("pay_via_upi_cards") || "UPI, cards, net banking & wallets",
    paypal: t("pay_with_paypal") || "Pay securely with your PayPal account",
    paystack: t("cards_and_bank") || "Cards & bank transfer",
    stripe: t("pay_via_upi_cards") || "Credit & debit cards",
    cashfree: t("pay_via_upi_cards") || "UPI, cards & net banking",
    midtrans: t("cards_and_bank") || "Cards, bank transfer & e-wallets",
    phonepe: t("pay_via_upi_cards") || "UPI & wallet",
    paytabs: t("cards_and_bank") || "Cards & bank transfer",
  };
  return map[method] || "";
};

interface PayPickRowProps {
  opt: { value: string; label: string };
  active: boolean;
  onPick: () => void;
}

// One selectable payment method, styled as a light card. Selection is shown with
// a thin primary border, a barely-there tint and an animated check — no heavy
// fills, per the app's light/clean design language.
const PayPickRow = ({ opt, active, onPick }: PayPickRowProps) => {
  const subtitle = payMethodSubtitle(opt.value);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={`group relative flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 ${
        active
          ? "primaryColorBorder primaryLightBack dark:border-white dark:bg-white/[0.06] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.12)]"
          : "cardBorder hover:border-gray-300 dark:hover:border-gray-600 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] hover:shadow-sm"
      }`}
    >
      {/* brand logo tile */}
      <span
        className={`w-9 h-9 rounded-lg bg-white dark:bg-white/10 border cardBorder flex items-center justify-center shrink-0 transition-all duration-200 primaryColor dark:text-white ${
          active ? "shadow-sm scale-[1.03]" : "group-hover:shadow-sm"
        }`}
      >
        {payMethodIcon(opt.value)}
      </span>

      {/* name + subtitle */}
      <span className="flex flex-col min-w-0 flex-1">
        <span className="font-semibold text-sm md:text-[15px] textColor capitalize truncate">
          {opt.label}
        </span>
        {subtitle && (
          <span className="text-xs SecondaryTextColor leading-snug line-clamp-1 mt-0.5">
            {subtitle}
          </span>
        )}
      </span>

      {/* check indicator (replaces the radio dot) */}
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
          active
            ? "primaryBackColor dark:bg-white text-white dark:text-black scale-100"
            : "border-2 border-gray-300 dark:border-gray-600 group-hover:border-gray-400 scale-95"
        }`}
      >
        <FiCheck
          size={12}
          strokeWidth={3}
          className={`transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
        />
      </span>
    </button>
  );
};

interface RowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  onRemove?: () => void;
  badge?: { refundable?: any };
  // When set, this row's `value` already has this tax amount baked into it
  // (same "already inclusive" shape as sub_total/tax_amount) — surfaced via a
  // small (i) tooltip next to the label rather than a permanent extra line,
  // so the bill stays visually calm. Pre-formatted (via the caller's own
  // `money()`) since Row is a module-level component with no access to the
  // page's currency/decimals closure.
  taxNote?: React.ReactNode;
}

const Row = ({ label, value, onRemove, badge, taxNote }: RowProps) => (
  <div className="flex justify-between items-center gap-3 text-sm">
    <span className="SecondaryTextColor flex items-center gap-2 min-w-0 flex-wrap">
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className={`text-[11px] font-medium leading-none ${
            badge.refundable
              ? "text-green-600 dark:text-green-400"
              : "text-gray-400 dark:text-zinc-500"
          }`}
        >
          (
          {badge.refundable
            ? t("refundable") || "Refundable"
            : t("non_refundable") || "Non-refundable"}
          )
        </span>
      )}
      {taxNote && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                aria-label={typeof taxNote === "string" ? taxNote : "tax info"}
              >
                <FiInfo size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{taxNote}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {onRemove && (
        <button
          type="button"
          className="text-red-500 hover:text-red-600 transition shrink-0"
          onClick={onRemove}
          aria-label="remove"
        >
          <FiTrash2 size={14} />
        </button>
      )}
    </span>
    <span className="font-semibold textColor shrink-0">{value}</span>
  </div>
);

export default CheckoutUI;
