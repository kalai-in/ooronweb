"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  clearCartPromo,
  setCart,
  setCartProducts,
  setCartSubTotal,
} from "@/redux/slices/cartSlice";
import {
  clearCheckout,
  clearPhonePeCheckoutDetails,
} from "@/redux/slices/checkoutSlice";
import { t } from "@/utils/translation";
import { formatCurrency } from "@/utils/helperFunction";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Module-scoped so it survives component remounts AND React StrictMode's
// double-mount in dev — a per-instance ref resets on remount and let the
// phonepe status verify (which logs a transaction row) fire twice. Keyed by
// transaction id so each transaction is verified exactly once per session.
//
// Map (not Set) because the verify is async: the router query settles over
// several renders and the page can remount before the fetch resolves, so a
// setStatus() from the first mount lands on a dead instance and is lost. A
// bare "already attempted" Set then blocks the re-fire and the UI hangs on
// "Please wait" forever. Cache the RESOLVED outcome instead — pending while
// in flight, then { status, orderId } — so a remount replays the result
// without hitting the server (no duplicate transaction row) and the status
// still lands on the live instance.
const phonepeTxnResults = new Map<
  string,
  "pending" | { status: "success" | "failed" | "pending" }
>();
import animationOne from "@/assets/order_place_animation/order_placed_back_animation.json";
import animationTwo from "@/assets/order_place_animation/order_success_tick_animation.json";
import animationFailed from "@/assets/order_place_animation/order_failed_animation.json";
import useZoneHref from "@/hooks/useZoneHref";
import useCurrency from "@/hooks/useCurrency";

