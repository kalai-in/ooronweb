import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import useOrderPlacement from "@/hooks/useOrderPlacement";
import useStoreClosed from "@/hooks/useStoreClosed";
import { setAllAddresses } from "@/redux/slices/addressSlice";
import { clearCartPromo } from "@/redux/slices/cartSlice";
import { hasMissingRequiredPrescriptions } from "@/utils/helperFunction";
import AppliedCouponCard from "./AppliedCouponCard";
import UnlockCouponNudge from "./UnlockCouponNudge";
import {
  RiMapPin2Line,
  RiHome4Line,
  RiBriefcase4Line,
  RiWallet3Line,
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiTimeLine,
  RiPencilLine,
  RiCheckLine,
} from "react-icons/ri";
import { MdOutlineCelebration } from "react-icons/md";
import CartDrawerSkeletons from "./CartDrawerLoading.jsx";
import CartProductsCard from "./CartDrawerProductsCard";
import NewAddressModal from "@/components/newaddressmodal/NewAddressModal";
import RazorpayLogo from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalLogo from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackLogo from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StripeLogo from "@/assets/payment_methods_svgs/ic_stripe.svg";
import CashfreeLogo from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import MidtransLogo from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeLogo from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsLogo from "@/assets/payment_methods_svgs/ic_paytabs.svg";

// Enabled online gateways, keyed by the merchant's payment_setting flag. COD +
// wallet are handled separately (no flag / balance-gated). Same set as checkout.
const GATEWAYS = [
  { key: "razorpay_payment_method", value: "razorpay", logo: RazorpayLogo },
  { key: "paypal_payment_method", value: "paypal", logo: PaypalLogo },
  { key: "paystack_payment_method", value: "paystack", logo: PaystackLogo },
  { key: "stripe_payment_method", value: "stripe", logo: StripeLogo },
  { key: "cashfree_payment_method", value: "cashfree", logo: CashfreeLogo },
  { key: "midtrans_payment_method", value: "midtrans", logo: MidtransLogo },
  { key: "phonepay_payment_method", value: "phonepe", logo: PhonePeLogo },
  { key: "paytabs_payment_method", value: "paytabs", logo: PaytabsLogo },
];

