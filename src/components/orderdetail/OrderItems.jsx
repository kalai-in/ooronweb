import { t } from "@/utils/translation";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as api from "@/api/apiRoutes";
import CancelReasonModal from "./CancelReasonModal";
import ReturnReasonModal from "./ReturnReasonModal";
import { MdOutlineStar, MdStar } from "react-icons/md";
import { TbTruckReturn } from "react-icons/tb";
import RatingUpdateModal from "./RatingUpdateModal";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import LightBox from "@/components/ui/LightBox";
import { RiFileTextLine } from "react-icons/ri";

// Prescription file url → true when it points at an image (else treat as pdf/doc).
const isImageUrl = (url) =>
  /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(url || "");

// Flipkart-style inline star rating. No rating yet → 5 grey stars (click any to
// instant-submit that score). Has rating → filled stars up to `value`,
// read-only. `onRate(star)` is only called in the editable (no-rating) state.
const StarRating = ({ value = 0, editable = false, onRate, disabled = false }) => {
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
            className={`${editable && !disabled ? "cursor-pointer" : "cursor-default"} transition-transform ${editable && !disabled ? "hover:scale-110" : ""}`}
          >
            <Icon size={26} className={filled ? "text-[#DB9305]" : "text-gray-300 dark:text-zinc-600"} />
          </button>
        );
      })}
    </div>
  );
};

// "Color: white, Size: m" from variant_attributes
const formatAttributes = (attrs) =>
  Array.isArray(attrs)
    ? attrs.map((a) => `${a?.name}: ${a?.value}`).join(", ")
    : "";

const linkBtn =
  "inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap transition-colors hover:underline";

const actionBtn = {
  rate: `${linkBtn} text-[#55AE7B]`,
  rated: `${linkBtn} text-[#DB9305]`,
  // Subtle red-outline pill, fills on hover. Used for Cancel / Return.
  danger:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#DB3D26]/40 px-4 py-2 text-sm font-semibold text-[#DB3D26] transition-colors hover:bg-[#DB3D26] hover:text-white",
  disabled:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-semibold SecondaryTextColor cursor-not-allowed",
};

