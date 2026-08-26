import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import * as api from "@/api/apiRoutes";
import { useSelector, useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import { hasReachedAllowedQty } from "@/utils/helperFunction";
import { RiCloseFill } from "react-icons/ri";
import { FiMinus, FiPlus, FiChevronRight, FiChevronLeft } from "react-icons/fi";
import { MdAddShoppingCart } from "react-icons/md";

import {
  addGuestCartTotal,
  addtoGuestCart,
  setCart,
  setCartProducts,
  setCartSubTotal,
  subGuestCartTotal,
} from "@/redux/slices/cartSlice";
import { toast } from "react-toastify";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import useZoneHref from "@/hooks/useZoneHref";
import useIsRtl from "@/hooks/useIsRtl";
import { useState, useEffect } from "react";

const VariantsModal = ({ product, showVariants, setShowVariants }) => {
  const dispatch = useDispatch();
  const setting = useSelector((state) => state.Setting);
  const cart = useSelector((state) => state.Cart);
  const city = useSelector((state) => state.City.city);
  const zoneHref = useZoneHref();
  const rtl = useIsRtl();

  const [activeVariant, setActiveVariant] = useState(null);

  // Default the hero/active selection to the first variant so the modal never
  // opens with a blank preview, and resets whenever a different product opens.
  // Keyed on product?.id only, not product?.variants: `product` is a parent
  // prop whose array identity isn't guaranteed stable across renders, so
  // depending on it would reset the selection on every parent re-render
  // instead of only when a different product is opened.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when a different product opens
    setActiveVariant(product?.variants?.[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);
  // Variant ids with an add/remove request in flight. A logged-in add hits the
  // server, and fast clicks fired one request per click (Network showed 5x add
  // for 5 clicks). We lock the variant while its request runs so a second click
  // is ignored until the first resolves — no duplicate cart calls.
  const [pendingVariantIds, setPendingVariantIds] = useState([]);
  const isVariantPending = (variant) => pendingVariantIds.includes(variant?.id);

  // Channel-aware currency. setting.currency is global and blanks out in the
  // quick channel; the product and the per-channel cart carry the right symbol,
  // so prefer them (mirrors ProductDetail / CheckoutUI).
  const currency =
    product?.currency || cart?.currency || setting?.setting?.currency || "";

  // images come as { image_url } objects or plain strings.
  const toImageUrl = (img) => (typeof img === "string" ? img : img?.image_url);

  // per-variant main image, falling back to the product image.
  const getVariantImage = (variant) =>
    variant?.image || toImageUrl(variant?.images?.[0]) || product?.image_url;

  // header image follows the hovered/selected variant, else the product image.
  const headerImage = activeVariant
    ? getVariantImage(activeVariant)
    : product?.image_url;

  // active-variant price for the bottom summary bar.
  const activeHasDiscount =
    activeVariant?.discounted_price !== 0 &&
    activeVariant?.discounted_price !== activeVariant?.price;
  const activeDiscountPercent = activeHasDiscount
    ? Math.round(
        activeVariant?.discount_percent ??
          product?.discount_percent ??
          ((activeVariant?.price - activeVariant?.discounted_price) /
            activeVariant?.price) *
            100,
      )
    : null;

  const handleHideVariantModal = () => {
    setActiveVariant(null);
    setShowVariants(false);
  };
  const isAlreadyAdded = (variant) => {
    return (
      (cart?.isGuest === false &&
        cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty > 0) ||
      (cart?.isGuest === true &&
        cart?.guestCart?.find(
          (prdct) => prdct?.product_variant_id === variant?.id,
        )?.qty > 0)
    );
  };
  const addedQuantity = (variant) => {
    return cart.isGuest === false
      ? cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty
      : cart?.guestCart?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty;
  };

  const isVariantAvailable = (variant) => {
    return variant?.is_unlimited_stock == 0 && variant?.stock <= 0;
  };

  const getProductQuantities = (products) => {
    return Object.entries(
      products?.reduce((quantities, product) => {
        const existingQty = quantities[product.product_id] || 0;
        return {
          ...quantities,
          [product.product_id]: existingQty + product.qty,
        };
      }, {}),
    ).map(([productId, qty]) => ({
      product_id: Number.parseInt(productId),
      qty,
    }));
  };

  // cart functionality
  const addToCart = async (productId, variant, qty) => {
    // Guard: skip if a request for this variant is already in flight.
    if (isVariantPending(variant)) return;
    setPendingVariantIds((ids) => [...ids, variant?.id]);
    try {
      const response = await api.addToCart({
        product_id: productId,
        product_variant_id: variant.id,
        qty: qty,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status === 1) {
        // Rebuild from the server's authoritative cart array instead of spreading the
        // closure snapshot — a multi-variant product adds several lines and the spread
        // path drops/overwrites lines on fast clicks. sub_total lives at data.sub_total.
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCart({ data: response }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      } else {
        toast.error(response?.message);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setPendingVariantIds((ids) => ids.filter((id) => id !== variant?.id));
    }
  };

  const removeFromCart = async (productId, variant) => {
    if (isVariantPending(variant)) return;
    setPendingVariantIds((ids) => [...ids, variant?.id]);
    try {
      const response = await api.removeFromCart({
        product_id: productId,
        product_variant_id: variant?.id,
      });
      // Removing the LAST item: the API 0-returns "No item(s) found in users cart"
      // even though it cleared the row. Treat that as a successful removal so the
      // stepper resets to the Add button instead of toasting + leaving a phantom row.
      const alreadyGone =
        response?.status !== 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status === 1 || alreadyGone) {
        // Prefer the server's authoritative cart; fall back to filtering the removed
        // variant out of the local list when the API returns no cart array.
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        const updatedProducts =
          serverCart ??
          cart?.cartProducts?.filter(
            (product) => product?.product_variant_id != variant?.id,
          );
        dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
        dispatch(setCartProducts({ data: updatedProducts ?? [] }));
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setPendingVariantIds((ids) => ids.filter((id) => id !== variant?.id));
    }
  };
  // Guest cart total tracks add/remove deltas separately from the cart list
  // itself, so every mutation below reports its flag before touching guestCart.
  const dispatchGuestTotal = (flag, amount) => {
    if (flag == "add") {
      dispatch(addGuestCartTotal({ data: amount }));
    } else if (flag == "remove") {
      dispatch(subGuestCartTotal({ data: amount }));
    }
  };

  const updateExistingGuestQty = (productId, variant, Qty) =>
    Qty !== 0
      ? cart?.guestCart?.map((product) =>
          product?.product_id == productId &&
          product?.product_variant_id == variant.id
            ? { ...product, qty: Qty }
            : product,
        )
      : cart?.guestCart?.filter(
          (product) => product?.product_variant_id != variant.id,
        );

  const AddToGuestCart = (productId, variant, Qty, isExisting, flag) => {
    const finalPrice =
      variant?.discounted_price !== 0
        ? variant?.discounted_price
        : variant?.price;
    dispatchGuestTotal(flag, finalPrice);

    if (isExisting) {
      const updatedProducts = updateExistingGuestQty(productId, variant, Qty);
      dispatch(addtoGuestCart({ data: updatedProducts }));
    } else {
      const productData = {
        product_id: productId,
        product_variant_id: variant.id,
        qty: Qty,
        productPrice: finalPrice,
      };
      dispatch(
        addtoGuestCart({ data: [...(cart?.guestCart ?? []), productData] }),
      );
    }
  };
  const handleValidateAddExistingGuestProduct = (
    productQuantity,
    product,
    quantity,
    variant,
  ) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    if (Number(product.is_unlimited_stock !== 0)) {
      if (hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
        toast.error(t("max_cart_limit_error"));
      } else {
        AddToGuestCart(product?.id, variant, quantity, 1, "add");
      }
    } else if (productQty >= Number(variant?.stock)) {
      toast.error(t("out_of_stock_message"));
    } else if (
      hasReachedAllowedQty(productQty, product?.total_allowed_quantity)
    ) {
      toast.error(t("max_cart_limit_error"));
    } else {
      AddToGuestCart(product?.id, variant, quantity, 1, "add");
    }
  };
  const handleAddNewProductGuest = (productQuantity, product, variant) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    if (
      hasReachedAllowedQty(productQty || 0, product?.total_allowed_quantity)
    ) {
      toast.error(t("max_cart_limit_error"));
    } else if (variant?.is_unlimited_stock == 0 && variant?.stock == 0) {
      toast.error(t("out_of_stock_message"));
    } else if (Number(product.is_unlimited_stock)) {
      AddToGuestCart(product.id, variant, 1, 0, "add");
    } else if (variant?.status) {
      AddToGuestCart(product.id, variant, 1, 0, "add");
    } else {
      toast.error(t("out_of_stock_message"));
    }
  };
  const handleValidateAddNewProduct = (productQuantity, product, variant) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    // A variant is disabled ONLY when status is explicitly 0 — a MISSING status
    // (thin recommendation payloads omit it) must NOT block the add.
    const variantDisabled =
      variant?.status !== undefined && Number(variant?.status) === 0;
    if (
      hasReachedAllowedQty(productQty || 0, product?.total_allowed_quantity)
    ) {
      toast.error(t("max_cart_limit_error"));
    } else if (
      variant?.is_unlimited_stock == 0 &&
      Number(variant?.stock) <= 0
    ) {
      toast.error(t("out_of_stock_message"));
    } else if (variantDisabled) {
      toast.error(t("out_of_stock_message"));
    } else {
      addToCart(product.id, variant, 1);
    }
  };
  const handleIntialAddToCart = (e, variant) => {
    e.preventDefault();
    const quantity = getProductQuantities(cart?.cartProducts);
    if (cart?.isGuest) {
      handleAddNewProductGuest(quantity, product, variant);
    } else {
      handleValidateAddNewProduct(quantity, product, variant);
    }
  };
  const handleValidateAddExistingProduct = (
    productQuantity,
    product,
    variant,
  ) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    if (Number(product.is_unlimited_stock)) {
      if (!hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
        addToCart(
          product.id,
          variant,
          cart?.cartProducts?.find(
            (prdct) => prdct?.product_variant_id == variant?.id,
          )?.qty + 1,
        );
      } else {
        toast.error(t("max_cart_limit_error"));
      }
    } else if (productQty >= Number(variant.stock)) {
      toast.error(t("out_of_stock_message"));
    } else if (
      hasReachedAllowedQty(Number(productQty), product.total_allowed_quantity)
    ) {
      toast.error(t("max_cart_limit_error"));
    } else {
      addToCart(
        product.id,
        variant,
        cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty + 1,
      );
    }
  };
  const handleQuantityIncrease = (e, variant) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      const productQuantity = getProductQuantities(cart?.guestCart);
      handleValidateAddExistingGuestProduct(
        productQuantity,
        product,
        cart?.guestCart?.find(
          (prdct) =>
            prdct?.product_id == product?.id &&
            prdct?.product_variant_id == variant?.id,
        )?.qty + 1,
        variant,
      );
    } else {
      const quantity = getProductQuantities(cart?.cartProducts);
      handleValidateAddExistingProduct(quantity, product, variant);
    }
  };
  const handleQuantityDecrease = (e, variant) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      AddToGuestCart(
        product?.id,
        variant,
        cart?.guestCart?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty - 1,
        1,
        "remove",
      );
    } else if (
      cart?.cartProducts?.find(
        (prdct) => prdct?.product_variant_id == variant?.id,
      )?.qty == 1
    ) {
      removeFromCart(product?.id, variant);
    } else {
      addToCart(
        product.id,
        variant,
        cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == variant?.id,
        )?.qty - 1,
      );
    }
  };

  const activeIsAdded = activeVariant ? isAlreadyAdded(activeVariant) : false;
  const activeQuantity = activeVariant ? addedQuantity(activeVariant) : 0;
  const activeOutOfStock = activeVariant
    ? isVariantAvailable(activeVariant)
    : false;
  const activePending = activeVariant ? isVariantPending(activeVariant) : false;

  // Variant label: attributes_text when descriptive, else the name's tail
  // segment (e.g. "Dal Makhani & Chapati"), else measurement + unit.
  const variantLabel = (variant) => {
    const at = variant?.attributes_text;
    if (at && Number.isNaN(Number(at))) return at;
    const tail = variant?.name?.split("||").pop()?.trim();
    return (
      tail ||
      `${variant?.measurement ?? ""} ${variant?.unit?.translations?.short_code ?? variant?.unit?.short_code ?? ""}`.trim() ||
      variant?.name
    );
  };

  // Bottom-bar CTA: out-of-stock label, stepper (already in cart), or Add button.
  let cartAction;
  if (activeOutOfStock) {
    cartAction = (
      <span className="inline-flex h-11 items-center rounded-md bg-gray-100 dark:bg-zinc-800 px-4 text-xs font-bold text-gray-400">
        {t("out_of_stock")}
      </span>
    );
  } else if (activeIsAdded) {
    cartAction = (
      <div className="flex items-center justify-between gap-1 rounded-md primaryBackColor text-white px-1 w-[120px] h-11 shadow-sm">
        <button
          type="button"
          aria-label="decrease"
          disabled={activePending}
          className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/25 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          onClick={(e) => handleQuantityDecrease(e, activeVariant)}
        >
          <FiMinus size={16} />
        </button>
        <span className="min-w-[20px] text-center text-sm font-bold tabular-nums">
          {activeQuantity}
        </span>
        <button
          type="button"
          aria-label="increase"
          disabled={
            activePending ||
            hasReachedAllowedQty(
              activeQuantity,
              product?.total_allowed_quantity,
            )
          }
          aria-disabled={
            activePending ||
            hasReachedAllowedQty(
              activeQuantity,
              product?.total_allowed_quantity,
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/25 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          onClick={(e) => handleQuantityIncrease(e, activeVariant)}
        >
          <FiPlus size={16} />
        </button>
      </div>
    );
  } else {
    cartAction = (
      <button
        type="button"
        disabled={activePending || !activeVariant}
        className="primaryBackColor flex h-11 w-[140px] items-center justify-center gap-1.5 rounded-md text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-95 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition"
        onClick={(e) => handleIntialAddToCart(e, activeVariant)}
      >
        <MdAddShoppingCart size={16} />
        {t("add_to_cart")}
      </button>
    );
  }

  return (
    <Dialog
      open={showVariants}
      onOpenChange={(open) => !open && handleHideVariantModal()}
    >
      <DialogContent
        className="max-w-xl flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0"
        title={t("chooseVariant")}
      >
        <DialogHeader className="sr-only">{t("chooseVariant")}</DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          {/* hero image — follows the active/hovered variant */}
          <div className="relative h-64 w-full shrink-0 bg-gray-50 dark:bg-zinc-900">
            <ImageWithPlaceholder
              src={headerImage}
              alt={product?.name}
              width={640}
              height={400}
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              aria-label={t("close")}
              onClick={handleHideVariantModal}
              className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white transition"
            >
              <RiCloseFill size={20} />
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* title + view details */}
            <div className="mb-4">
              <div className="font-bold text-lg capitalize">
                {product?.name}
              </div>
              <Link
                href={zoneHref(`/product/${product?.slug}`)}
                className="inline-flex items-center gap-0.5 text-sm font-semibold primaryColor hover:underline"
              >
                {t("view_details")}{" "}
                {rtl ? (
                  <FiChevronLeft size={16} />
                ) : (
                  <FiChevronRight size={16} />
                )}
              </Link>
            </div>

            {/* variant thumbnails */}
            <div className="text-sm font-semibold text-gray-500 mb-2">
              {t("variants")}
            </div>
            <Swiper
              slidesPerView="auto"
              spaceBetween={12}
              freeMode
              grabCursor
              slidesOffsetAfter={12}
              breakpoints={{
                0: { spaceBetween: 10, slidesOffsetAfter: 10 },
                480: { spaceBetween: 12, slidesOffsetAfter: 12 },
              }}
              className="variant-swiper no-scrollbar !overflow-hidden !pb-0 touch-pan-x"
            >
              {product?.variants?.map((variant) => {
                const isActive = activeVariant?.id === variant?.id;
                const variantOutOfStock = isVariantAvailable(variant);
                return (
                  <SwiperSlide key={variant?.id} className="!w-24">
                    <button
                      type="button"
                      onClick={() => setActiveVariant(variant)}
                      className={`flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-all duration-200 ${
                        isActive
                          ? "primaryColorBorder primaryLightBack"
                          : "border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700"
                      } ${variantOutOfStock ? "opacity-60" : ""}`}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white border border-gray-100 dark:border-zinc-700">
                        <ImageWithPlaceholder
                          src={getVariantImage(variant)}
                          alt={variant?.name}
                          width={100}
                          height={100}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span className="line-clamp-2 text-xs font-medium capitalize leading-tight">
                        {variantLabel(variant)}
                      </span>
                    </button>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        </div>

        {/* bottom bar — price of the active variant + add/stepper */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 md:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xl font-bold primaryColor">
                {currency}
                {activeVariant?.discounted_price == 0
                  ? activeVariant?.price
                  : activeVariant?.discounted_price}
              </span>
              {activeHasDiscount && (
                <span className="text-sm line-through text-gray-400">
                  {currency}
                  {activeVariant?.price}
                </span>
              )}
            </div>
            {activeHasDiscount && (
              <span className="inline-flex w-fit items-center rounded-md primaryLightBack px-2 py-0.5 text-xs font-bold primaryColor">
                {activeDiscountPercent}% {t("off")}
              </span>
            )}
          </div>

          <div className="shrink-0">{cartAction}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VariantsModal;
