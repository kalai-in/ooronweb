"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";
import { formatCustomDate } from "@/lib/utils";
import useCurrency from "@/hooks/useCurrency";
import OrderAdressCard from "./OrderAdressCard";
import OrderItems from "./OrderItems";
import OrderStepper from "./OrderStatusStepper";
import FinalCheckoutSummary from "./FinalCheckoutSummary";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import OrderCancelModal from "../profiledashboard/orders/OrderCancelModal";
import LiveTrackingModal from "../profiledashboard/orders/LiveTrackingModal";
import { MdOutlineFileDownload } from "react-icons/md";
import { IoIosArrowRoundForward } from "react-icons/io";
import Loader from "../loader/Loader";
import DeliveryChat from "../chat/delivery/DeliveryChat";
import {
  LuPackage,
  LuCalendarDays,
  LuMapPin,
  LuReceipt,
  LuTruck,
  LuClipboardList,
  LuStore,
  LuX,
} from "react-icons/lu";

interface SectionTitleProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SectionTitle = ({ icon, children }: SectionTitleProps) => (
  <h2 className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3 font-bold text-base md:text-lg">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
      {icon}
    </span>
    {children}
  </h2>
);

const OrderDetail = () => {
  const params = useParams();
  const orderid = params?.orderid;
  // Order detail payload shape has no shared type yet — see AGENTS.md rule 4.
  const [orderDetail, setOrderDetail] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showLiveTracking, setShowLiveTracking] = useState(false);

  const handleFetchOrderDetail = async () => {
    setLoading(true);
    try {
      const response = await api.getOrders({ orderId: orderid });
      if (response?.status == 1) {
        setOrderDetail(response.data[0]);
      } else {
        console.log("Error", response);
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderid) {
      // intentional: fetches order detail when the route's orderid is known.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleFetchOrderDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderid]);

  const handleDownloadInvoice = async () => {
    try {
      const response = await api.downloadInvoice({ orderId: orderid });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement("a");
      fileLink.href = fileURL;
      fileLink.setAttribute("download", "Invoice-No:" + orderid + ".pdf");
      document.body.appendChild(fileLink);
      fileLink.click();
    } catch (error: any) {
      if (error?.request?.statusText) {
        toast.error(error.request.statusText);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error(t("something_went_wrong"));
      }
    }
  };

  // Billing data has been seen both top-level (billing_address/
  // billing_same_as_shipping) and nested under address (address.billing/
  // address.billing_same_as_shipping) — both are checked so the section
  // shows regardless of which shape a given order used.
  const billingAddress =
    orderDetail?.billing_address || orderDetail?.address?.billing;
  const billingSameAsShipping =
    orderDetail?.billing_same_as_shipping ??
    orderDetail?.address?.billing_same_as_shipping;

  // orderDetail is a PLACED order — its own currency is a historical fact and
  // wins over the viewer's current zone; useCurrency only fills in when the
  // order response omits it.
  const { currency } = useCurrency(orderDetail);
  const hasOtp =
    orderDetail?.active_status < 6 &&
    parseInt(orderDetail?.otp) !== 0 &&
    orderDetail?.otp !== null &&
    orderDetail?.otp !== undefined;

  return (
    <section className="bg-[var(--bg-color)]">
      {/* Without a title the last crumb falls back to the URL segment, which is
          the numeric id ("344"). Show the human-facing order number instead. */}
      <BreadCrumb title={orderDetail?.order_number ?? undefined} />
      <div className="container mt-4 mb-10">
        {loading && !orderDetail?.id ? (
          <Loader />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Header — clean white card. Thin primary accent bar on the leading
                edge; order identity left, action rail right. Light & airy. */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
              <span className="absolute inset-y-0 left-0 w-1 primaryBackColor" />

              <div className="flex flex-col gap-5 p-5 pl-6 md:p-6 md:pl-7 lg:flex-row lg:items-center lg:justify-between">
                {/* identity */}
                <div className="flex items-start gap-4 md:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl primaryLightBack primaryColor md:h-13 md:w-13">
                    <LuPackage size={24} />
                  </span>
                  <div className="min-w-0">
                    {/* items-end, not items-center: the identity block is now two
                        lines, and centring floated the status badge against the
                        label. Aligning on the baseline row keeps it beside the
                        order number itself. */}
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
                      {/* Label above, value below: as one run of bold text the
                          two read as a single string ("Order Number ORD-00344").
                          The number is what gets scanned and quoted, so it keeps
                          the heading weight and the label recedes to context.
                          `order_number` carries its own prefix, so the "#" is
                          added only to the bare numeric id we fall back to. */}
                      <div className="min-w-0">
                        <p className="text-xs font-medium SecondaryTextColor leading-none">
                          {t("orderNumber")}
                        </p>
                        <h1 className="mt-1 font-bold text-lg md:text-xl tracking-tight textColor">
                          {orderDetail?.order_number ?? `#${orderDetail?.id}`}
                        </h1>
                      </div>
                      {orderDetail?.order_status_name && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold primaryColor"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--primary-color) 10%, transparent)",
                          }}
                        >
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full primaryBackColor opacity-70" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full primaryBackColor" />
                          </span>
                          {orderDetail?.order_status_name}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 SecondaryTextColor">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <LuCalendarDays size={14} className="shrink-0" />
                        {formatCustomDate(orderDetail?.date)}
                      </span>
                      {orderDetail?.channel && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-current opacity-30" />
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize">
                            <LuStore size={14} className="shrink-0" />
                            {orderDetail?.channel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* action rail */}
                <div className="flex flex-wrap items-stretch gap-2.5 lg:shrink-0 lg:justify-end">
                  {hasOtp && (
                    <div className="inline-flex h-11 items-center gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)] px-3.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider SecondaryTextColor">
                        {t("otp")}
                      </span>
                      <span className="font-extrabold text-base tracking-[0.18em] primaryColor">
                        {orderDetail?.otp}
                      </span>
                    </div>
                  )}
                  {/* Both chats (delivery-boy + store) now live as Myntra-style
                      rows at the bottom of the page. */}
                  <button
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 text-sm font-semibold textColor transition hover:primaryLightBack hover:primaryColor"
                    onClick={handleDownloadInvoice}
                  >
                    <MdOutlineFileDownload size={18} /> {t("GetInvoice")}
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left */}
              <div className="flex flex-col gap-5 lg:col-span-8">
                {orderDetail?.order_note && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuClipboardList size={18} />}>
                      {t("order_note_title")}
                    </SectionTitle>
                    <div className="p-4">
                      <p className="text-sm leading-relaxed">
                        {orderDetail?.order_note}
                      </p>
                    </div>
                  </div>
                )}

                {/* Addresses — shipping always shown; billing joins as a second
                    column (only when it differs from shipping) instead of a
                    repeated full section header + card shell. */}
                {orderDetail?.address && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuMapPin size={18} />}>
                      {t("addresses") || "Addresses"}
                    </SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <div
                        className={
                          billingAddress && !billingSameAsShipping
                            ? "p-4 border-b sm:border-b-0 sm:border-r border-[var(--border-color)]"
                            : "p-4"
                        }
                      >
                        {billingAddress && !billingSameAsShipping && (
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide SecondaryTextColor">
                            {t("shippingAdress")}
                          </p>
                        )}
                        <OrderAdressCard orderDetail={orderDetail} />
                      </div>
                      {billingAddress && !billingSameAsShipping && (
                        <div className="p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide SecondaryTextColor">
                            {t("billing_address") || "Billing Address"}
                          </p>
                          <h2 className="text-sm font-bold mb-1.5">
                            {billingAddress?.name}
                          </h2>
                          <p className="text-sm SecondaryTextColor">
                            {billingAddress?.address}
                          </p>
                          <p className="mt-1.5 text-sm font-medium">
                            {t("phone")} : {billingAddress?.mobile}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                  <SectionTitle icon={<LuPackage size={18} />}>
                    {t("items")}
                  </SectionTitle>
                  <div className="p-4">
                    <OrderItems
                      products={orderDetail?.items}
                      currency={currency}
                      handleFetchOrderDetail={handleFetchOrderDetail}
                      orderIsCancellable={orderDetail?.is_cancellable}
                      orderIsReturnable={orderDetail?.is_returnable}
                      isShowProductRating={
                        !!orderDetail?.product_rating &&
                        orderDetail?.product_rating != "0"
                      }
                    />

                    {/* Order-level cancel — cancels the WHOLE order, not a
                        single item. Shown only when the backend allows it. */}
                    {orderDetail?.is_cancellable === true && (
                      <div className="mt-4 flex flex-col gap-1 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm SecondaryTextColor">
                          {t("cancel_full_order_note") ||
                            "Cancelling will cancel all items in this order."}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCancelModal(true)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DB3D26]/40 px-4 py-2 text-sm font-semibold text-[#DB3D26] transition-colors hover:bg-[#DB3D26] hover:text-white"
                        >
                          <LuX size={16} />
                          {t("cancel_order") || t("cancel")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Help — Myntra-style rows. When BOTH the delivery-partner chat
                    and the store chat show, they sit side-by-side in one row;
                    otherwise the single chat spans full width. */}
                {orderid && (
                  <div
                    className={
                      orderDetail?.is_delivery_boy_chat_visible === true
                        ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
                        : ""
                    }
                  >
                    {orderDetail?.is_delivery_boy_chat_visible === true && (
                      <DeliveryChat
                        orderId={Array.isArray(orderid) ? orderid[0] : orderid}
                        orderItemId={undefined}
                        orderStatus={orderDetail?.active_status}
                        deliveryBoy={undefined}
                        variant="row"
                        label={undefined}
                        subtitle={undefined}
                      />
                    )}
                    <DeliveryChat
                      orderId={Array.isArray(orderid) ? orderid[0] : orderid}
                      orderItemId={undefined}
                      orderStatus={orderDetail?.active_status}
                      deliveryBoy={undefined}
                      mode="orderAdmin"
                      variant="row"
                      label={undefined}
                      subtitle={undefined}
                    />
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="flex flex-col gap-5 lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
                {orderDetail?.timeline?.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuTruck size={18} />}>
                      {t("track_order")}
                    </SectionTitle>
                    <div className="p-4">
                      <OrderStepper orderDetail={orderDetail} />
                      {/* Shown for every status except cancelled/returned —
                          live tracking now also covers the pre-assignment
                          "preparing" phase (store location), not just
                          out-for-delivery, and stays available after delivery
                          too. 7 = cancelled, 8 = returned, 12/13 =
                          refund-completed (part of the return flow). */}
                      {![7, 8, 12, 13].includes(
                        Number(orderDetail?.active_status),
                      ) && (
                        <button
                          type="button"
                          onClick={() => setShowLiveTracking(true)}
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--primary-color) 10%, transparent)",
                          }}
                          className="mt-4 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--primary-color)] px-3 py-2.5 text-sm font-semibold textPrimaryColor"
                        >
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full primaryBackColor opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full primaryBackColor" />
                          </span>
                          <LuTruck size={15} className="shrink-0" />
                          {t("track_order")}
                          <IoIosArrowRoundForward
                            size={18}
                            className="shrink-0"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                  <SectionTitle icon={<LuReceipt size={18} />}>
                    {t("billing_details")}
                  </SectionTitle>
                  <div className="p-4">
                    <FinalCheckoutSummary orderDetail={orderDetail} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <OrderCancelModal
        open={showCancelModal}
        setOpen={setShowCancelModal}
        order={orderDetail}
        onCancelled={handleFetchOrderDetail}
      />
      <LiveTrackingModal
        showLiveTracking={showLiveTracking}
        setShowLiveTracking={setShowLiveTracking}
        order={orderDetail}
      />
    </section>
  );
};

export default OrderDetail;
