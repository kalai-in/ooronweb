import { t } from "@/utils/translation";
import { formatCurrency } from "@/utils/helperFunction";
import React from "react";
import { LuGift, LuBadgeCheck, LuClock3 } from "react-icons/lu";
import { RiWallet3Line, RiBankCardLine, RiRefund2Line } from "react-icons/ri";

import { useSelector } from "react-redux";

const FinalCheckoutSummary = ({ orderDetail }) => {
  const setting = useSelector((state) => state.Setting.setting);
  const currency = orderDetail?.currency ?? setting?.currency;
  const decimals = orderDetail?.decimal_point ?? setting?.decimal_point ?? 2;
  const money = (val) => formatCurrency(val, currency, decimals);
  // A real split = wallet paid part AND a payment method settled a non-zero
  // residual. A full-wallet order (residual 0) is NOT a split — showing
  // "Wallet + <method> 0" reads as two payments when there was only one.
  // Quick orders carry the wallet portion as `paid_wallet`; the ecom side uses
  // `wallet_balance` (see EcomOrderDetail). This bill renders Quick orders, but
  // the fallback keeps it working against either payload shape.
  const walletPaid = Number(
    orderDetail?.paid_wallet ?? orderDetail?.wallet_balance ?? 0,
  );
  const walletUsed = walletPaid > 0;
  const residual = Number(
    orderDetail?.remaining_final || orderDetail?.final_total || 0,
  );
  const isSplit = walletUsed && residual > 0;

  // Charge lines are rendered individually below, so they must come OUT of the
  // subtotal or the bill counts them twice.
  const sumAmounts = (rows, key) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r?.[key] || 0), 0);
  const chargesTotal =
    Number(orderDetail?.delivery_charge || 0) +
    sumAmounts(orderDetail?.additional_charges, "amount") +
    sumAmounts(orderDetail?.surge_charges, "charge") +
    sumAmounts(orderDetail?.zone_additional_charges, "amount");

  // Sub Total: `total` is the order's item subtotal (charges EXCLUDED) and is
  // present on every order payload, so it is read directly rather than
  // reconstructed. Deriving it as grandTotal - chargesTotal silently went wrong
  // whenever the parts didn't reconcile exactly — a discount, a rounding step or
  // a partly-cancelled order was enough to print a subtotal the items don't add
  // up to.
  //
  // `sub_total` / `remaining_total` remain as fallbacks for payload shapes that
  // omit `total`; the derivation is the last resort, not the first choice.
  const explicitSubTotal = [
    orderDetail?.total,
    orderDetail?.sub_total,
    orderDetail?.remaining_total,
  ].find((v) => v != null && v !== "" && !Number.isNaN(Number(v)));

  // grandTotal mirrors the total row below: wallet + gateway residual.
  //
  // On a fully-refunded / cancelled order every payable field collapses to 0
  // while the wallet figure still records what was taken, so fall back to
  // subtotal + charges rather than printing a total of 0 over real line items.
  const paidTotal = walletUsed ? walletPaid + residual : residual;

  // Never render a negative subtotal: if the parts don't reconcile, fall back to
  // the derivation rather than a nonsense figure.
  const subTotal =
    explicitSubTotal != null
      ? Number(explicitSubTotal)
      : Math.max(paidTotal - chargesTotal, 0);

  const grandTotal = paidTotal > 0 ? paidTotal : subTotal + chargesTotal;
  return (
    <div className="rounded-lg border border-[var(--border-color)] p-5">
      {/* Header shows the single payment method only when the wallet did NOT
          cover part of the order. When it did, the split is shown in its own box
          below (Wallet + method), so the header would be redundant/misleading. */}
      {!isSplit && (
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--border-color)]">
          <h2 className="text-base font-semibold">{t("payment_method")}</h2>
          <span className="font-bold">{orderDetail?.payment_method}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="">
              {t("sub_total")}{" "}
              {/* The API's subtotal is already tax-inclusive (tax_amount is
                  reported separately and is not added on top), so the label says
                  so rather than leaving the reader to guess. */}
              <span className="SecondaryTextColor text-[13px]">
                ({t("incl_tax") || "Incl. Tax"})
              </span>
            </span>
            <span className="font-semibold">{money(subTotal)}</span>
          </div>

          {orderDetail?.additional_charges?.length > 0
            ? orderDetail?.additional_charges?.map((charge, index) => {
                return (
                  <div
                    className="flex justify-between items-center my-2"
                    key={index}
                  >
                    <span className="">{charge?.name || charge?.title}</span>
                    <span className="font-semibold">
                      {money(charge?.amount)}
                    </span>
                  </div>
                );
              })
            : null}
          {orderDetail?.delivery_charge != 0 && (
            <div className="flex justify-between items-center">
              <span className="">{t("delivery_charge")}</span>
              <span className="font-semibold">
                {money(orderDetail?.delivery_charge)}
              </span>
            </div>
          )}

          {/* Surge charges (e.g. Night Charges). label/charge/is_refundable. */}
          {orderDetail?.surge_charges?.map((charge, index) => (
            <div className="flex justify-between items-center" key={`surge-${index}`}>
              <span className="flex items-center gap-1.5 flex-wrap">
                {charge?.label}
                <RefundBadge refundable={charge?.is_refundable} />
              </span>
              <span className="font-semibold">{money(charge?.charge)}</span>
            </div>
          ))}

          {/* Zone additional charges (e.g. Packing/Handling). name/amount/is_refundable. */}
          {orderDetail?.zone_additional_charges?.map((charge, index) => (
            <div className="flex justify-between items-center" key={`zone-${index}`}>
              <span className="flex items-center gap-1.5 flex-wrap">
                {charge?.name}
                <RefundBadge refundable={charge?.is_refundable} />
              </span>
              <span className="font-semibold">{money(charge?.amount)}</span>
            </div>
          ))}

          {orderDetail?.promo_discount != 0 && (
            <div className="flex justify-between items-center">
              <span className="">{t("promoDiscount")}</span>
              <span className="font-semibold">
                - {money(orderDetail?.promo_discount)}
              </span>
            </div>
          )}

          {/* When the wallet paid part of the order the split is shown in its own
              box below; don't ALSO show it as a deduction line here (double count
              in the reader's eye). Without wallet split, keep it inline. */}
          {walletUsed && !isSplit && (
            <div className="flex justify-between items-center">
              <span className="">{t("walletBalance")}</span>
              <span className="font-semibold">- {money(walletPaid)}</span>
            </div>
          )}

          {/* Payment split — Wallet + the method that settled the residual. Only
              when the wallet actually covered part of the order. Rendered BEFORE
              the grand total so the total reads last. */}
          {isSplit && (
            <>
              {/* Flat split — plain rows, no nested card. */}
              <p className="text-[11px] font-semibold uppercase tracking-wide SecondaryTextColor">
                {t("payment_split") || "Payment Split"}
              </p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RiWallet3Line size={16} className="primaryColor" />
                  {t("wallet") || "Wallet"}
                </span>
                <span className="font-semibold tabular-nums">
                  {money(walletPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 capitalize">
                  <RiBankCardLine size={16} className="primaryColor" />
                  {orderDetail?.payment_method}
                </span>
                <span className="font-semibold tabular-nums">
                  {money(residual)}
                </span>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-[var(--border-color)]">
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">
                {t("total")} {t("amount")}
              </span>
              <span className="textPrimaryColor font-bold text-lg">
                {/* Total = full order amount. `residual` is only the gateway
                    portion, so whenever the wallet paid part (full OR partial)
                    the true total is wallet + residual (see grandTotal). */}
                {money(grandTotal)}
              </span>
            </div>
          </div>

          {/* Refund — a cancelled/returned order carries the amount sent back in
              `refund_amount`. Without this row a cancelled order showed the
              original charges with no sign the money was returned. Wallet-paid
              orders refund to the wallet; everything else goes to source. */}
          {Number(orderDetail?.refund_amount) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                <RiRefund2Line size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-tight text-blue-700 dark:text-blue-300">
                  {t("refund_amount") || "Refund Amount"}{" "}
                  {money(orderDetail?.refund_amount)}
                </p>
                {/* Wallet-paid orders refund to the wallet; every other method
                    goes back to the original source. */}
                <p className="mt-0.5 text-[13px] leading-snug text-blue-600/70 dark:text-blue-400/70">
                  {walletUsed
                    ? t("refund_credited_to_wallet") || "Refunded to your wallet"
                    : t("refund_processed_to_source") ||
                      "Refunded to your original payment method"}
                </p>
              </div>
            </div>
          )}

          {Number(orderDetail?.saved_amount) > 0 && (
            <div className="flex items-center justify-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-600">
              <LuBadgeCheck size={16} />
              {t("you_saved")} {money(orderDetail?.saved_amount)}
            </div>
          )}

          {orderDetail?.cashback_amount != 0 && (
            <div
              className="relative mt-1 flex items-center justify-between gap-3 overflow-hidden rounded-xl px-3.5 py-3 text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 78%, #000))",
              }}
            >
              {/* Decorative background bubbles */}
              <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
              <span className="pointer-events-none absolute right-10 -bottom-10 h-20 w-20 rounded-full bg-white/5" />
              <span className="pointer-events-none absolute -left-5 -bottom-6 h-16 w-16 rounded-full bg-white/5" />

              <div className="relative flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <LuGift size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">
                    {money(orderDetail?.cashback_amount)} {t("cashback")}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight text-white/70">
                    {Number(orderDetail?.cashback_credited) === 1 ? (
                      <>
                        <LuBadgeCheck size={12} />
                        {t("cashbackCredited")}
                      </>
                    ) : (
                      <>
                        <LuClock3 size={12} />
                        {t("cashbackPending")}
                      </>
                    )}
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Small refundable / non-refundable tag shown next to surge & zone charges.
const RefundBadge = ({ refundable }) => (
  <span
    className={`text-[11px] font-medium leading-none ${
      refundable
        ? "text-green-600 dark:text-green-400"
        : "text-gray-400 dark:text-zinc-500"
    }`}
  >
    ({refundable
      ? t("refundable") || "Refundable"
      : t("non_refundable") || "Non-refundable"})
  </span>
);

export default FinalCheckoutSummary;
