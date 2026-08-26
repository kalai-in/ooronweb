import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { MdOutlineStar, MdStar, MdOutlineFileDownload } from "react-icons/md";
import * as api from "@/api/apiRoutes";
import OrderStepper from "./OrderStatusStepper";
import RatingUpdateModal from "./RatingUpdateModal";
import CancelReasonModal from "./CancelReasonModal";
import ReturnReasonModal from "./ReturnReasonModal";
import LiveTrackingModal from "../profiledashboard/orders/LiveTrackingModal";
import DeliveryChat from "../chat/delivery/DeliveryChat";
import { IoIosArrowRoundForward } from "react-icons/io";
import { TbTruckReturn } from "react-icons/tb";
import { RiFileTextLine, RiWallet3Line, RiBankCardLine } from "react-icons/ri";
import LightBox from "@/components/ui/LightBox";
import { t } from "@/utils/translation";
import { formatCustomDate } from "@/lib/utils";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import Loader from "../loader/Loader";
import NotFound from "../notfound/NotFound";
import OrderNotFoundImage from "@/assets/not_found_images/No_Orders.svg";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import {
  LuPackage,
  LuCalendarDays,
  LuMapPin,
  LuReceipt,
  LuGift,
  LuBadgeCheck,
  LuClock3,
  LuX,
  LuCircleX,
  LuTruck,
  LuStore,
  LuPhone,
  LuLayers,
  LuExternalLink,
} from "react-icons/lu";
import useZoneHref from "@/hooks/useZoneHref";

// Same status → class map as the Quick Order detail page.
const STATUS_CLS = {
  1: "paymentPendingStatus",
  2: "orderRecieved",
  3: "orderProcessed",
  4: "orderShipped",
  5: "orderOutForDelivery",
  6: "orderDelivered",
  7: "orderCancelled",
  8: "orderReturned",
  9: "orderInProcess",
  10: "orderReadyToPickup",
};

const SectionTitle = ({ icon, children }) => (
  <h2 className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3 font-bold text-base md:text-lg">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
      {icon}
    </span>
    {children}
  </h2>
);

const formatAttributes = (attrs) =>
  Array.isArray(attrs)
    ? attrs.map((a) => `${a?.name}: ${a?.value}`).join(", ")
    : "";

