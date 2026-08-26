import { t } from "@/utils/translation";
import { formatCustomDate } from "@/lib/utils";
import { useSelector } from "react-redux";
import Link from "next/link";
import ImageWithPlaceholder from "@/components/image-with-placeholder/ImageWithPlaceholder";
import ReoderConfirmModal from "./ReoderConfirmModal";
import OrderCancelModal from "./OrderCancelModal";
import { useState } from "react";
import {
  LuPackage,
  LuCalendarClock,
  LuChevronDown,
  LuEye,
  LuRotateCcw,
  LuWallet,
  LuX,
  LuDownload,
} from "react-icons/lu";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import useZoneHref from "@/hooks/useZoneHref";

const STATUS_MAP = {
  1: { label: "paymentPending", cls: "paymentPendingStatus" },
  2: { label: "order_status_display_name_recieved", cls: "orderRecieved" },
  3: { label: "processed", cls: "orderProcessed" },
  4: { label: "order_status_display_name_shipped", cls: "orderShipped" },
  5: { label: "out_for_delivery", cls: "orderOutForDelivery" },
  6: { label: "order_status_display_name_delivered", cls: "orderDelivered" },
  7: { label: "cancelled", cls: "orderCancelled" },
  8: { label: "returned", cls: "orderReturned" },
  9: { label: "order_in_process", cls: "orderInProcess" },
  10: { label: "ready_to_pickup", cls: "orderReadyToPickup" },
};

// "Color: white, Size: m" from variant_attributes
const formatAttributes = (attrs) =>
  Array.isArray(attrs)
    ? attrs.map((a) => `${a?.name}: ${a?.value}`).join(", ")
    : "";