// Uniform right-side selector for every payment row (wallet, COD, gateways):
// filled primary check when active, faint ring when not.
const CheckCircle = ({ active }) => (
  <span
    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
      active
        ? "primaryBackColor border-transparent text-white"
        : "border-[color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
    }`}
  >
    {active && <RiCheckLine size={15} />}
  </span>
);

/**
 * In-drawer express checkout with FULL payment support (COD, wallet, and every
 * enabled online gateway) via the shared useOrderPlacement hook:
 *   getAddress → getCart(checkout:1) for totals → placeOrder → gateway → status.
 *
 * Single-page: renders the cart items too (with qty steppers + coupon) so the
 * whole flow — items, address, payment, bill — lives on ONE scroll, no separate
 * cart step.
 *
 * @param {()=>void} onClose  close the whole drawer
 * @param {(n:number)=>string} money  currency formatter from the parent drawer
 * @param {string} currency
 * @param {number} decimals
 * @param {Array}  cartProductsData     drawer's synced cart rows
 * @param {Function} setCartProductsData
 * @param {Function} setCartData
 * @param {()=>void} onViewCoupons      open the coupon-list view in the drawer
 */
const QuickCheckoutView = ({
  onClose,
  money,
  currency,
  decimals,
  cartProductsData = [],
  setCartProductsData,
  setCartData,
  onViewCoupons,
}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { storeClosed, notifyClosed, closedProps } = useStoreClosed();
  const cart = useSelector((state) => state.Cart);
  const user = useSelector((state) => state.User);
  const paymentSetting = useSelector((state) => state.Setting.payment_setting);
  const city = useSelector((state) => state.City.city);
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const appliedCoupon = useSelector((state) => state.Cart.promo_code);
  const prescriptions = useSelector((state) => state.Cart.prescriptions);
  const { placeOrder, paymentLoading, StripePortal } = useOrderPlacement();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  // Selected method: "COD" | "wallet" | gateway value (razorpay/stripe/…).
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [useWallet, setUseWallet] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  // Scroll targets for the progressive CTA (jump to the step that's missing).
  const paymentSectionRef = useRef(null);
  const cartSectionRef = useRef(null);
  // Collapsed by default: show only the selected address + a Change button.
  // Expanded shows the full list to pick from.
  const [showAllAddresses, setShowAllAddresses] = useState(false);

  // Gateway success (Razorpay/Paystack/Stripe/redirect-based) pushes to the
  // status page via router.push, a client-side nav that leaves Header (and
  // this drawer, mounted inside it) alive — so it stays open behind the
  // success screen unless we close it here once the route lands.
  useEffect(() => {
    if (router.pathname.includes("web-payment-status")) onClose?.();
  }, [router.pathname, onClose]);

  // Wallet balance lives on user.user.balance. The checkout page gates wallet
  // purely on a positive balance (no separate enable flag), so mirror that.
  const walletBalance = Number(user?.user?.balance || 0);
  const enabledGateways = GATEWAYS.filter(
    (g) => paymentSetting?.[g.key] === "1",
  );

  const formatAddress = (a) =>
    [a?.address, a?.area, a?.city, a?.state, a?.pincode, a?.country]
      .filter(Boolean)
      .join(", ");

  const addressIcon = (type) => {
    const key = String(type || "").toLowerCase();
    if (key === "home") return RiHome4Line;
    if (key === "work" || key === "office") return RiBriefcase4Line;
    return RiMapPin2Line;
  };

  // Load saved addresses. `selectNewestFrom` (list of prior ids) comes from the
  // add-address modal — the id NOT in that list is the freshly created one, so we
  // auto-select it; otherwise preselect the default (else first).
  const loadAddresses = async ({ selectNewestFrom } = {}) => {
    setAddressLoading(true);
    try {
      const res = await api.getAddress();
      const list = Array.isArray(res?.data) ? res.data : [];
      setAddresses(list);
      // Mirror into redux so the shared add-address modal snapshots the correct
      // prior-id set (it reads state.Addresses.allAddresses for selectNewestFrom).
      dispatch(setAllAddresses({ data: list }));
      let preferred;
      if (Array.isArray(selectNewestFrom)) {
        const prev = new Set(selectNewestFrom);
        preferred = list.find((a) => !prev.has(a?.id));
      }
      preferred =
        preferred || list.find((a) => a?.is_default == 1) || list[0] || null;
      setSelectedAddress(preferred);
    } catch (error) {
      console.log("[quick-checkout] getAddress failed", error);
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once on mount only
  }, []);

  // Fetch checkout totals (delivery charge + final total) for the selected
  // address. Backend reads the server cart; we only pass geo + checkout flag.
  useEffect(() => {
    if (!selectedAddress) return;
    let alive = true;
    (async () => {
      setTotalsLoading(true);
      try {
        const res = await api.getCart({
          latitude: selectedAddress?.latitude ?? city?.latitude,
          longitude: selectedAddress?.longitude ?? city?.longitude,
          checkout: 1,
          order_type: "doorstep",
          promocode_id: cart?.promo_code?.promo_code_id || 0,
        });
        if (!alive) return;
        if (res?.status == 1) {
          setCheckoutData(res?.data);
        } else {
          setCheckoutData(null);
          if (res?.message) toast.error(res.message);
        }
      } catch (error) {
        console.log("[quick-checkout] getCart(checkout) failed", error);
      } finally {
        if (alive) setTotalsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // cart?.cartSubTotal changes on every +/- (syncFromServerCart dispatches
    // setCartSubTotal), so watching it refetches the checkout totals live instead
    // of leaving the bill stale until the drawer is reopened.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to selectedAddress?.id (not the whole object) + promo/subtotal; city is only a fallback when selectedAddress has no lat/lng and would over-trigger refetches if watched directly
  }, [
    selectedAddress?.id,
    cart?.promo_code?.promo_code_id,
    cart?.cartSubTotal,
  ]);

  // delivery_charge may arrive as a scalar or an object with total_delivery_charge.
  const deliveryCharge = useMemo(() => {
    const dc = checkoutData?.delivery_charge;
    const val = typeof dc === "object" ? dc?.total_delivery_charge : dc;
    return Number(val || 0);
  }, [checkoutData]);

  const subTotal = Number(checkoutData?.sub_total ?? cart?.cartSubTotal ?? 0);
  // No address selected yet ⇒ checkoutData never fetched (delivery/final total
  // need one) — show the item subtotal instead of 0 so the bill isn't blank.
  const totalAmount = Number(checkoutData?.total_amount ?? subTotal);
  const codAllowed = checkoutData?.cod_allowed == "1";
  // The selected address may be outside the serviceable area even though the
  // drawer-level cart (city coords) was deliverable. The checkout API reports
  // this per-address via is_deliverable_address (1 = OK, 0 = not serviceable).
  // Only trust it once totals have loaded — undefined before the first fetch.
  const isDeliverable =
    checkoutData == null || Number(checkoutData?.is_deliverable_address) === 1;
  const walletCoversAll = walletBalance >= totalAmount && totalAmount > 0;

  // Savings + cashback (mirrors the cart drawer). "wallet" apply-type coupons are
  // cashback (credited after the order, NOT a price reduction); "instant" coupons
  // reduce the price. saved_amount = product slab savings.
  const isCashbackCoupon = appliedCoupon?.discount_apply_type === "wallet";
  const promoDiscount = Number(appliedCoupon?.discount || 0);
  const productSaved = Number(checkoutData?.saved_amount || 0);
  // Total price savings — read straight from the API's `saved_amount`, which
  // already accounts for the applied promo code. Adding promoDiscount on top of
  // it double-counted the coupon (saved_amount 200 + promo 100 rendered "You
  // saved 300" while the bill only came down by 200).
  const totalSaved = productSaved;

  // Extra charge lines from the checkout response (same 3 sources as the checkout
  // page). Each normalized to {label, amount, refundable} for one render loop.
  // total_amount already includes these — this is display only.
  const chargeRows = [
    ...(checkoutData?.additional_charges || []).map((c) => ({
      label: c?.title,
      amount: Number(c?.amount || 0),
      refundable: undefined,
    })),
    ...(checkoutData?.surge_charges || []).map((c) => ({
      label: c?.label,
      amount: Number(c?.charge || 0),
      refundable: c?.is_refundable,
    })),
    ...(checkoutData?.zone_additional_charges || []).map((c) => ({
      label: c?.name,
      amount: Number(c?.amount || 0),
      refundable: c?.is_refundable,
    })),
  ].filter((r) => r.label);

  // Amount the wallet redeems (only the portion up to the total) + the residual
  // that still needs a real method (COD here). Full-cover ⇒ payable 0.
  const walletUsedAmount = useWallet ? Math.min(walletBalance, totalAmount) : 0;
  const payable = Math.max(totalAmount - walletUsedAmount, 0);

  let walletStatusLabel;
  if (walletCoversAll) {
    walletStatusLabel = useWallet
      ? t("pay_fully_with_wallet") || "Paying fully with wallet"
      : t("pay_fully_with_wallet") || "Pay fully with wallet";
  } else if (useWallet) {
    walletStatusLabel = `${t("wallet_applied") || "Applied"} ${money(walletUsedAmount)}`;
  } else {
    walletStatusLabel = t("redeem_at_checkout") || "Redeem at checkout";
  }

  // Effective payment method: wallet fully covers ⇒ "wallet"; otherwise the
  // explicitly chosen method (COD or an online gateway). Partial wallet rides
  // along via walletUsed while the chosen method settles the residual.
  const effectiveMethod =
    useWallet && walletCoversAll ? "wallet" : paymentMethod;

  const missingRx = hasMissingRequiredPrescriptions(
    cartProductsData,
    prescriptions,
  );

  const canPlace =
    !!selectedAddress &&
    !paymentLoading &&
    !totalsLoading &&
    !!effectiveMethod &&
    !missingRx;

  const handlePlaceOrder = async () => {
    if (storeClosed) {
      notifyClosed();
      return;
    }
    if (!selectedAddress) {
      toast.error(t("please_select_address"));
      return;
    }
    if (!isDeliverable) {
      toast.error(t("sorry_we_are_not_delivering_on_selected_address"));
      return;
    }
    if (!effectiveMethod) {
      toast.error(t("please_select_payment_method"));
      return;
    }
    if (missingRx) {
      toast.error(
        t("please_upload_required_prescription") ||
          "Please upload a prescription for all required medical items",
      );
      return;
    }
    // Only COD/wallet navigate straight to the status page, so the drawer can
    // close on those. For gateway methods the drawer MUST stay mounted — the
    // Stripe modal (StripePortal below) is rendered inside this component and
    // would unmount with the drawer; Razorpay's overlay + redirect gateways are
    // also driven from here. Leave it open until the gateway resolves.
    const settlesInline =
      effectiveMethod === "COD" || effectiveMethod === "wallet";

    // Hand off to the shared placement hook — it owns every gateway path
    // (COD/wallet → status page, razorpay/stripe modal, redirect gateways).
    await placeOrder({
      method: effectiveMethod,
      payable,
      subTotal,
      deliveryCharge,
      finalTotal: payable,
      walletUsed: useWallet,
      walletBalance: walletUsedAmount,
      addressId: selectedAddress?.id,
      orderNote: orderNote?.trim() || "",
      promocodeId: cart?.promo_code?.promo_code_id || 0,
      orderType: "doorstep",
      prescriptions,
      onCreated: settlesInline ? () => onClose?.() : undefined,
    });
  };

  // Progressive CTA: the footer button guides the user to the next missing step
  // instead of just sitting disabled — no address → "Add Address" (opens the
  // add-address modal); address but no payment → "Select Payment" (scrolls to
  // the payment section); everything ready → "Place Order".
  const cta = (() => {
    if (!selectedAddress)
      return {
        label: t("add_new_address") || "Add New Address",
        action: () => setShowAddAddress(true),
        ready: false,
      };
    if (!isDeliverable)
      return {
        label: t("sorry_we_are_not_delivering_on_selected_address"),
        action: () => setShowAllAddresses(true),
        ready: false,
        blocked: true,
      };
    if (!effectiveMethod)
      return {
        label: t("select_payment_method") || "Select Payment Method",
        action: () =>
          paymentSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        ready: false,
      };
    if (missingRx)
      return {
        label: t("upload_prescription") || "Upload Prescription",
        action: () => {
          toast.error(
            t("please_upload_required_prescription") ||
              "Please upload a prescription for all required medical items",
          );
          cartSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        },
        ready: false,
      };
    return {
      label: t("place_order") || "Place Order",
      action: handlePlaceOrder,
      ready: true,
    };
  })();

  // Reading cta.ready here is not a render-time ref access: cta.action closures
  // (which touch paymentSectionRef/cartSectionRef) only run inside their click
  // handler, never during render. The compiler's static analysis can't see that
  // distinction through the `cta` object, hence the disable.
  // eslint-disable-next-line react-hooks/refs
  const ctaClosedSpreadProps = cta.ready ? closedProps : {};
  // eslint-disable-next-line react-hooks/refs
  const ctaClosedClassName = cta.ready ? (closedProps.className ?? "") : "";

  return (
    <>
      {/* flex-1 + min-h-0 (NOT h-full): fill the space left AFTER the SheetHeader in
        the drawer's flex column. h-full took the FULL 100dvh, ignoring the header,
        which pushed the footer (Place Order) below the viewport. */}
      <div className="flex min-h-0 flex-1 flex-col bodyBackgroundColor">
        <div className="flex-grow space-y-4 overflow-y-auto p-4">
          {/* Address — collapses to a single-line pill (pin + selected address +
            edit) so it stays out of the way; tapping edit expands the full picker.
            Rendered FIRST so the delivery address is the top thing the user sees. */}
          {addressLoading ? (
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg p-4 shadow-sm">
              <CartDrawerSkeletons />
            </section>
          ) : !showAllAddresses && selectedAddress ? (
            /* Collapsed pill — one compact row. Whole row is the edit affordance. */
            <button
              type="button"
              onClick={() => setShowAllAddresses(true)}
              className="flex w-full items-center gap-2.5 cardBorderPrimary !rounded-lg bodyBackgroundColor px-4 py-3 text-start shadow-sm transition-colors hover:primaryLightBack"
            >
              <RiMapPin2Line size={18} className="primaryColor shrink-0" />
              <div className="flex min-w-0 flex-grow flex-col">
                <span className="flex items-center gap-1.5 text-sm font-bold textColor">
                  <span className="truncate">
                    {t("deliver_to") || "Deliver to"}{" "}
                    {selectedAddress?.type || selectedAddress?.name}
                  </span>
                  {shopMode === "quick" && checkoutData?.time_to_deliver && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium primaryColor">
                      <RiTimeLine size={12} />
                      {checkoutData?.time_to_deliver}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs SecondaryTextColor leading-snug">
                  {formatAddress(selectedAddress)}
                </span>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                <RiPencilLine size={14} />
              </span>
            </button>
          ) : (
            /* Expanded card — full header + address list (or add-address CTA). */
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2 font-bold text-base textColor">
                  <RiMapPin2Line size={17} className="primaryColor shrink-0" />
                  <span className="truncate">{t("delivery_address")}</span>
                </span>
              </div>
              <div className="p-4">
                {addresses.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] py-4 text-sm font-semibold primaryColor"
                  >
                    <RiAddLine size={18} />
                    {t("add_new_address") || "Add New Address"}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Full list — same markup as the checkout page's AddressCard.
                        Picking one collapses back to the pill. */}
                    {addresses.map((addr) => {
                      const Icon = addressIcon(addr?.type);
                      const active = selectedAddress?.id === addr?.id;
                      return (
                        <label
                          key={addr?.id}
                          className={`relative flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition ${
                            active
                              ? "primaryColorBorder dark:border-white dark:bg-white/5"
                              : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:border-[color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="quick_delivery_address"
                            className="sr-only"
                            checked={active}
                            onChange={() => {
                              setSelectedAddress(addr);
                              // Picking one collapses back to the single-line summary.
                              setShowAllAddresses(false);
                            }}
                          />
                          <span
                            className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                              active
                                ? "primaryColorBorder dark:border-white"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {active && (
                              <span className="w-2 h-2 rounded-full primaryBackColor dark:bg-white" />
                            )}
                          </span>
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active
                                ? "primaryBackColor text-white"
                                : "primaryLightBack primaryColor dark:text-white"
                            }`}
                          >
                            <Icon size={15} />
                          </span>
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
                        </label>
                      );
                    })}
                    {/* Add another address — opens the shared modal. */}
                    <button
                      type="button"
                      onClick={() => setShowAddAddress(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] py-2.5 text-sm font-semibold primaryColor transition-colors hover:primaryLightBack"
                    >
                      <RiAddLine size={16} />
                      {t("add_new_address") || "Add New Address"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Undeliverable banner — the selected address is outside the
            serviceable area. Items stay; only checkout is blocked. */}
          {!isDeliverable && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2.5">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t("sorry_we_are_not_delivering_on_selected_address")}
              </p>
            </div>
          )}

          {/* Cart items — single-page: the whole flow (items → address → payment →
            bill) lives on one scroll, so items + qty steppers render here too. */}
          {cartProductsData?.length > 0 && (
            <section
              ref={cartSectionRef}
              className="scroll-mt-4 bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
                <span className="flex items-center gap-2 font-bold text-lg textColor">
                  {t("shoppingCart") || "Your Cart"}
                  <span className="text-sm font-normal SecondaryTextColor">
                    ({cartProductsData.length} {t("items")})
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                {cartProductsData.map((product) => (
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
            </section>
          )}

          {/* Coupon — its own card OUTSIDE the cart card: the offer is about the
              order, not about any one line item, so nesting it under the product
              list read as another cart row. Applied → the ticket with saved
              amount + remove; otherwise → the unlock nudge + view-all list. */}
          {appliedCoupon ? (
            <AppliedCouponCard
              key={appliedCoupon?.promo_code}
              code={appliedCoupon?.promo_code}
              savedAmount={money(appliedCoupon?.discount)}
              discountType={appliedCoupon?.discount_type}
              onRemove={() => dispatch(clearCartPromo())}
              loading={false}
            />
          ) : (
            <UnlockCouponNudge
              code={checkoutData?.unlock_promo_code}
              message={checkoutData?.unlock_message}
              onViewAll={onViewCoupons}
            />
          )}

          {/* Delivery instruction / order note — sent to placeOrder as orderNote.
            Quick channel only (ecom/all-shop ships, no delivery-partner note). */}
          {shopMode === "quick" && (
            <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
              <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
                <span className="flex items-center gap-2 font-bold text-lg textColor">
                  {t("order_notes") ||
                    t("delivery_instruction") ||
                    "Delivery Instruction"}
                </span>
              </div>
              <div className="p-4">
                <p className="mb-2 text-xs SecondaryTextColor">
                  {t("order_notes_hint") ||
                    "Add a delivery instruction for the delivery partner (optional)."}
                </p>
                <textarea
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder={
                    t("order_notes_placeholder") ||
                    "e.g. Leave at the door, call on arrival…"
                  }
                  className="w-full resize-none rounded-lg border border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] bg-transparent p-3 text-sm outline-none transition-colors focus:primaryColorBorder textColor placeholder:SecondaryTextColor"
                />
              </div>
            </section>
          )}

          {/* Coupon + unlock offer live on the cart view (before this step), so the
            code is already applied here — not repeated to avoid duplicate UI. */}

          {/* Payment method — COD, wallet + every enabled online gateway. */}
          <section
            ref={paymentSectionRef}
            className="scroll-mt-4 bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm"
          >
            <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
              <span className="flex items-center gap-2 font-bold text-lg textColor">
                {t("payment_method") || "Payment Method"}
              </span>
            </div>
            <div className="p-4">
              {/* Recommended: wallet (toggle) + COD. */}
              <div className="flex flex-col gap-2">
                {walletBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseWallet((v) => !v);
                      if (!useWallet && walletCoversAll)
                        setPaymentMethod("wallet");
                      if (useWallet && paymentMethod === "wallet")
                        setPaymentMethod(null);
                    }}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      useWallet
                        ? "primaryColorBorder primaryLightBack"
                        : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                      <RiWallet3Line size={18} />
                    </span>
                    <div className="min-w-0 flex-grow text-left">
                      <p className="text-sm font-bold textColor">
                        {t("wallet_balance") || "Wallet Balance"}
                      </p>
                      <p className="text-[11px] SecondaryTextColor">
                        {walletStatusLabel}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold primaryColor tabular-nums">
                      {money(walletBalance)}
                    </span>
                    <CheckCircle active={useWallet} />
                  </button>
                )}

                {/* Wallet full-cover ⇒ it IS the payment; hide the rest. */}
                {!(useWallet && walletCoversAll) && codAllowed && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("COD")}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      paymentMethod === "COD"
                        ? "primaryColorBorder primaryLightBack"
                        : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                      <RiMoneyDollarCircleLine size={18} />
                    </span>
                    <div className="min-w-0 flex-grow text-left">
                      <p className="text-sm font-bold textColor">
                        {t("cash_on_delivery") || "Cash on Delivery"}
                      </p>
                      <p className="text-[11px] SecondaryTextColor">
                        {t("pay_when_you_receive") || "Pay when you receive"}
                      </p>
                    </div>
                    <CheckCircle active={paymentMethod === "COD"} />
                  </button>
                )}
              </div>

              {/* Online gateways — compact single-line rows (logo + name + radio),
              much shorter than tall tiles so a long list stays tight. */}
              {!(useWallet && walletCoversAll) &&
                enabledGateways.length > 0 && (
                  <>
                    <div className="my-3 flex items-center gap-2">
                      <span className="h-px flex-grow bg-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider SecondaryTextColor">
                        {t("pay_online") || "Pay Online"}
                      </span>
                      <span className="h-px flex-grow bg-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {enabledGateways.map((g) => {
                        const active = paymentMethod === g.value;
                        return (
                          <button
                            type="button"
                            key={g.value}
                            onClick={() => setPaymentMethod(g.value)}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                              active
                                ? "primaryColorBorder primaryLightBack"
                                : "border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/5 dark:bg-zinc-800">
                              <Image
                                src={g.logo}
                                alt={g.value}
                                height={16}
                                className="h-4 w-auto object-contain"
                              />
                            </span>
                            <span className="flex-grow truncate text-left text-sm font-semibold capitalize textColor">
                              {t(g.value) || g.value}
                            </span>
                            <CheckCircle active={active} />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
            </div>
          </section>

          {/* Bill breakdown — lives INSIDE the scroll area so a long list of charges
            can never push the Total + Place Order below the fold. The footer keeps
            only the grand total + CTA, always visible. */}
          <section className="bodyBackgroundColor cardBorderPrimary !rounded-lg shadow-sm">
            <div className="border-b border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4">
              <span className="flex items-center gap-2 font-bold text-lg textColor">
                {t("bill_details") || t("order_summary") || "Bill Details"}
              </span>
            </div>
            <div className="space-y-1.5 p-4">
              <div className="flex justify-between text-[13px] SecondaryTextColor">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{money(subTotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] SecondaryTextColor">
                <span>{t("delivery_charge") || "Delivery Charge"}</span>
                <span className="tabular-nums">
                  {deliveryCharge > 0
                    ? money(deliveryCharge)
                    : t("free") || "Free"}
                </span>
              </div>
              {/* Packing / handling / zone charges w/ refundable tag (checkout parity). */}
              {chargeRows.map((c, i) => (
                <div
                  key={`charge-${i}`}
                  className="flex justify-between text-[13px] SecondaryTextColor"
                >
                  <span className="flex items-center gap-1.5">
                    {c.label}
                    {c.refundable != null && (
                      <span
                        className={`text-[10px] font-semibold ${
                          c.refundable == 1 || c.refundable === true
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400"
                        }`}
                      >
                        {c.refundable == 1 || c.refundable === true
                          ? `(${t("refundable") || "Refundable"})`
                          : `(${t("non_refundable") || "Non-refundable"})`}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{money(c.amount)}</span>
                </div>
              ))}
              {appliedCoupon && Number(appliedCoupon?.discount || 0) > 0 && (
                <div className="flex justify-between text-[13px] primaryColor">
                  <span>{t("coupon_discount") || "Coupon Discount"}</span>
                  <span className="tabular-nums">
                    -{money(appliedCoupon?.discount)}
                  </span>
                </div>
              )}
              {useWallet && walletUsedAmount > 0 && (
                <div className="flex justify-between text-[13px] primaryColor">
                  <span>{t("wallet") || "Wallet"}</span>
                  <span className="tabular-nums">
                    -{money(walletUsedAmount)}
                  </span>
                </div>
              )}
            </div>
            {/* Total savings callout — product slab savings + instant coupon discount.
            Scalloped (ticket-style) top edge via a repeating radial-gradient mask.
            Cashback ("wallet") excluded here (shown as its own reward below). */}
            {totalSaved > 0 && (
              <div
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-3.5 pb-3 pt-4 text-center dark:from-emerald-500/10 dark:via-green-500/10 dark:to-teal-500/10"
                style={{
                  // Scalloped top edge: transparent half-circles cut out every 16px.
                  WebkitMaskImage:
                    "radial-gradient(circle 8px at 8px -2px, transparent 8px, #000 8.5px)",
                  maskImage:
                    "radial-gradient(circle 8px at 8px -2px, transparent 8px, #000 8.5px)",
                  WebkitMaskSize: "16px 100%",
                  maskSize: "16px 100%",
                  WebkitMaskRepeat: "repeat-x",
                  maskRepeat: "repeat-x",
                  borderRadius: "0 0 8px 8px",
                }}
              >
                <MdOutlineCelebration
                  size={18}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {t("you_saved")}{" "}
                  <span className="font-extrabold">{money(totalSaved)}</span>{" "}
                  <span className="font-normal text-emerald-600/80 dark:text-emerald-400/70">
                    {t("you_saved_on_this_order")}
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* Cashback reward — "wallet" apply-type coupon. Credited to the wallet
            AFTER the order, so it's a reward callout, never a price line. */}
          {appliedCoupon && isCashbackCoupon && (
            <div className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-2.5">
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
        </div>

        {/* Footer — the ONLY grand-total (breakdown above has no total row) + the CTA.
          Always visible; the scroll area above never pushes it off screen. */}
        <div className="shrink-0 w-full border-t bg-white px-4 pb-4 pt-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.15)] dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-medium uppercase tracking-wide SecondaryTextColor">
                {t("total") || "Total"}
              </span>
              {(chargeRows.length > 0 || deliveryCharge > 0) && (
                <span className="text-[10px] SecondaryTextColor">
                  {t("inclusive_of_charges") || "Incl. all charges"}
                </span>
              )}
            </div>
            <span className="text-2xl font-extrabold primaryColor tabular-nums">
              {money(payable)}
            </span>
          </div>
          {/* Progressive CTA: guides to the next missing step (Add Address →
              Select Payment → Place Order). The guide states stay ENABLED so the
              tap can open the modal / scroll to payment; only real blockers
              (loading, missing required Rx) disable it. */}
          <button
            type="button"
            onClick={cta.action}
            disabled={paymentLoading || totalsLoading || cta.blocked}
            {...ctaClosedSpreadProps}
            className={`primaryBackColor flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-[15px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 ${ctaClosedClassName}`}
          >
            {paymentLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t("placing_order") || "Placing order..."}
              </>
            ) : (
              cta.label
            )}
          </button>
        </div>
        {StripePortal}
      </div>

      {/* Shared add-address modal. On success it calls fetchAddress with the prior
          ids so loadAddresses can auto-select the newly created address. */}
      <NewAddressModal
        showAddAddres={showAddAddress}
        setShowAddAddres={setShowAddAddress}
        isAddressSelected={false}
        fetchAddress={loadAddresses}
      />
    </>
  );
};

export default QuickCheckoutView;