const OrderItems = ({
  products,
  handleFetchOrderDetail,
  isShowProductRating,
  currency: currencyProp,
  // Order-root booleans (new API). When the per-item *_status flags are absent,
  // fall back to these order-level gates.
  orderIsCancellable,
  orderIsReturnable,
}) => {
  const setting = useSelector((state) => state.Setting.setting);
  const user = useSelector((state) => state.User.user);
  const currency = currencyProp || setting?.currency || "";

  const [selectedProduct, setSelectedProduct] = useState([]);
  const [showCancelMoodal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showUpdateRating, setShowUpdateRating] = useState(false);
  const [ratingId, setRatingId] = useState(null);
  // product id currently being rated (disables its stars during the API call).
  const [ratingProductId, setRatingProductId] = useState(null);
  // Prescription lightbox — holds the image url currently being previewed.
  const [prescriptionImg, setPrescriptionImg] = useState(null);

  // View an uploaded prescription: images open in the lightbox, PDFs in a new tab.
  const handleViewPrescription = (url) => {
    if (!url) return;
    if (isImageUrl(url)) setPrescriptionImg(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  // Find this user's existing rating for a product (handles both response shapes:
  // rating.user.id and rating.user_id).
  const findUserRating = (product) =>
    product?.item_rating?.find(
      (r) => r?.user?.id == user?.id || r?.user_id == user?.id,
    );

  // Instant star rating: submit just the score (empty review). User can add the
  // review text afterwards via the "Write a Review" link.
  // The backend's rating/add rejects a second rating for the same product
  // ("product id has already been taken"), so if a rating already exists we
  // must call rating/update (with its id) instead of rating/add.
  const handleInstantRate = async (product, star) => {
    // Order item carries product_id (real product) separate from id (order-item
    // id) and variant_id. Rating API needs the PRODUCT id.
    const productId = product?.product_id ?? product?.id;
    setRatingProductId(productId);
    try {
      const existing = findUserRating(product);
      let response;
      if (existing?.id) {
        // Update score, preserve any existing review text + images.
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
      setRatingProductId(null);
    }
  };

  const handleCancel = (product) => {
    setSelectedProduct(product);
    setShowCancelModal(true);
  };

  const handleReturn = (product) => {
    setSelectedProduct(product);
    setShowReturnModal(true);
  };


  const handleShowUpdateRating = (product) => {
    setRatingId(findUserRating(product)?.id);
    setShowUpdateRating(true);
  };

  // Cancel/return eligibility per item.
  // New API: cancel is ORDER-LEVEL (whole order at once) and is rendered by the
  // parent (OrderDetail) — so per-item cancel is suppressed when the order-root
  // `orderIsCancellable` prop is passed. Return stays per-item.
  // Legacy (prop absent): fall back to the per-item *_status flags.
  const itemCanCancel = (product) => {
    if (orderIsCancellable !== undefined) {
      return false;
    }
    return (
      Number(product?.active_status) <= 6 &&
      Number(product?.active_status) <= Number(product?.till_status) &&
      Number(product?.cancelable_status) === 1
    );
  };

  const itemCanReturn = (product) => {
    if (product?.return_requested !== null) return false;
    if (orderIsReturnable !== undefined) {
      return orderIsReturnable === true && Number(product?.active_status) === 6;
    }
    return (
      Number(product?.active_status) === 6 &&
      Number(product?.return_status) === 1
    );
  };

  // Cancel/return/cancelled-badge column — rating is no longer part of this
  // (it moved into its own de-duplicated row below, grouped by product_id),
  // so it doesn't factor into whether this column needs to render.
  const showAction = products?.some((product) => {
    const canCancel = itemCanCancel(product);
    const canReturn = itemCanReturn(product);
    const isCancelled = Number(product?.active_status) === 7;
    return canCancel || canReturn || isCancelled;
  });

  // Different pack sizes of the SAME product (e.g. Toor Dal 500g + 1kg) are
  // separate order items but share one product_id, and the rating API rates
  // the PRODUCT, not the item. Group items by product_id so the rating row
  // below renders once per group instead of once per variant.
  const ratingGroups = new Map();
  products?.forEach((product) => {
    const key = product?.product_id ?? product?.id;
    if (!ratingGroups.has(key)) ratingGroups.set(key, []);
    ratingGroups.get(key).push(product);
  });

  return (
    <div className="rounded-md  overflow-hidden">
      <div className="flex flex-col">
        {Array.from(ratingGroups.entries()).map(([groupKey, groupItems]) => (
          <div
            key={groupKey}
            className="my-2 rounded-lg border border-[var(--border-color)] bg-[hsl(var(--muted))] shadow-sm overflow-hidden"
          >
            {groupItems.map((product, indexInGroup) => {
          const isLastOfProduct = indexInGroup === groupItems.length - 1;

          const priceNode = (
            <p className="font-bold textColor whitespace-nowrap">
              {currency}
              {(product?.discounted_price && product?.discounted_price != 0
                ? product?.discounted_price
                : product?.price
              )?.toFixed(
                setting?.decimal_point ? setting?.decimal_point : 0,
              )}
            </p>
          );

          const actionsNode = showAction ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {itemCanCancel(product) && (
                <button
                  className={actionBtn.danger}
                  onClick={() => handleCancel(product)}
                >
                  <TbTruckReturn size={18} />
                  {t("cancel")}
                </button>
              )}

              {itemCanReturn(product) && (
                <button
                  className={actionBtn.danger}
                  onClick={() => handleReturn(product)}
                >
                  <TbTruckReturn size={18} />
                  {t("return")}
                </button>
              )}

              {Number(product?.active_status) === 7 && (
                <button className={actionBtn.disabled} disabled>
                  {t("cancelled")}
                </button>
              )}
            </div>
          ) : null;

          return (
            <div
              key={product?.id}
              className={`p-4 bg-[hsl(var(--card))] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6 ${
                isLastOfProduct ? "" : "border-b border-dashed border-[var(--border-color)]"
              }`}
            >
              <div className="flex items-start gap-4 min-w-0 lg:flex-1">
                <div className="relative p-1 rounded-md flex-shrink-0 cardBorder">
                  <ImageWithPlaceholder
                    src={product?.image_url}
                    alt="Products"
                    width={72}
                    height={72}
                    className="w-16 h-16 lg:w-[72px] lg:h-[72px] backColor rounded"
                  />
                </div>

                <div className="min-w-0 flex flex-col gap-0.5">
                  <h2 className="font-semibold textColor line-clamp-2">
                    {product?.name}
                  </h2>
                  <p className="text-sm SecondaryTextColor">
                    {formatAttributes(product?.variant_attributes) || product?.variant_name
                      ? `${formatAttributes(product?.variant_attributes) || product?.variant_name} x ${product?.quantity}`
                      : `Qty: ${product?.quantity}`}
                  </p>
                  {Number(product?.return_requested) === 1 && (
                    <button className="text-left text-sm text-[#DB9305]">
                      {t("return_requested")}
                    </button>
                  )}
                  {Number(product?.return_requested) === 4 && (
                    <button className="text-left text-sm text-[#0DCaf0]">
                      {t("delivery_boy_assinged")}
                    </button>
                  )}
                  {Number(product?.return_requested) === 5 && (
                    <button className="text-left text-sm text-[#0d6efd]">
                      {t("deliver_boy_out_for_pickup")}
                    </button>
                  )}
                  {Number(product?.return_requested) === 6 && (
                    <button className="text-left text-sm text-[#6C757D]">
                      {t("item_received_from_customer")}
                    </button>
                  )}
                  {Number(product?.return_requested) === 7 && (
                    <>
                      <button className="text-left text-sm text-[#DB3D26]">
                        {t("return_request_cancel_by_delivery_boy")}
                      </button>
                      <p className="text-xs SecondaryTextColor">{`${t("sellerNote")}: ${product?.cancellation_reason
                        }`}</p>
                    </>
                  )}
                  {Number(product?.return_requested) === 8 && (
                    <button className="text-left text-sm textColor">
                      {t("item_returned_to_seller")}
                    </button>
                  )}
                  {/* Cancellation reason the customer gave. Lives on the ITEM
                      (not the order) and is only set once the item is cancelled
                      (active_status 7) — the return_requested===7 block below is
                      a different case (return rejected by the delivery boy). */}
                  {Number(product?.active_status) === 7 &&
                    product?.cancellation_reason && (
                      <p className="text-xs SecondaryTextColor">{`${t("reason")}: ${product?.cancellation_reason}`}</p>
                    )}
                  {Number(product?.active_status) === 8 && (
                    <span className="text-sm text-[#DB3D26]">{`${t("total")} ${currency
                      }${product?.refund_amount} ${t("refunded")}`}</span>
                  )}
                  {Number(product?.return_requested) === 3 && (
                    <>
                      <button className="text-left text-sm text-red-500">
                        {t("return_rejected")}
                      </button>
                      <p className="text-xs SecondaryTextColor">{`${t("sellerNote")}: ${product?.return_remarks
                        }`}</p>
                    </>
                  )}
                  {/* uploaded prescription — bordered chip (image → lightbox, pdf → tab) */}
                  {product?.prescription_url && (
                    <button
                      type="button"
                      onClick={() => handleViewPrescription(product.prescription_url)}
                      className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-lg border primaryColorBorder px-3 py-1.5 text-xs font-semibold primaryColor transition-colors hover:primaryLightBack"
                    >
                      <RiFileTextLine size={15} className="shrink-0" />
                      {t("view_prescription") || "View prescription"}
                    </button>
                  )}
                </div>
              </div>

              <div className="hidden lg:flex flex-col items-end gap-3 flex-shrink-0">
                {priceNode}
                {actionsNode}
              </div>

              <div className="flex flex-col gap-3 lg:hidden">
                <div className="bottomBorder w-full"></div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold SecondaryTextColor">{`${t("price")}:`}</p>
                  {priceNode}
                </div>
                {showAction && <div className="bottomBorder w-full"></div>}
                {actionsNode}
              </div>
            </div>
              );
            })}
            {/* Rating is PRODUCT-level (the API keys it on product_id, not the
                order-item), so pack-size variants of the same product — e.g.
                Toor Dal 500g + 1kg — share one rating. Rendered right after
                THIS group's items (not in a separate bottom section), using
                the group's first item as the API target, so it reads as
                belonging to the product directly above it. */}
            {isShowProductRating &&
              (() => {
                const repProduct = groupItems[0];
                if (Number(repProduct?.active_status) !== 6) return null;
                if (repProduct?.return_requested !== null) return null;
                const userRating = findUserRating(repProduct);
                const repProductId = repProduct?.product_id ?? repProduct?.id;
                return (
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[hsl(var(--muted))] px-4 py-3">
                    <p className="min-w-0 truncate text-xs font-medium SecondaryTextColor">
                      {groupItems.length > 1
                        ? `${groupItems.length} ${t("variants") || "variants"}`
                        : ""}
                    </p>
                    {userRating ? (
                      <div className="flex shrink-0 items-center gap-3">
                        <StarRating value={Number(userRating?.rate) || 0} />
                        <button
                          className={actionBtn.rate}
                          onClick={() => handleShowUpdateRating(repProduct)}
                        >
                          {userRating?.review
                            ? t("view_review") || "View Review"
                            : t("write_a_review") || "Write a Review"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StarRating
                          editable
                          disabled={ratingProductId === repProductId}
                          onRate={(star) => handleInstantRate(repProduct, star)}
                        />
                        <span className="text-xs SecondaryTextColor">
                          {t("rate_this_product_now") || "Rate this product now"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        ))}
      </div>
      <CancelReasonModal
        showCancelMoodal={showCancelMoodal}
        setShowCancelModal={setShowCancelModal}
        selectedProduct={selectedProduct}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      <ReturnReasonModal
        showReturnModal={showReturnModal}
        setShowReturnModal={setShowReturnModal}
        selectedProduct={selectedProduct}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      <RatingUpdateModal
        ratingId={ratingId}
        showUpdateRating={showUpdateRating}
        setShowUpdateRating={setShowUpdateRating}
        handleFetchOrderDetail={handleFetchOrderDetail}
      />
      {prescriptionImg && (
        <LightBox
          showLightBox={!!prescriptionImg}
          setShowLightbox={(open) => !open && setPrescriptionImg(null)}
          images={[{ src: prescriptionImg }]}
          imageIndex={0}
        />
      )}
    </div>
  );
};

export default OrderItems;
