"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";
import useZoneHref from "@/hooks/useZoneHref";
import { clearCartPromo, clearPrescriptions } from "@/redux/slices/cartSlice";
import { setPhonePeCheckoutDetails } from "@/redux/slices/checkoutSlice";

const StripeModal = dynamic(() => import("@/components/checkoutpage/StripeModal"), {
  ssr: false,
});

export interface PlaceOrderParams {
  /** "COD" | "wallet" | gateway label */
  method: string;
  /** amount to charge at the gateway */
  payable: number;
  subTotal: number;
  deliveryCharge: number;
  finalTotal: number;
  walletUsed: boolean;
  walletBalance: number;
  addressId: number | string;
  orderNote?: string;
  promocodeId?: number;
  /** default "doorstep" */
  orderType?: string;
  prescriptions?: any;
  /** called after the order is created (e.g. close drawer) */
  onCreated?: () => void;
  /** default true — when false, the billing* fields below are sent */
  billingSameAsShipping?: boolean;
  billingName?: string;
  billingMobile?: string;
  billingCountryCode?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  billingCountry?: string;
  billingRegionId?: string | number;
}

/**
 * Order placement + payment gateway machinery shared by the checkout page and the
 * quick-checkout drawer. Wraps place_order and EVERY gateway path so a caller only
 * needs to hand over the order params + the payable amount:
 *   COD / wallet          → status page directly
 *   razorpay              → JS SDK modal
 *   paystack              → inline-js iframe
 *   stripe                → embedded StripeModal (returned as `StripePortal`)
 *   cashfree/phonepe/…    → redirect URL
 *
 * Mirrors CheckoutUI's handlers so behaviour (order cleanup on cancel, status-page
 * redirect, addTransaction on success) stays identical.
 *
 * Returns:
 *   placeOrder(args)  async — see below
 *   paymentLoading    boolean
 *   StripePortal      JSX | null — render this in the tree for stripe support
 *
 * Payment-gateway request/response shapes (Razorpay, Paystack, and the various
 * API responses) are kept as `any` throughout this hook — they are third-party
 * SDK internals / raw backend JSON with no exported types, per this project's
 * pragmatic-TS policy. This is a typing-only pass; no behavior changes.
 */