// Flipkart-style inline star rating. No rating yet → 5 grey stars (click any to
// instant-submit that score). Has rating → filled stars up to `value`, read-only.
const StarRating = ({
  value = 0,
  editable = false,
  onRate,
  disabled = false,
}) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover || value) >= star;
        const Icon = filled ? MdStar : MdOutlineStar;
        return (
          <button
            key={star}
            type="button"
            disabled={!editable || disabled}
            onClick={() => editable && !disabled && onRate?.(star)}
            onMouseEnter={() => editable && setHover(star)}
            onMouseLeave={() => editable && setHover(0)}
            aria-label={`${star} ${t("star") || "star"}`}
            className={`${editable && !disabled ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
          >
            <Icon
              size={26}
              className={
                filled ? "text-[#DB9305]" : "text-gray-300 dark:text-zinc-600"
              }
            />
          </button>
        );
      })}
    </div>
  );
};

// E-commerce order detail. Distinct from Quick Order's OrderDetail because the
// ecom_orders response is a single per-order-item row (no items[]/status[]; has
// nested address object). Driven by order_item_id from the route. API logic kept separate.
const EcomOrderDetail = () => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  // Shares the /order-detail/[orderid] route with Quick Orders; here `orderid`
  // carries the order_item_id (ecom detail key).
  const orderItemId = router.query?.orderid;
  const user = useSelector((state) => state.User.user);
  const [orderDetail, setOrderDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [showUpdateRating, setShowUpdateRating] = useState(false);
  const [ratingId, setRatingId] = useState(null);
  // true while the instant-rate API call is in flight (disables the stars).
  const [rating, setRating] = useState(false);
  // Cancel/Return modals share the Quick-flow modals; they read order_id + id
  // (the order_item_id) off the passed row, which the ecom detail row carries.
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  // Prescription lightbox — holds the image url currently previewed.
  const [prescriptionImg, setPrescriptionImg] = useState(null);

  // View an uploaded prescription: images open in the lightbox, PDFs in a new tab.
  const handleViewPrescription = (url) => {
    if (!url) return;
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(url))
      setPrescriptionImg(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  // This user's existing rating for the item (handles both response shapes:
  // rating.user.id and rating.user_id).
  const findUserRating = (product) =>
    product?.item_rating?.find(
      (r) => r?.user?.id == user?.id || r?.user_id == user?.id,
    );

  // Instant star rating: submit just the score (empty review). If a rating
  // already exists, rating/add rejects it ("product id has already been taken"),
  // so call rating/update with its id instead.
  const handleInstantRate = async (product, star) => {
    const productId = product?.product_id ?? product?.id;
    setRating(true);
    try {
      const existing = findUserRating(product);
      let response;
      if (existing?.id) {
        response = await api.updateReviewProduct({
          ratingId: existing.id,
          rating: star,
          review: existing?.review || "",
          deleteImages: "",
          images: [],
        });
      } else {
        response = await api.reviewProduct({
          productId,
          rating: star,
          review: "",
          images: [],
        });
      }
      if (response?.status == 1) {
        await handleFetchOrderDetail();
      } else {
        toast.error(response?.message);
      }
    } catch (error) {
      console.log("Error", error);
    } finally {
      setRating(false);
    }
  };

  const handleShowUpdateRating = (product) => {
    setRatingId(findUserRating(product)?.id);
    setShowUpdateRating(true);
  };

  const handleFetchOrderDetail = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const response = await api.getEcomOrderDetail({ orderItemId });
      if (response?.status == 1 && response?.data?.length > 0) {
        setOrderDetail(response.data[0]);
      } else {
        setOrderDetail(null);
      }
    } catch (error) {
      console.log("Error", error);
      setIsError(true);
      setOrderDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderItemId) {
      handleFetchOrderDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderItemId]);

  // Per-item invoice download (ecom orders are per order_item).
  const handleDownloadInvoice = async () => {
    try {
      const response = await api.downloadItemInvoice({ orderItemId });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement("a");
      fileLink.href = fileURL;
      fileLink.setAttribute("download", `Invoice-${orderItemId}.pdf`);
      document.body.appendChild(fileLink);
      fileLink.click();
      fileLink.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      if (error?.request?.statusText) {
        toast.error(error.request.statusText);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error(t("something_went_wrong"));
      }
    }
  };

  const currency = orderDetail?.currency || "";
  const price = (v) => `${currency}${v}`;
  const statusCls = STATUS_CLS[orderDetail?.active_status] || "orderProcessed";
  // Real split = wallet paid part AND a payment method settled a non-zero
  // residual. A full-wallet order (final_total 0) is NOT a split — showing
  // "Wallet + <method> 0" reads as two payments when there was only one.
  const walletUsed = Number(orderDetail?.wallet_balance) > 0;
  const gatewayResidual = Number(orderDetail?.final_total || 0);
  const isSplit = walletUsed && gatewayResidual > 0;

  const disc = orderDetail?.discounted_price != 0;
  const unit = disc ? orderDetail?.discounted_price : orderDetail?.price;
  const qty = orderDetail?.quantity || 1;
  const additionalCharges = Array.isArray(orderDetail?.additional_charges)
    ? orderDetail.additional_charges
    : [];
  const otherItems = Array.isArray(orderDetail?.other_items)
    ? orderDetail.other_items
    : [];
  const timeline = Array.isArray(orderDetail?.timeline)
    ? orderDetail.timeline
    : [];

  // Courier tracking (present once a shipment is dispatched). Show the card only
  // when at least the agency or a tracking id exists.
  const courierAgency = orderDetail?.courier_agency || "";
  const trackingId = orderDetail?.tracking_id || "";
  const trackingUrl = orderDetail?.tracking_url || "";
  const hasTracking = Boolean(courierAgency || trackingId || trackingUrl);

  // Delivery partner (present once a delivery boy is assigned to the order).
  const deliveryBoyName = orderDetail?.delivery_boy_name || "";
  const deliveryBoyMobile = orderDetail?.delivery_boy_mobile || "";

  // Action gates. Backend exposes booleans on the ecom row; return is blocked
  // once a return is already in flight (return_requested set).
  const canCancel = orderDetail?.is_cancellable === true;
  const canReturn =
    orderDetail?.is_returnable === true &&
    orderDetail?.return_requested === null;
  const returnDays = Number(orderDetail?.return_days) || 0;
  const isCancelled = Number(orderDetail?.active_status) === 7;
  const returnReq = Number(orderDetail?.return_requested);

  // Map an in-flight return state to its label + colour. Mirrors the Quick-flow
  // OrderItems badges. null when no return request / unknown state.
  const RETURN_BADGE = {
    1: { label: "return_requested", cls: "text-[#DB9305]" },
    3: { label: "return_rejected", cls: "text-red-500" },
    4: { label: "delivery_boy_assinged", cls: "text-[#0DCaf0]" },
    5: { label: "deliver_boy_out_for_pickup", cls: "text-[#0d6efd]" },
    6: { label: "item_received_from_customer", cls: "text-[#6C757D]" },
    7: {
      label: "return_request_cancel_by_delivery_boy",
      cls: "text-[#DB3D26]",
    },
    8: { label: "item_returned_to_seller", cls: "textColor" },
  };
  const returnBadge = RETURN_BADGE[returnReq] || null;

  return (
    <section className="bg-[var(--bg-color)]">
      <BreadCrumb
        // Bare number, no "Order Number" label: the crumb sits under a heading
        // that already says it, and the label crowded the trail. Falls through
        // to the URL segment when the payload carries no order_number.
        title={orderDetail?.order_number ?? undefined}
      />
      <div className="container mt-4 mb-10">
        {loading ? (
          <Loader />
        ) : isError ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 p-10 text-center">
            <p className="font-semibold text-base">
              {t("something_went_wrong")}
            </p>
            <button
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
              onClick={handleFetchOrderDetail}
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : !orderDetail ? (
          <NotFound image={OrderNotFoundImage} title={t("no_order")} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
              <div className="flex flex-col gap-5 p-4 md:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3.5 md:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl primaryBackColor text-white shadow-md md:h-14 md:w-14">
                    <LuPackage size={26} />
                  </span>
                  <div className="min-w-0">
                    {/* items-end, not items-center: the identity block is two
                        lines now, and centring floated the status badge against
                        the label instead of the order number. */}
                    <div className="flex flex-wrap items-end gap-x-2.5 gap-y-2">
                      {/* Muted label above, bold value below — run together on
                          one line the two read as a single string. Matches the
                          Quick order detail header. */}
                      <div className="min-w-0">
                        <p className="text-xs font-medium SecondaryTextColor leading-none">
                          {t("orderNumber")}
                        </p>
                        <h1 className="mt-1 font-bold text-lg md:text-xl">
                          {orderDetail?.order_number ??
                            `#${orderDetail?.order_id}`}
                        </h1>
                      </div>
                      {orderDetail?.order_item_status && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls}`}
                          style={{
                            border: "none",
                            backgroundColor:
                              "color-mix(in srgb, currentColor 12%, transparent)",
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {orderDetail?.order_item_status}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
                      <span className="inline-flex items-center gap-1.5 text-sm SecondaryTextColor">
                        <LuCalendarDays size={14} />
                        {formatCustomDate(orderDetail?.date)}
                      </span>
                      {orderDetail?.store_name && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] px-2.5 py-1 text-xs font-medium SecondaryTextColor">
                          <LuStore size={13} />
                          {orderDetail?.store_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header actions — invoice only. (Chat now lives as Myntra-style
                    rows at the bottom of the page.) */}
                <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 primaryBorderColor primaryColor px-4 py-2 text-sm font-semibold transition-colors hover:primaryBackColor hover:text-white"
                  >
                    <MdOutlineFileDownload size={20} />
                    {t("GetInvoice")}
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left */}
              <div className="flex flex-col gap-5 lg:col-span-8">
                {/* Delivery address */}
                {orderDetail?.address?.address && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuMapPin size={18} />}>
                      {t("shippingAdress")}
                    </SectionTitle>
                    <div className="p-4">
                      {orderDetail?.address?.name && (
                        <p className="mb-1.5 text-sm font-bold">
                          {orderDetail?.address?.name}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed">
                        {orderDetail?.address?.address}
                      </p>
                      {orderDetail?.address?.mobile && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm SecondaryTextColor">
                          <LuPhone size={14} />
                          {orderDetail?.address?.mobile}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery partner — shown once a delivery boy is assigned */}
                {deliveryBoyName && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuTruck size={18} />}>
                      {t("delivery_partner_details")}
                    </SectionTitle>
                    <div className="flex items-center gap-3.5 p-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor text-lg font-bold uppercase">
                        {deliveryBoyName.charAt(0) || "?"}
                      </span>
                      <div className="min-w-0 flex-grow">
                        <p className="text-sm sm:text-base font-bold textColor leading-snug">
                          {`${t("im")} ${deliveryBoyName}, ${t("your_delivery_partner")}`}
                        </p>
                        <p className="mt-0.5 text-xs SecondaryTextColor leading-relaxed">
                          {t("delivery_partner_hint_ecom")}
                        </p>
                      </div>
                      {deliveryBoyMobile && (
                        <a
                          href={`tel:${deliveryBoyMobile}`}
                          aria-label={t("call")}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border primaryColorBorder primaryColor transition hover:primaryBackColor hover:text-white active:scale-95"
                        >
                          <LuPhone size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Courier tracking */}
                {hasTracking && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuTruck size={18} />}>
                      {t("track_order")}
                    </SectionTitle>
                    <div className="p-4">
                      <div className="flex flex-col gap-2 mb-3">
                        {courierAgency && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs SecondaryTextColor">
                              {t("courier_agency")}:
                            </span>
                            <span className="text-sm font-semibold">
                              {courierAgency}
                            </span>
                          </div>
                        )}
                        {trackingId && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs SecondaryTextColor">
                              {t("tracking_id")}:
                            </span>
                            <span className="text-sm font-semibold tracking-wide break-all">
                              {trackingId}
                            </span>
                          </div>
                        )}
                      </div>
                      {trackingUrl && (
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit items-center gap-2 rounded-lg primaryBackColor px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          <LuExternalLink size={16} />
                          {t("track_shipment")}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* This item */}
                <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                  <SectionTitle icon={<LuPackage size={18} />}>
                    {t("items")}
                  </SectionTitle>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-white">
                        {orderDetail?.image ? (
                          <ImageWithPlaceholder
                            src={orderDetail?.image}
                            alt={orderDetail?.product_name || "product"}
                            fill
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center SecondaryTextColor">
                            <LuPackage size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="font-semibold text-sm">
                          {orderDetail?.product_name || orderDetail?.name}
                        </p>
                        <p className="text-xs SecondaryTextColor">
                          {formatAttributes(orderDetail?.variant_attributes)}
                        </p>
                        <p className="mt-1 text-xs SecondaryTextColor">
                          {t("quantity") || "Qty"}: {qty}
                        </p>
                        {/* uploaded prescription — bordered chip (image → lightbox, pdf → tab) */}
                        {orderDetail?.prescription_url && (
                          <button
                            type="button"
                            onClick={() =>
                              handleViewPrescription(
                                orderDetail.prescription_url,
                              )
                            }
                            className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-lg border primaryColorBorder px-3 py-1.5 text-xs font-semibold primaryColor transition-colors hover:primaryLightBack"
                          >
                            <RiFileTextLine size={15} className="shrink-0" />
                            {t("view_prescription") || "View prescription"}
                          </button>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold whitespace-nowrap">
                        {price(unit * qty)}
                      </span>
                    </div>

                    {/* Rating + Cancel/Return live in ONE row: review on the
                        left, action buttons on the right (wraps on narrow). */}
                    {(() => {
                      const showRating =
                        Number(orderDetail?.active_status) === 6 &&
                        Number(orderDetail?.product_rating) !== 0 &&
                        orderDetail?.return_requested === null;
                      const showActions = canCancel || canReturn || isCancelled;
                      if (!showRating && !showActions) return null;
                      const userRating = findUserRating(orderDetail);
                      return (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] pt-4">
                          {/* left: rating */}
                          {showRating ? (
                            <div className="flex flex-col gap-1">
                              {userRating ? (
                                <>
                                  <StarRating
                                    value={Number(userRating?.rate) || 0}
                                  />
                                  <button
                                    className="text-left text-sm font-medium text-[#55AE7B] hover:underline"
                                    onClick={() =>
                                      handleShowUpdateRating(orderDetail)
                                    }
                                  >
                                    {userRating?.review
                                      ? t("view_review") || "View Review"
                                      : t("write_a_review") || "Write a Review"}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <StarRating
                                    editable
                                    disabled={rating}
                                    onRate={(star) =>
                                      handleInstantRate(orderDetail, star)
                                    }
                                  />
                                  <span className="text-sm SecondaryTextColor">
                                    {t("rate_this_product_now") ||
                                      "Rate this product now"}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span />
                          )}

                          {/* right: cancel / return actions — chip on top,
                              buttons below (column) */}
                          {showActions && (
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex flex-wrap items-center gap-3">
                                {canCancel && (
                                  <button
                                    type="button"
                                    onClick={() => setShowCancelModal(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DB3D26]/40 px-4 py-2 text-sm font-semibold text-[#DB3D26] transition-colors hover:bg-[#DB3D26] hover:text-white"
                                  >
                                    <LuX size={16} />
                                    {t("cancel")}
                                  </button>
                                )}
                                {canReturn && (
                                  <button
                                    type="button"
                                    onClick={() => setShowReturnModal(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DB3D26]/40 px-4 py-2 text-sm font-semibold text-[#DB3D26] transition-colors hover:bg-[#DB3D26] hover:text-white"
                                  >
                                    <TbTruckReturn size={16} />
                                    {t("return")}
                                  </button>
                                )}
                                {isCancelled && (
                                  <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-color)] px-4 py-2.5 text-sm font-semibold SecondaryTextColor">
                                    {t("cancelled")}
                                  </span>
                                )}
                              </div>
                              {canReturn && returnDays > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-color)] px-3 py-2 text-xs font-medium SecondaryTextColor">
                                  <TbTruckReturn size={14} />
                                  {t("returnable")} {returnDays} {t("days")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Return rejected (3): dedicated red alert card with the
                        reason. Replaces the plain badge for this state. */}
                    {returnReq === 3 ? (
                      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 dark:border-red-500/25 dark:bg-red-500/10">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                          <LuCircleX size={20} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                            {t("return_rejected")}
                          </p>
                          {(orderDetail?.return_reject_reason ||
                            orderDetail?.return_remarks) && (
                            <p className="mt-0.5 text-sm leading-relaxed text-red-600/90 dark:text-red-300/90">
                              {orderDetail?.return_reject_reason ||
                                orderDetail?.return_remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      returnBadge &&
                      returnReq !== 8 && (
                        <p
                          className={`mt-4 border-t border-[var(--border-color)] pt-4 text-sm font-medium ${returnBadge.cls}`}
                        >
                          {t(returnBadge.label)}
                        </p>
                      )
                    )}

                    {returnReq === 7 && orderDetail?.cancellation_reason && (
                      <p className="mt-2 text-xs SecondaryTextColor">
                        {orderDetail?.cancellation_reason}
                      </p>
                    )}

                    {/* Refund callout once returned — premium green success card:
                        emerald gradient, accent bar, slow shine, badged amount. */}
                    {Number(orderDetail?.active_status) === 8 &&
                      orderDetail?.refund_amount != null && (
                        <div className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-4 py-3.5 dark:border-emerald-500/25 dark:from-emerald-500/10 dark:via-green-500/10 dark:to-teal-500/10">
                          {/* slow shine sweep */}
                          <span className="savings-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
                          {/* left accent bar */}
                          <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
                          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-4 ring-emerald-500/5 dark:text-emerald-400">
                            <LuBadgeCheck size={22} />
                          </span>
                          <div className="relative min-w-0 flex-grow">
                            <p className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 leading-tight">
                              {t("refund_completed") || t("refunded")}
                            </p>
                            <p className="mt-0.5 text-[11px] text-emerald-700/70 dark:text-emerald-400/70 leading-snug">
                              {/* COD has no source to refund to → credited to the
                                  wallet. Online methods refund to the source. */}
                              {/cod|cash/i.test(
                                orderDetail?.payment_method || "",
                              )
                                ? t("refund_credited_to_wallet") ||
                                  "Amount credited to your wallet"
                                : t("refund_processed_to_source") ||
                                  "Amount refunded to your original payment method"}
                            </p>
                          </div>
                          <div className="relative shrink-0 text-right">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/60">
                              {t("refunded")}
                            </p>
                            <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 leading-tight">
                              {price(orderDetail?.refund_amount)}
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Other items in same order */}
                {otherItems.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuLayers size={18} />}>
                      {t("moteItems") || "Other items in this order"}
                    </SectionTitle>
                    <div className="flex flex-col divide-y divide-[var(--border-color)]">
                      {otherItems.map((it) => (
                        <a
                          key={it?.order_item_id}
                          href={zoneHref(
                            `/order-detail/${it?.order_item_id}?type=ecommerce`,
                          )}
                          className="flex items-center gap-3 p-4 transition-colors hover:bg-black/5"
                        >
                          <div className="relative aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-white">
                            {it?.image ? (
                              <ImageWithPlaceholder
                                src={it?.image}
                                alt={it?.product_name || "product"}
                                fill
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center SecondaryTextColor">
                                <LuPackage size={16} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-grow">
                            <p className="truncate font-medium text-sm">
                              {it?.product_name}
                            </p>
                            <p className="text-xs SecondaryTextColor">
                              {it?.status_name} · {t("quantity") || "Qty"}:{" "}
                              {it?.quantity}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold whitespace-nowrap">
                            {price(it?.final_total)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Help — Myntra-style rows (same as Quick order detail). When
                    BOTH the delivery-partner and store chats show they sit
                    side-by-side; otherwise the single chat spans full width. */}
                {orderDetail?.order_id && (
                  <div
                    className={
                      orderDetail?.is_delivery_boy_chat_visible === true
                        ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
                        : ""
                    }
                  >
                    {orderDetail?.is_delivery_boy_chat_visible === true && (
                      <DeliveryChat
                        orderId={orderDetail?.order_id}
                        orderItemId={orderDetail?.id ?? orderItemId}
                        orderStatus={orderDetail?.active_status}
                        deliveryBoy={{
                          id: orderDetail?.delivery_boy_id,
                          name: orderDetail?.delivery_boy_name,
                          phone: orderDetail?.delivery_boy_mobile,
                        }}
                        variant="row"
                      />
                    )}
                    <DeliveryChat
                      orderId={orderDetail?.order_id}
                      orderStatus={orderDetail?.active_status}
                      mode="orderAdmin"
                      variant="row"
                    />
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="flex flex-col gap-5 lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
                {/* Timeline */}
                {timeline.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                    <SectionTitle icon={<LuTruck size={18} />}>
                      {t("track_order")}
                    </SectionTitle>
                    <div className="p-4">
                      <OrderStepper orderDetail={orderDetail} />
                      {/* {Number(orderDetail?.active_status) === 5 && (
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
                          <IoIosArrowRoundForward size={18} className="shrink-0" />
                        </button>
                      )} */}
                    </div>
                  </div>
                )}

                {/* Billing */}
                <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 shadow-sm">
                  <SectionTitle icon={<LuReceipt size={18} />}>
                    {t("billing_details")}
                  </SectionTitle>
                  <div className="flex flex-col gap-2 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="SecondaryTextColor">
                        {t("sub_total") || "Sub Total"}
                      </span>
                      <span className="font-medium">
                        {price(orderDetail?.sub_total)}
                      </span>
                    </div>
                    {orderDetail?.delivery_charge > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="SecondaryTextColor">
                          {t("delivery_charge") || "Delivery Charge"}
                        </span>
                        <span className="font-medium">
                          {price(orderDetail?.delivery_charge)}
                        </span>
                      </div>
                    )}
                    {orderDetail?.tax_amount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="SecondaryTextColor">
                          {t("tax") || "Tax"}
                        </span>
                        <span className="font-medium">
                          {price(orderDetail?.tax_amount)}
                        </span>
                      </div>
                    )}
                    {additionalCharges.map((ch, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <span className="SecondaryTextColor">{ch?.name}</span>
                        <span className="font-medium">{price(ch?.amount)}</span>
                      </div>
                    ))}
                    {orderDetail?.promo_discount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="SecondaryTextColor">
                          {t("discount") || "Discount"}
                        </span>
                        <span className="font-medium text-green-600">
                          -{price(orderDetail?.promo_discount)}
                        </span>
                      </div>
                    )}
                    {Number(orderDetail?.saved_amount) > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-600">
                        <LuBadgeCheck size={16} /> {t("you_saved")}{" "}
                        {price(orderDetail?.saved_amount)}
                      </div>
                    )}
                    {/* Split payment breakdown. wallet_balance is the amount paid
                        FROM the wallet; final_total is the residual settled by the
                        online/COD method. Show the split box only when the wallet
                        actually covered part of the order — otherwise the single
                        Payment Method row below is enough. */}
                    {isSplit ? (
                      <>
                        {/* Flat split — plain rows in the bill list, no nested card.
                            Small label, then wallet + method with a light icon. */}
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide SecondaryTextColor">
                          {t("payment_split") || "Payment Split"}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 SecondaryTextColor">
                            <RiWallet3Line size={16} className="primaryColor" />
                            {t("wallet") || "Wallet"}
                          </span>
                          <span className="font-medium tabular-nums">
                            {price(orderDetail?.wallet_balance)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 SecondaryTextColor capitalize">
                            <RiBankCardLine
                              size={16}
                              className="primaryColor"
                            />
                            {orderDetail?.payment_method}
                          </span>
                          <span className="font-medium tabular-nums">
                            {price(orderDetail?.final_total)}
                          </span>
                        </div>
                      </>
                    ) : (
                      orderDetail?.payment_method && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="SecondaryTextColor">
                            {t("payment_method") || "Payment Method"}
                          </span>
                          <span className="font-medium uppercase">
                            {orderDetail?.payment_method}
                          </span>
                        </div>
                      )
                    )}

                    {/* Grand total LAST — after line items + payment split, so the
                        amount the user reads at the bottom is the whole order.
                        When the wallet split applies, total = wallet + the method
                        residual (final_total is only the residual). */}
                    <div className="mt-1 flex items-center justify-between border-t border-dashed border-[var(--border-color)] pt-3">
                      <span className="font-bold">{t("total")}</span>
                      <span className="font-bold text-base">
                        {price(
                          walletUsed
                            ? Number(orderDetail?.wallet_balance) +
                                gatewayResidual
                            : orderDetail?.final_total,
                        )}
                      </span>
                    </div>

                    {Number(orderDetail?.cashback_amount) > 0 && (
                      <div
                        className="relative mt-2 flex items-center justify-between gap-3 overflow-hidden rounded-xl px-3.5 py-3 text-white"
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
                              {price(orderDetail?.cashback_amount)}{" "}
                              {t("cashback")}
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
            </div>
          </div>
        )}
      </div>
      <RatingUpdateModal
        ratingId={ratingId}
        showUpdateRating={showUpdateRating}
        setShowUpdateRating={setShowUpdateRating}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      <CancelReasonModal
        showCancelMoodal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        selectedProduct={orderDetail || {}}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      <ReturnReasonModal
        showReturnModal={showReturnModal}
        setShowReturnModal={setShowReturnModal}
        selectedProduct={orderDetail || {}}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      <LiveTrackingModal
        showLiveTracking={showLiveTracking}
        setShowLiveTracking={setShowLiveTracking}
        order={{ ...orderDetail, id: orderDetail?.order_id }}
      />
      {prescriptionImg && (
        <LightBox
          showLightBox={!!prescriptionImg}
          setShowLightbox={(open) => !open && setPrescriptionImg(null)}
          images={[{ src: prescriptionImg }]}
          imageIndex={0}
        />
      )}
    </section>
  );
};

export default EcomOrderDetail;