const PaymentStatus = () => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();
  const phonePeData = useSelector(
    (state: any) => state.Checkout.phonepecheckoutdetails,
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pages Router's router.query was a plain object; next/navigation's
  // useSearchParams() returns a URLSearchParams instead. Rebuilt into the
  // same plain-object shape here (memoized on the params' own string form)
  // so every existing `query.x`/`query?.x` read below is unchanged — this
  // file has 15+ such reads across several effects, and object-shape parity
  // is the smallest, lowest-risk way to port them without touching each one.
  const query = React.useMemo(
    () => Object.fromEntries(searchParams?.entries() ?? []),
    [searchParams],
  );

  const [status, setStatus] = useState<"" | "pending" | "success" | "failed">("");
  const [type, setType] = useState<"" | "order" | "wallet" | "subscription">("");
  // Fetched order (for the receipt rows on success). null until loaded/failed.
  // Row shape varies (Quick vs. ecom order payload) plus a local `__ecom` tag,
  // so kept `any` — mirrors the untyped api.getOrders/getEcomOrders responses.
  const [order, setOrder] = useState<any>(null);
  // Live countdown (secs) shown on the redirect button, mirrors the auto-redirect.
  const [countdown, setCountdown] = useState<number | null>(null);

  // Live zone currency (countrySetting) always wins on this receipt page too —
  // order is only a last-resort fallback for while countrySetting hasn't
  // loaded yet.
  const { currency: fallbackCurrency, decimals: fallbackDecimals } =
    useCurrency(order);

  const checkPaymentStatus = ({
    status,
    status_code,
    transaction_status,
  }: {
    status?: string;
    status_code?: string | number;
    transaction_status?: string;
  }) => {
    if (status === "pending" || transaction_status === "pending")
      return "pending";
    if (
      status === "success" ||
      status === "PAYMENT_SUCCESS" ||
      (status_code === "200" && transaction_status === "capture")
    )
      return "success";
    return "failed";
  };
  const isWalletTransaction = ({
    type,
    order_id,
  }: {
    type?: string;
    order_id?: string;
  }) => type === "wallet" || order_id?.startsWith("wallet-");

  const isSubscriptionTransaction = ({
    type,
    order_id,
  }: {
    type?: string;
    order_id?: string;
  }) => type === "subscription" || order_id?.startsWith("subscription-");

  const extractOrderNumber = (orderId?: string | null): string | null => {
    if (!orderId) return null;
    const regex = /^order-(\d+)-\d+$/;
    const match = orderId.match(regex);
    return match ? match[1] : /^\d+$/.test(orderId) ? orderId : null;
  };

  const clearCartState = () => {
    dispatch(setCart({ data: [] }));
    dispatch(clearCartPromo());
    dispatch(setCartSubTotal({ data: 0 }));
    dispatch(setCartProducts({ data: [] }));
    dispatch(clearCheckout());
  };

  // The header cart count/total read from redux, which otherwise wasn't
  // cleared until the countdown finished or "Home" was clicked — so this
  // success receipt sat under a header still showing the pre-order cart for
  // several seconds. Clear it as soon as success is known; deleteCart() (the
  // server-side clear) still runs later in handlePaymentClose at redirect time.
  useEffect(() => {
    if (status === "success" && type === "order") clearCartState();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearCartState is a plain closure re-created each render; only status/type should re-trigger this
  }, [status, type]);

  const handlePaymentClose = async () => {
    // Order success already emptied the server cart, so deleteCart often returns
    // status 0 ("No item(s) found in users cart"). Either way the cart IS empty
    // — always reset local state so the header badge doesn't stay stuck at 1.
    try {
      await api.deleteCart();
    } catch (error) {
      console.error("Error", error);
    } finally {
      clearCartState();
      router.replace(zoneHref("/"));
    }
  };

  const handleFailedOrder = async (
    orderId: string | number | null = null,
    { redirect = true }: { redirect?: boolean } = {},
  ) => {
    if (!query || Object.keys(query).length === 0) return;
    let localOrderId: string | number | null;
    if (orderId == null) {
      localOrderId = extractOrderNumber(query.order_id);
    } else {
      localOrderId = orderId;
    }
    try {
      await api.deleteOrder({ orderId: localOrderId });
      dispatch(clearCheckout());
      // The PhonePe verify path passes redirect:false — it redirects itself to
      // the status-param URL. Other callers (buttons, countdown) still go home.
      if (redirect) router.push(zoneHref("/"));
    } catch (error) {
      console.error("Error", error);
    }
  };

  const handleWalletClose = () => {
    router.replace(zoneHref("/"));
  };

  const handleGetOrderStatusPhonepe = async (txnId) => {
    try {
      const response = await api.getOrderStatusPhonepe({
        token: phonePeData.token,
        transaction_id: phonePeData.merchantOrderId,
      });

      const remoteStatus = response?.data?.status;
      const remoteOrderId = response?.data?.order_id;
      let resolved;
      if (remoteStatus == "COMPLETED") {
        resolved = "success";
      } else if (remoteStatus == "FAILED") {
        // Delete the order but DON'T redirect from here — we redirect below
        // once with the resolved status baked into the URL.
        await handleFailedOrder(remoteOrderId, { redirect: false });
        resolved = "failed";
      } else {
        await handleFailedOrder(remoteOrderId, { redirect: false });
        resolved = "pending";
      }
      // Cache the outcome BEFORE the redirect: if this instance already
      // remounted, the cached result lets the live mount replay it.
      if (txnId) phonepeTxnResults.set(txnId, { status: resolved });
      // Transaction resolved — clear the persisted PhonePe details so a later
      // checkout can't verify against this stale merchantOrderId.
      if (resolved !== "pending") dispatch(clearPhonePeCheckoutDetails());
      // Once the API tells us the outcome, redirect to the SAME status-param URL
      // shape every other gateway uses. The remount then reads query.status via
      // checkPaymentStatus (no re-verify — cache short-circuits it anyway), so
      // PhonePe converges onto the shared status-screen path.
      const orderIdForUrl = extractOrderNumber(remoteOrderId) || remoteOrderId;
      router.replace(
        zoneHref(
          `/web-payment-status?status=${resolved}&type=order&payment_method=phonepe${
            orderIdForUrl ? `&order_id=${orderIdForUrl}` : ""
          }`,
        ),
      );
    } catch (error) {
      // Clear the "pending" marker so a remount can retry rather than hang.
      if (txnId) phonepeTxnResults.delete(txnId);
      console.log("error", error);
    }
  };

  // Auto-redirect with a live countdown. Must run AFTER `type` is resolved from
  // the query — the old empty-deps version captured type="" (initial render) in
  // the timer closure and always ran handlePaymentClose, which calls deleteCart()
  // and wiped the cart even for a WALLET recharge. Gate on `type`/`status`; give
  // SUCCESS a longer dwell so the user can read the receipt, others shorter.
  const finishRedirect = () => {
    if (type == "wallet" || type == "subscription") handleWalletClose();
    else if (status === "failed") handleFailedOrder();
    else handlePaymentClose();
  };
  useEffect(() => {
    if (!type || !status || status === "pending") return;
    const secs = status === "success" ? 8 : 4;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the redirect countdown once type/status resolve
    setCountdown(secs);
    const tick = setInterval(() => {
      setCountdown((c) => {
        // Number(null) === 0, so a null c (shouldn't happen here since setCountdown(secs)
        // just ran above) preserves the original `c <= 1` numeric-coercion behavior.
        if (Number(c) <= 1) {
          clearInterval(tick);
          finishRedirect();
          return 0;
        }
        return Number(c) - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishRedirect is a plain closure re-created each render; effect intentionally re-runs only on type/status
  }, [type, status]);

  // Fetch the placed order once we know it succeeded, to show amount/method/date
  // on the receipt. Quick and Ecom orders live in SEPARATE lists (getOrders vs
  // getEcomOrders, the latter per-item rows keyed by order_id). We AUTO-DETECT the
  // channel: try Quick first, and if that order_id isn't there, fall back to the
  // ecom list — so this works even when the status URL carries no channel hint.
  // The matched ecom row's `id` IS the order_item_id (ecom detail key).
  useEffect(() => {
    const rawId = query?.order_id;
    if (status !== "success" || type !== "order" || !rawId) return;
    const orderId = extractOrderNumber(rawId) || rawId;
    let alive = true;
    (async () => {
      try {
        // Quick first.
        const quickRes = await api.getOrders({
          limit: 1,
          offset: 0,
          orderId,
          type: "",
          orderType: "",
        });
        const quickRow = Array.isArray(quickRes?.data)
          ? quickRes.data[0]
          : quickRes?.data;
        if (quickRow) {
          if (alive) setOrder({ ...quickRow, __ecom: false });
          return;
        }
        // Not a Quick order → try the ecom list and match by order_id.
        const ecomRes = await api.getEcomOrders({
          limit: 20,
          offset: 0,
          type: "",
        });
        const ecomRows = Array.isArray(ecomRes?.data) ? ecomRes.data : [];
        const ecomRow =
          ecomRows.find((r) => String(r?.order_id) === String(orderId)) || null;
        if (alive && ecomRow) setOrder({ ...ecomRow, __ecom: true });
      } catch (e) {
        console.log("order fetch (receipt) failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, type, query?.order_id]);

  // Router `query` settles over several renders during hydration, and the page
  // can remount / StrictMode-double-mount — each re-fire called
  // order_status_phonepe again and the server logged a transaction row per call,
  // so the history showed duplicates. `phonepeTxnResults` is module-scoped so it
  // survives remounts: it fetches once per txn, caches the outcome, and replays
  // the cached status on later mounts (fixing the "Please wait" hang where the
  // resolving setStatus landed on a since-remounted instance).
  useEffect(() => {
    if (!query || Object.keys(query).length === 0) return;
    if (query?.payment_method == "phonepe") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives type/status from router query, which settles asynchronously
      setType("order");
      // After our own post-verify redirect the URL carries an explicit
      // status=success|failed|pending. Trust it directly — the outcome is
      // already known, so skip the verify entirely (also rescues a hard reload
      // on the redirected URL where redux/cache no longer hold the txn id).
      if (query?.status) {
        // query.status is a raw URL search param (string); trusted here exactly as
        // before — it's produced by our own redirect URL a few lines up in
        // handleGetOrderStatusPhonepe, which only ever writes "success" | "failed" | "pending".
        setStatus(query.status as "success" | "failed" | "pending");
        return;
      }
      // PhonePe redirects back with a FULL page reload, so the merchantOrderId
      // lives only in persisted redux — which rehydrates ASYNC, after this
      // effect's first run. The callback URL carries no transaction_id, so
      // until rehydration lands `phonePeData` is empty. Wait for it (effect
      // re-runs on `phonePeData`); firing early would call the verify with an
      // undefined id and cache a bogus result, hanging on "Please wait".
      const txnId = phonePeData?.merchantOrderId || query?.transaction_id;
      if (!txnId) return; // rehydration not done yet — keep the spinner
      const cached = phonepeTxnResults.get(txnId);
      // Already resolved on an earlier mount — replay it onto this (live)
      // instance instead of blocking, so the UI leaves "Please wait".
      if (cached && cached !== "pending") {
        setStatus(cached.status);
        return;
      }
      // In flight from an earlier mount — leave the spinner; the resolving
      // fetch will store the result and a subsequent query tick replays it.
      if (cached === "pending") return;
      phonepeTxnResults.set(txnId, "pending");
      handleGetOrderStatusPhonepe(txnId);
      return;
    }
    const paymentStatus = checkPaymentStatus(query);
    const isWallet = isWalletTransaction(query);
    const isSubscription = isSubscriptionTransaction(query);
    setType(isWallet ? "wallet" : isSubscription ? "subscription" : "order");
    setStatus(paymentStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGetOrderStatusPhonepe is a plain closure; effect intentionally re-runs only on query/phonePeData
  }, [query, phonePeData]);

  const isWalletOrSub = type == "wallet" || type == "subscription";
  const goHome = isWalletOrSub ? handleWalletClose : handlePaymentClose;
  // Human-readable order reference for the receipt chip (success only).
  const orderRef = !isWalletOrSub
    ? extractOrderNumber(query?.order_id) || query?.order_id || null
    : null;

  const prettyMethod = (m?: string | null) =>
    !m ? null : String(m).charAt(0).toUpperCase() + String(m).slice(1);

  // Live zone currency always wins (useCurrency() reads countrySetting) —
  // order?.currency is only a last-resort fallback inside the hook itself.
  const money = (v?: number | string | null) =>
    v == null || v === ""
      ? null
      : formatCurrency(v, fallbackCurrency, fallbackDecimals || 2);
  const has = (v?: number | string | null) => v != null && Number(v) !== 0;

  // Hero amount = the exact charged total.
  // When paid fully by wallet, remaining_final is 0 — show final_total instead.
  // Suppress the block entirely when the resolved amount is still 0 (null guard).
  const isWalletPayment =
    (order?.payment_method || query?.payment_method) === "wallet";
  const grandTotal = isWalletPayment
    ? (order?.final_total ?? order?.remaining_final)
    : (order?.remaining_final ?? order?.final_total);
  const heroAmount =
    grandTotal != null && Number(grandTotal) !== 0 ? money(grandTotal) : null;
  const paidVia = prettyMethod(order?.payment_method || query?.payment_method);

  // Meta rows under the hero amount (Cashfree-style receipt): order id,
  // transaction id, payment method. Each shows only when present.
  const metaRows: { label: string; value: string }[] = [
    // Prefer the human-facing `order_number` ("ORD-00345") off the fetched
    // order. It arrives a beat after the URL-derived id, so fall back to the
    // numeric ref (with a "#", which order_number carries itself) to keep the
    // row filled while the fetch is in flight or if the payload omits it.
    // Label tracks the value: "Order Number" for ORD-00345, "Order Id" for the
    // bare numeric fallback — calling ORD-00345 an "Id" reads wrong.
    (order?.order_number || orderRef) && {
      label: order?.order_number
        ? t("orderNumber") || "Order Number"
        : t("order_id") || "Order ID",
      value: order?.order_number ?? `#${orderRef}`,
    },
    has(order?.transaction_id) && {
      label: t("transaction_id") || "Transaction ID",
      value: String(order?.transaction_id),
    },
    paidVia && {
      label: t("payment_method") || "Payment Method",
      value: paidVia,
    },
  ].filter(Boolean);

  const viewOrder = () => {
    // Ecom: the fetch above tagged the row __ecom and its `id` IS the
    // order_item_id (ecom detail key). Route to the ecom detail (?type=ecommerce);
    // otherwise the Quick-order route keyed by the order id. The URL's
    // order_from/order_item_id (set at placement, before the actual order's
    // channel was known) is ONLY a fallback for when the row never loaded —
    // once `order` has actually been fetched, its real channel (whether
    // __ecom got tagged or not) is trusted over that stale URL hint, since a
    // quick-channel order can still carry order_from=ecommerce in its redirect
    // URL from an earlier step in the flow.
    if (order?.__ecom && order?.id)
      router.push(zoneHref(`/order-detail/${order.id}?type=ecommerce`));
    else if (order?.id) router.push(zoneHref(`/order-detail/${order.id}`));
    else if (query?.order_from === "ecommerce" && query?.order_item_id)
      router.push(
        zoneHref(`/order-detail/${query.order_item_id}?type=ecommerce`),
      );
    else if (orderRef) router.push(zoneHref(`/order-detail/${orderRef}`));
    else router.push(zoneHref("/profile/activeorders"));
  };

  const renderContent = () => {
    if (status == "success") {
      return (
        <StatusCard
          accent="success"
          title={
            type == "wallet"
              ? t("wallet_add_success") || "Wallet Recharged!"
              : type == "subscription"
                ? t("subscription_add_success") || "Subscribed!"
                : t("payment_success") || "Payment Success!"
          }
          subtitle={
            type == "wallet"
              ? t("wallet_add_description")
              : type == "subscription"
                ? t("subscription_add_description")
                : t("order_placed_description") ||
                  "Your Order has been successfully placed."
          }
          heroAmount={isWalletOrSub ? null : heroAmount}
          heroLabel={t("total_payment") || "Total Payment"}
          metaRows={isWalletOrSub ? [] : metaRows}
          art={
            <Lottie
              className="h-28 w-28"
              animationData={animationTwo}
              loop={false}
            />
          }
          countdown={countdown}
          onHome={goHome}
          secondary={
            !isWalletOrSub
              ? {
                  label: t("view_orders") || "View my orders",
                  onClick: viewOrder,
                }
              : undefined
          }
        />
      );
    }

    if (status == "failed") {
      return (
        <StatusCard
          accent="failed"
          title={t("payment_failed") || "Payment Failed"}
          subtitle={
            t("order_failed_sub_description") ||
            "No amount has been deducted. Please try again."
          }
          art={
            <Lottie
              className="h-24 w-24"
              animationData={animationFailed}
              loop={false}
            />
          }
          countdown={countdown}
          onHome={isWalletOrSub ? handleWalletClose : handleFailedOrder}
          secondary={
            !isWalletOrSub
              ? {
                  label: t("try_again") || "Try again",
                  onClick: () => router.push(zoneHref("/checkout")),
                }
              : undefined
          }
        />
      );
    }

    if (status == "pending") {
      return (
        <StatusCard
          accent="pending"
          title={t("payment_pending") || "Payment Pending"}
          subtitle={
            t("payment_pending_sub_description") ||
            "This can take a moment. We'll update your order once it's confirmed."
          }
          art={
            <span className="h-16 w-16 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin dark:border-amber-500/20 dark:border-t-amber-400" />
          }
          onHome={goHome}
        />
      );
    }

    // Initial resolving state — clean spinner, no blank flash.
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <span className="h-10 w-10 rounded-full border-4 border-black/10 border-t-[var(--primary-color)] animate-spin dark:border-white/10" />
        <p className="text-sm SecondaryTextColor">
          {t("please_wait") || "Please wait…"}
        </p>
      </div>
    );
  };

  return (
    <section className="relative bodyBackgroundColor flex items-start justify-center overflow-hidden px-4 pt-10 pb-16 sm:pt-14">
      {/* Full-screen celebration confetti — rains across the whole viewport on any
          success (order, wallet recharge, subscription). Non-interactive overlay,
          sits above the page background but below the receipt card. */}
      {status === "success" && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <Lottie
            className="h-full w-full"
            animationData={animationOne}
            loop
            style={{ transform: "scale(1.4)" }}
          />
        </div>
      )}
      <div className="relative z-10 w-full max-w-md">{renderContent()}</div>
    </section>
  );
};

interface StatusCardProps {
  accent: "success" | "failed" | "pending";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  heroAmount?: string | null;
  heroLabel?: string;
  metaRows?: { label: string; value: string }[];
  art: React.ReactNode;
  countdown?: number | null;
  /** Wired directly as a button's onClick, so callers may pass either a plain
   * () => void or a handler that also accepts the click event (e.g.
   * handleFailedOrder, which has other optional params callers fill in
   * explicitly elsewhere). */
  onHome: (...args: any[]) => void | Promise<void>;
  secondary?: { label: string; onClick: () => void };
}

// Cashfree-style receipt card: a small status seal, "Payment Success!" +
// thank-you line, a hero amount (Total Payment), meta rows each on its own
// dashed underline, then the redirect-countdown + share actions, and a
// scalloped (semicircle) torn bottom edge. Accent tints the seal per outcome.
const StatusCard = ({
  accent,
  title,
  subtitle,
  heroAmount,
  heroLabel,
  metaRows = [],
  art,
  countdown,
  onHome,
  secondary,
}: StatusCardProps) => {
  const seal = {
    success: "text-emerald-500",
    failed: "text-red-500",
    pending: "text-amber-500",
  }[accent];

  // Currently unused — the share button JSX below is commented out — but kept
  // typed and intact rather than deleted, since this is a typing-only pass.
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          // title is React.ReactNode at the call sites (plain strings via t()), but
          // typed loosely on StatusCardProps; cast to satisfy ShareData's `string`.
          title: title as unknown as string,
          text: `${heroLabel || ""} ${heroAmount || ""}`.trim(),
          url: window.location.href,
        });
      }
    } catch (e) {
      // user cancelled / unsupported — no-op
    }
  };

  return (
    <div className="ps-card relative rounded-[26px] bodyBackgroundColor border border-black/[0.05] dark:border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] overflow-hidden pb-3">
      {/* premium top accent — primary gradient hairline */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary-color), transparent)",
        }}
      />

      <div className="px-6 pt-7 sm:px-9 text-center">
        {/* status seal / animation with a soft radial glow behind it */}
        <div className="relative mx-auto flex items-center justify-center">
          <span
            className="pointer-events-none absolute h-24 w-24 rounded-full blur-2xl opacity-60"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--primary-color) 30%, transparent), transparent 70%)",
            }}
          />
          <div className={`relative flex items-center justify-center ${seal}`}>
            {art}
          </div>
        </div>

        <h1 className="mt-2 text-xl sm:text-2xl font-extrabold textColor tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm SecondaryTextColor">{subtitle}</p>
        )}
      </div>

      {/* hero amount — tinted panel so the total pops */}
      {heroAmount && (
        <div className="px-5 sm:px-7 pt-6">
          <div className="rounded-2xl primaryLightBack px-5 py-4 text-center">
            {heroLabel && (
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] primaryColor dark:text-white/70">
                {heroLabel}
              </p>
            )}
            <p
              className="mt-1 text-4xl sm:text-[2.6rem] font-extrabold tracking-tight tabular-nums leading-none"
              style={{ color: "var(--primary-color)" }}
            >
              {heroAmount}
            </p>
          </div>
        </div>
      )}

      {/* meta rows — clean caption/value pairs on hairline dividers */}
      {metaRows.length > 0 && (
        <div className="px-6 sm:px-9 pt-5">
          {metaRows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between gap-4 py-2.5 ${
                i !== metaRows.length - 1
                  ? "border-b border-black/[0.06] dark:border-white/[0.08]"
                  : ""
              }`}
            >
              <span className="text-[13px] SecondaryTextColor">{r.label}</span>
              <span className="text-[13px] font-bold textColor tabular-nums text-right break-all">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="px-6 sm:px-9 pt-6 flex flex-col items-stretch gap-2.5">
        <button
          onClick={onHome}
          className="w-full primaryBackColor text-white font-bold py-3 rounded-2xl transition hover:opacity-95 active:scale-[0.99] shadow-lg shadow-black/5"
        >
          {typeof countdown === "number" && countdown > 0
            ? `${t("home") || "Home"} · ${countdown}${t("seconds_short") || "s"}`
            : t("home") || "Home"}
        </button>

        {secondary && (
          <button
            onClick={secondary.onClick}
            className="w-full py-2.5 rounded-2xl font-semibold text-sm primaryColor dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition"
          >
            {secondary.label}
          </button>
        )}

        {/* {typeof navigator !== "undefined" && navigator.share && (
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold SecondaryTextColor hover:textColor transition"
          >
            <FiShare2 size={14} />
            {t("share_screenshot") || "Share receipt"}
          </button>
        )} */}
      </div>

      {/* scalloped torn bottom edge — repeating semicircles carved out of the
          card's bottom via a radial-gradient mask, like a real receipt slip. */}
      <div className="ps-scallop mt-5 h-3 bodyBackgroundColor" />

      <style jsx>{`
        .ps-card {
          animation: psCardIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes psCardIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* semicircle scallops along the bottom edge */
        .ps-scallop {
          -webkit-mask: radial-gradient(
            circle 6px at 6px 0,
            transparent 6px,
            #000 6.5px
          );
          mask: radial-gradient(
            circle 6px at 6px 0,
            transparent 6px,
            #000 6.5px
          );
          -webkit-mask-size: 12px 12px;
          mask-size: 12px 12px;
          -webkit-mask-position: bottom;
          mask-position: bottom;
          -webkit-mask-repeat: repeat-x;
          mask-repeat: repeat-x;
        }
        @media (prefers-reduced-motion: reduce) {
          .ps-card {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default PaymentStatus;