const PrevOrderCard = ({ order, onCancelled, channel, shopMode, availableModes }) => {
  const zoneHref = useZoneHref();
  const setting = useSelector((state) => state.Setting);
  const [showReoderModal, setShowReorderModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Show Reorder when:
  //   - Only one mode is available (no comparison needed), OR
  //   - Header mode matches the page tab channel
  //     (quick ↔ quick, allShop ↔ ecommerce)
  const headerMatchesTab =
    (shopMode === "quick" && channel === "quick") ||
    (shopMode === "allShop" && channel === "ecommerce");
  const showReorder = availableModes !== "both" || headerMatchesTab;

  // Fetch the invoice PDF as a blob and trigger a browser download.
  const handleDownloadInvoice = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await api.downloadInvoice({ orderId: order?.id });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement("a");
      fileLink.href = fileURL;
      fileLink.setAttribute("download", `Invoice-No:${order?.id}.pdf`);
      document.body.appendChild(fileLink);
      fileLink.click();
      fileLink.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      toast.error(
        error?.request?.statusText ||
          error?.message ||
          t("something_went_wrong"),
      );
    } finally {
      setDownloading(false);
    }
  };

  const canCancel = order?.is_cancellable === true;

  const currency = order?.currency || setting?.setting?.currency || "";
  const items = order?.items || [];
  const itemCount = items.length;
  const payment = order?.payment_method || order?.payment_type;
  // final_total is only what the payment method settled; a wallet / partial-
  // wallet order excludes the wallet portion, so it shows ₹0 / too low. Real
  // total = wallet + method residual.
  // Quick orders carry the wallet portion as `paid_wallet`; the ecom side uses
  // `wallet_balance` (see EcomOrdersCard). This card is Quick-only, but the
  // fallback keeps it working against either payload shape.
  const walletPaid = Number(order?.paid_wallet ?? order?.wallet_balance ?? 0);
  const walletUsed = walletPaid > 0;
  const displayTotal = walletUsed
    ? walletPaid + Number(order?.final_total || 0)
    : order?.final_total;
  // Split order shows both methods ("Wallet + Razorpay") so the wallet portion
  // isn't hidden; full-wallet shows just the method.
  const gatewayResidual = Number(order?.final_total || 0);
  const paymentLabel =
    walletUsed && gatewayResidual > 0 && payment
      ? `${t("wallet") || "Wallet"} + ${payment}`
      : payment;

  const status = STATUS_MAP[order?.active_status] || {
    label: order?.order_status_name || "returned",
    cls: "orderReturned",
  };

  const price = (v) => `${currency}${v}`;

  return (
    <div className="px-4 py-2">
      <div className="flex w-full flex-col overflow-hidden rounded-lg border border-[var(--border-color)] shadow-sm">
        {/* Top: status + date */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <span
            className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.cls}`}
            style={{
              border: "none",
              backgroundColor:
                "color-mix(in srgb, currentColor 12%, transparent)",
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span className="truncate">
              {order?.order_status_name || t(status.label)}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] SecondaryTextColor">
              <LuCalendarClock size={13} />
              {formatCustomDate(order?.date)}
            </span>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={downloading}
              className="flex h-7 w-7 items-center justify-center rounded-full textPrimaryColor transition disabled:opacity-50"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--primary-color) 12%, transparent)",
              }}
              title={t("download_invoice") || t("GetInvoice") || "Download Invoice"}
            >
              <LuDownload size={14} />
            </button>
          </div>
        </div>

        {/* Order id */}
        <div className="px-4 pt-1">
          <p className="font-bold text-base">
            {t("order")} {order?.order_number ?? `#${order?.id}`}
          </p>
        </div>

        {/* Thumbnail + summary */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-center gap-3 px-4 text-left"
        >
          <div className="relative aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-white">
            {items[0]?.image_url ? (
              <ImageWithPlaceholder
                src={items[0]?.image_url}
                alt={items[0]?.name || "product"}
                fill
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center SecondaryTextColor">
                <LuPackage size={18} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-grow">
            <p className="truncate font-semibold text-sm">{items[0]?.name}</p>
            <p className="truncate text-xs SecondaryTextColor">
              {itemCount > 1
                ? `+${itemCount - 1} ${t("moteItems") || "more items"}`
                : formatAttributes(items[0]?.variant_attributes)}
            </p>
          </div>
          <p className="shrink-0 font-bold text-sm whitespace-nowrap">
            {price(
              items[0]?.discounted_price != 0
                ? items[0]?.discounted_price
                : items[0]?.price
            )}
          </p>
          {itemCount > 1 && (
            <LuChevronDown
              size={18}
              className={`shrink-0 SecondaryTextColor transition-transform duration-300 ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {/* Expanded items — grid-rows trick animates height smoothly */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className="mt-2 flex flex-col divide-y divide-dashed divide-[var(--border-color)] px-4">
              {items.map((it, i) => {
                const disc = it?.discounted_price != 0;
                const unit = disc ? it?.discounted_price : it?.price;
                const qty = it?.quantity || it?.qty || 1;
                const attrs = formatAttributes(it?.variant_attributes);
                return (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 text-sm py-2"
                  >
                    <div className="min-w-0 flex-grow">
                      <p className="truncate">
                        {it?.name}{" "}
                        <span className="SecondaryTextColor">× {qty}</span>
                      </p>
                      {attrs && (
                        <p className="truncate text-xs SecondaryTextColor">
                          {attrs}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold whitespace-nowrap">
                      {price(unit * qty)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Total + payment */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-[var(--border-color)] px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-xs SecondaryTextColor">
              {t("total")}
            </span>
            <span className="truncate font-bold text-lg">
              {price(displayTotal)}
            </span>
          </div>
          {payment && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium uppercase SecondaryTextColor">
              <LuWallet size={14} />
              {paymentLabel}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: showReorder ? "1fr 1fr" : "1fr" }}>
            {showReorder && (
              <button
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                onClick={() => setShowReorderModal(true)}
              >
                <LuRotateCcw size={15} className="shrink-0" />
                {t("reorder")}
              </button>
            )}
            <Link
              href={zoneHref(`/order-detail/${order?.id}`)}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl primaryBackColor px-3 py-2.5 text-sm font-semibold text-white"
            >
              <LuEye size={15} className="shrink-0" />
              {t("view_details")}
            </Link>
          </div>
          {canCancel && (
            <button
              className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#DB3D26]/40 py-1.5 text-xs font-semibold text-[#DB3D26] transition-colors hover:bg-[#DB3D26] hover:text-white"
              onClick={() => setShowCancelModal(true)}
            >
              <LuX size={13} className="shrink-0" />
              {t("cancel")}
            </button>
          )}
        </div>
      </div>

      <ReoderConfirmModal
        showReoderModal={showReoderModal}
        setShowReorderModal={setShowReorderModal}
        order={order}
        orderChannel="quick"
      />
      <OrderCancelModal
        open={showCancelModal}
        setOpen={setShowCancelModal}
        order={order}
        onCancelled={onCancelled}
      />
    </div>
  );
};

export default PrevOrderCard;