export default function useOrderPlacement() {
  const dispatch = useDispatch();
  const router = useRouter();
  const zoneHref = useZoneHref();
  const setting = useSelector((state: any) => state.Setting.setting);
  const countrySetting = useSelector((state: any) => state.CountrySetting?.countrySetting);
  const paymentSetting = useSelector((state: any) => state.Setting.payment_setting);
  const user = useSelector((state: any) => state.User.user);
  const city = useSelector((state: any) => state.City.city);
  const cart = useSelector((state: any) => state.Cart);

  const [paymentLoading, setPaymentLoading] = useState(false);
  // Stripe embedded flow state.
  const [showStripe, setShowStripe] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [stripeTransactionId, setStripeTransactionId] = useState("");
  const [stripeOrderId, setStripeOrderId] = useState("");
  const [stripeAmount, setStripeAmount] = useState(0);


  const statusUrl = (method: string, orderId: number | string) =>
    zoneHref(
      `/web-payment-status?status=success&type=order&payment_method=${method}&order_id=${orderId}`,
    );

  // place_order returns only {status,message}; read the newest order back for its id.
  const fetchLatestOrderId = async (): Promise<number | string | null> => {
    try {
      const res: any = await api.getOrders({ limit: 1, offset: 0, type: "", orderType: "" });
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return row?.id ?? row?.order_id ?? null;
    } catch (error) {
      console.log("[useOrderPlacement] fetchLatestOrderId failed", error);
      return null;
    }
  };

  const initializeRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayCancel = async (orderId: number | string) => {
    await api.deleteOrder({ orderId });
  };

  const handleRazorpayPayment = async (
    orderId: number | string,
    transactionId: string,
    amount: number,
    method: string,
    capitalized: string,
    currency?: string,
  ) => {
    const ok = await initializeRazorpay();
    if (!ok) {
      console.error("Razorpay SDK load failed");
      return;
    }
    const options: any = {
      key: paymentSetting?.razorpay_key,
      amount: Math.floor(amount * 100),
      // Use currency from the Razorpay order (initiate_transaction response);
      // fall back to the zone-aware country setting, then the global setting,
      // then to "INR" as last resort.
      currency: currency || countrySetting?.currency_code || setting?.currency_code || "INR",
      name: user?.name,
      description: setting?.app_name,
      image: setting?.web_settings?.web_logo,
      order_id: transactionId,
      handler: async (res: any) => {
        if (!res?.razorpay_payment_id) return;
        try {
          setPaymentLoading(true);
          const response: any = await api.addTransaction({
            orderId,
            transactionId: res.razorpay_payment_id,
            paymentMethod: capitalized,
            type: "order",
          });
          if (response.status === 1) {
            setPaymentLoading(false);
            return router.push(statusUrl(method, orderId));
          }
          setPaymentLoading(false);
          toast.error(response.message);
        } catch (error) {
          console.error("[useOrderPlacement] razorpay transaction error", error);
          setPaymentLoading(false);
        }
      },
      modal: {
        confirm_close: true,
        ondismiss: async () => {
          await handleRazorpayCancel(orderId);
        },
      },
      prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
      theme: { color: setting?.web_settings?.color },
    };
    // window.Razorpay is injected by the SDK script loaded above; no bundled
    // types exist for it, so it's accessed via `any`.
    const rzpay = new (window as any).Razorpay(options);
    rzpay.on("payment.cancel", () => handleRazorpayCancel(orderId));
    rzpay.on("payment.failed", () => api.deleteOrder({ orderId }));
    rzpay.open();
  };

  const handlePaystackPayment = async (
    orderId: number | string,
    amount: number | string,
    method: string,
    capitalized: string,
  ) => {
    try {
      const { default: PaystackPop }: any = await import("@paystack/inline-js");
      const handler = PaystackPop.setup({
        key: paymentSetting?.paystack_public_key,
        email: user?.email,
        amount: parseFloat(String(amount)) * 100,
        currency: paymentSetting?.paystack_currency_code,
        ref: `${Date.now()}`,
        label: setting?.support_email,
        onClose: () => api.deleteOrder({ orderId }),
        callback: async (res: any) => {
          try {
            setPaymentLoading(true);
            const response: any = await api.addTransaction({
              orderId,
              transactionId: res.reference,
              paymentMethod: capitalized,
              type: "order",
            });
            if (response.status == 1) {
              setPaymentLoading(false);
              return router.push(statusUrl(method, orderId));
            }
            setPaymentLoading(false);
            toast.error(response.message);
          } catch (error) {
            console.log("[useOrderPlacement] paystack error", error);
            setPaymentLoading(false);
          }
        },
      });
      handler.openIframe();
    } catch (error) {
      console.log("[useOrderPlacement] paystack setup error", error);
    }
  };

  // Runs the gateway step for an already-created order. `payable` = amount to charge.
  const runTransaction = async (
    orderId: number | string,
    method: string,
    payable: number,
  ) => {
    const capitalized = String(method).charAt(0).toUpperCase() + String(method).slice(1);

    if (method === "COD" || method === "wallet") {
      dispatch(clearCartPromo());
      dispatch(clearPrescriptions());
      return router.push(statusUrl(method, orderId));
    }
    if (method === "paystack") {
      return handlePaystackPayment(orderId, payable, method, capitalized);
    }

    const response: any = await api.initiateTrasaction({
      orderId,
      paymentMethod: capitalized,
      type: "order",
      latitude: city?.latitude,
      longitude: city?.longitude,
    });
    if (response.status != 1) {
      await api.deleteOrder({ orderId });
      toast.error(response?.message);
      return;
    }

    if (method === "phonepe") dispatch(setPhonePeCheckoutDetails(response?.data));

    if (method === "razorpay") {
      return handleRazorpayPayment(
        orderId,
        response?.data?.transaction_id,
        payable,
        method,
        capitalized,
        response?.data?.currency,
      );
    }
    if (method === "stripe") {
      setStripeOrderId(String(orderId));
      setStripeClientSecret(response?.data?.client_secret);
      setStripeTransactionId(response?.data?.id);
      setStripeAmount(payable);
      setShowStripe(true);
      return;
    }
    // Redirect gateways.
    dispatch(clearCartPromo());
    dispatch(clearPrescriptions());
    const redirectUrls: Record<string, string | undefined> = {
      cashfree: response?.data?.redirectUrl,
      phonepe: response?.data?.redirectUrl,
      paytabs: response?.data?.redirectUrl,
      paypal: response?.data?.paypal_redirect_url,
      midtrans: response?.data?.snapUrl,
    };
    const url = redirectUrls[method];
    if (url) router.push(url);
    else console.error("[useOrderPlacement] unsupported method:", method);
  };

  /**
   * Create the order then run its payment step.
   */
  const placeOrder = async ({
    method,
    payable,
    subTotal,
    deliveryCharge,
    finalTotal,
    walletUsed,
    walletBalance,
    addressId,
    orderNote = "",
    promocodeId = 0,
    orderType = "doorstep",
    prescriptions = null,
    onCreated,
    billingSameAsShipping = true,
    billingName = "",
    billingMobile = "",
    billingCountryCode = "",
    billingAddress = "",
    billingCity = "",
    billingState = "",
    billingPincode = "",
    billingCountry = "",
    billingRegionId,
  }: PlaceOrderParams): Promise<boolean> => {
    // COD & wallet settle immediately (status 2); gateways create as pending (1).
    const status = method === "COD" || method === "wallet" ? 2 : 1;
    setPaymentLoading(true);
    try {
      const response: any = await api.placeOrder({
        total: subTotal,
        deliveryCharge,
        finalTotal,
        walletUsed,
        walletBalance,
        addressId,
        orderNote,
        paymentMethod: method,
        promocodeId,
        status,
        order_type: orderType,
        prescriptions,
        billingSameAsShipping,
        billingName,
        billingMobile,
        billingCountryCode,
        billingAddress,
        billingCity,
        billingState,
        billingPincode,
        billingCountry,
        billingRegionId,
      });
      if (response?.status != 1) {
        toast.error(response?.message || t("something_went_wrong"));
        setPaymentLoading(false);
        return false;
      }
      let orderId = response?.order_id ?? response?.data?.order_id;
      if (!orderId) orderId = await fetchLatestOrderId();
      onCreated?.();
      await runTransaction(orderId, method, payable);
      setPaymentLoading(false);
      return true;
    } catch (error: any) {
      console.error("[useOrderPlacement] placeOrder failed", error);
      toast.error(error?.message || t("something_went_wrong"));
      setPaymentLoading(false);
      return false;
    }
  };

  // StripeModal is an untyped .jsx component; TS synthesizes `setWalletModal`
  // as a required prop from its unconditional internal usage, but the
  // order-placement flow (unlike the wallet top-up flow in
  // WalletBalanceModal.jsx) never needed it and never passed it, even before
  // this file was typed — see CheckoutUI.jsx's identical StripeModal usage.
  // Cast rather than pass a fake prop, to keep behavior byte-for-byte the same.
  const StripeModalAny = StripeModal as any;
  const StripePortal = showStripe ? (
    <StripeModalAny
      showStripe={showStripe}
      setShowStripe={setShowStripe}
      amount={stripeAmount}
      clientSecret={stripeClientSecret}
      stripeTransId={stripeTransactionId}
      stripeOrderId={stripeOrderId}
      type="order"
    />
  ) : null;

  return { placeOrder, paymentLoading, StripePortal };
}
