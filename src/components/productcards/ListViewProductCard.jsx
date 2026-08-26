import React, { useEffect, useState, useRef, useMemo } from "react";
import { t } from "@/utils/translation";
import { FaMinus, FaPlus, FaRegEye, FaStar } from "react-icons/fa";
import Link from "next/link";
import { MdAddShoppingCart } from "react-icons/md";
import VariantsModal from "../variantsmodal/VariantsModal";
import ProductDetailModal from "../productdetailmodal/ProductDetailModal";
import { useDispatch, useSelector } from "react-redux";
import {
  addGuestCartTotal,
  addtoGuestCart,
  setCart,
  setCartProducts,
  setCartSubTotal,
  subGuestCartTotal,
} from "@/redux/slices/cartSlice";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import { BiHeart, BiSolidHeart } from "react-icons/bi";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import FewLeftBadge from "./FewLeftBadge";
import TimeIcon from "./TimeIcon";
import {
  hasReachedAllowedQty,
  formatCurrency,
  isVariantOutOfStock,
} from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";

const ListViewProductCard = ({ product, radius = null }) => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();

  const cart = useSelector((state) => state.Cart);
  const setting = useSelector((state) => state.Setting.setting);
  const currency = product?.currency ?? setting?.currency;
  const decimals = product?.decimal_point ?? setting?.decimal_point ?? 0;
  const money = (val) => formatCurrency(val, currency, decimals, true);
  const city = useSelector((state) => state.City.city);
  const shopMode = useSelector((state) => state.ShopMode.mode);

  // Blinkit-style quick delivery label: show only in the quick channel AND
  // only when the product carries its own ETA (e.g. "25 mins"). No API value
  // → no fallback; the badge is hidden entirely.
  //
  // Gated on hydration: `shopMode` is persisted, so the server renders the
  // slice default ("quick") while the client renders the rehydrated value. The
  // badge's *presence* differs between the two → hydration mismatch.
  const hydrated = useIsHydrated();
  const deliveryLabel = product?.time_to_deliver;
  const showQuickDelivery = hydrated && shopMode === "quick" && !!deliveryLabel;

  // Derived during render, not in the effect below: effects don't run on the
  // server, so the old `useState([])` made every server-rendered card print ₹0
  // until hydration — which is the price crawlers saw. Mirrors
  // VerticleProductCard.
  const defaultVariant = useMemo(() => {
    const variants = product?.variants;
    if (!Array.isArray(variants) || variants.length === 0) return undefined;
    const inStock = variants.find(
      (variant) => variant?.is_unlimited_stock === 0 && variant?.stock > 0,
    );
    return inStock ?? variants[0];
  }, [product?.variants]);

  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const [showVariants, setShowVariants] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);
  // Drives the like-button pop + particle burst on a fresh like.
  const [likeBurst, setLikeBurst] = useState(false);

  // Flipkart-style hover slideshow: cycle the product gallery while hovered.
  // Gallery = primary image_url + extra images[] (deduped). Single image → no-op.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- compiler infers a single field; deps intentionally include both product?.image_url and product?.images since both feed the list
  const galleryImages = useMemo(() => {
    const toUrl = (img) => (typeof img === "string" ? img : img?.image_url);
    const list = [
      product?.image_url,
      ...(product?.images || []).map(toUrl),
    ].filter(Boolean);
    return [...new Set(list)];
  }, [product?.image_url, product?.images]);

  const [hoverImgIdx, setHoverImgIdx] = useState(0);
  const hoverTimerRef = useRef(null);

  const startHoverSlide = () => {
    if (galleryImages.length <= 1) return;
    if (hoverTimerRef.current) return;
    hoverTimerRef.current = setInterval(() => {
      setHoverImgIdx((i) => (i + 1) % galleryImages.length);
    }, 900);
  };

  const stopHoverSlide = () => {
    if (hoverTimerRef.current) {
      clearInterval(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverImgIdx(0);
  };

  useEffect(() => () => stopHoverSlide(), []);

  useEffect(() => {
    const isMultiVariant = product?.variants?.length > 1;

    // Multi-variant cards ALWAYS display the first in-stock variant (the "starting
    // from" option) — adding goes through the picker modal, which tracks its own
    // selection, so the card must not swap its shown price/name to whatever variant
    // happens to be in the cart. Only single-variant cards lock onto the cart
    // variant, because they inline-step and add/remove must key off the same
    // product_variant_id (otherwise remove fires the wrong id and the API
    // 0-returns "No item(s) found in users cart").
    if (!isMultiVariant) {
      const cartList = cart?.isGuest ? cart?.guestCart : cart?.cartProducts;
      const inCart = product?.variants?.find((variant) =>
        cartList?.some((c) => c?.product_variant_id == variant?.id),
      );
      if (inCart) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected variant with the cart's current line for this product
        setSelectedVariant(inCart);
        return;
      }
    }
    setSelectedVariant(defaultVariant);
  }, [
    product?.id,
    product?.variants,
    defaultVariant,
    cart?.isGuest,
    cart?.cartProducts,
    cart?.guestCart,
  ]);

  const calculateDiscount = (discountPrice, actualPrice) => {
    const difference = actualPrice - discountPrice;
    const actualDiscountPrice = difference / actualPrice;
    return actualDiscountPrice * 100;
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
      product_id: parseInt(productId),
      qty,
    }));
  };

  // cart functionality
  const addToCart = async (productId, productVId, qty, ctx) => {
    try {
      const response = await api.addToCart({
        product_id: productId,
        product_variant_id: productVId,
        qty: qty,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      // Out-of-order guard: drop this response if a newer +/- flush already fired.
      if (ctx?.isStale?.()) return;
      if (response.status === 1) {
        // Rebuild cartProducts from the server's authoritative cart array, NOT by
        // spreading the cart selector captured in this closure. Two fast clicks both
        // see the same pre-click snapshot, so the closure-spread loses a line (last
        // write wins) and the header count goes stale. Server cart = source of truth.
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCart({ data: response }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const removeFromCart = async (productId, variantId, units = 1, ctx) => {
    try {
      const response = await api.removeFromCart({
        product_id: productId,
        product_variant_id: variantId,
        qty: units,
      });
      // Out-of-order guard — drop stale responses superseded by a newer flush.
      if (ctx?.isStale?.()) return;
      // Removing the LAST item: the API 0-returns "No item(s) found in users cart"
      // even though it cleared the row. Treat that as a successful removal so the
      // stepper resets to the Add button instead of toasting + leaving a phantom row.
      const alreadyGone =
        response?.status !== 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status === 1 || alreadyGone) {
        // Rebuild from the server's authoritative cart so a PARTIAL decrement
        // (qty>0 left) keeps the line at its new qty instead of dropping the whole
        // row. When the line is fully gone the server omits it, so it falls out.
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };
  const AddToGuestCart = (
    product,
    productId,
    productVariantId,
    Qty,
    isExisting,
    flag,
  ) => {
    const finalPrice =
      selectedVariant?.discounted_price !== 0
        ? selectedVariant?.discounted_price
        : selectedVariant?.price;
    if (isExisting) {
      let updatedProducts;
      if (Qty !== 0) {
        if (flag == "add") {
          dispatch(addGuestCartTotal({ data: finalPrice }));
        } else if (flag == "remove") {
          dispatch(subGuestCartTotal({ data: finalPrice }));
        }
        updatedProducts = cart?.guestCart?.map((product) => {
          if (
            product?.product_id == productId &&
            product?.product_variant_id == productVariantId
          ) {
            return { ...product, qty: Qty };
          } else {
            // dispatch(addGuestCartTotal({ data: finalPrice }));
            return product;
          }
        });
      } else {
        if (flag == "add") {
          dispatch(addGuestCartTotal({ data: finalPrice }));
        } else if (flag == "remove") {
          dispatch(subGuestCartTotal({ data: finalPrice }));
        }
        updatedProducts = cart?.guestCart?.filter(
          (product) =>
            product?.product_id != productId &&
            product?.product_variant_id != productVariantId,
        );
      }
      dispatch(addtoGuestCart({ data: updatedProducts }));
    } else {
      if (flag == "add") {
        dispatch(addGuestCartTotal({ data: finalPrice }));
      } else if (flag == "remove") {
        dispatch(subGuestCartTotal({ data: finalPrice }));
      }
      // dispatch(addGuestCartTotal({ data: finalPrice }))
      const productData = {
        product_id: productId,
        product_variant_id: productVariantId,
        qty: Qty,
        productPrice: finalPrice,
      };
      dispatch(addtoGuestCart({ data: [...cart?.guestCart, productData] }));
    }
  };
  const handleValidateAddExistingGuestProduct = (
    productQuantity,
    product,
    quantity,
  ) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;

    if (Number(product.is_unlimited_stock !== 0)) {
      if (hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
        toast.error(t("max_cart_limit_error"));
      } else {
        AddToGuestCart(
          product,
          product?.id,
          selectedVariant?.id,
          quantity,
          1,
          "add",
        );
      }
    } else {
      if (productQty >= Number(selectedVariant?.stock)) {
        toast.error(t("out_of_stock_message"));
      } else if (
        hasReachedAllowedQty(productQty, product?.total_allowed_quantity)
      ) {
        toast.error(t("max_cart_limit_error"));
      } else {
        AddToGuestCart(
          product,
          product?.id,
          selectedVariant?.id,
          quantity,
          1,
          "add",
        );
      }
    }
  };
  const handleAddNewProductGuest = (productQuantity, product) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    const variantDisabled =
      selectedVariant?.status !== undefined &&
      Number(selectedVariant?.status) === 0;

    if (isVariantOutOfStock(selectedVariant) || variantDisabled) {
      toast.error(t("out_of_stock_message"));
    } else if (
      !hasReachedAllowedQty(
        Number(productQty || 0),
        product.total_allowed_quantity,
      )
    ) {
      AddToGuestCart(product, product.id, selectedVariant?.id, 1, 0, "add");
    } else {
      toast.error(t("out_of_stock_message"));
    }
  };
  const handleValidateAddNewProduct = (productQuantity, product) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;

    const variantDisabled =
      selectedVariant?.status !== undefined &&
      Number(selectedVariant?.status) === 0;

    if (
      hasReachedAllowedQty(productQty || 0, product?.total_allowed_quantity)
    ) {
      toast.error(t("out_of_stock_message"));
    } else if (isVariantOutOfStock(selectedVariant) || variantDisabled) {
      toast.error(t("out_of_stock_message"));
    } else if (cart?.cartProducts?.length >= setting?.max_cart_items_count) {
      toast.error(t("maximum_cart_quantity_reach"));
    } else {
      addToCart(product.id, selectedVariant?.id, 1);
    }
  };
  const handleIntialAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      const quantity = getProductQuantities(cart?.cartProducts);
      handleAddNewProductGuest(quantity, product);
    } else {
      const quantity = getProductQuantities(cart?.cartProducts);
      handleValidateAddNewProduct(quantity, product);
    }
  };
  const handleValidateAddExistingProduct = (productQuantity, product) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;

    const variantDisabled =
      selectedVariant?.status !== undefined &&
      Number(selectedVariant?.status) === 0;

    if (isVariantOutOfStock(selectedVariant) || variantDisabled) {
      toast.error(t("out_of_stock_message"));
    } else if (
      hasReachedAllowedQty(
        Number(productQty || 0),
        product?.total_allowed_quantity,
      )
    ) {
      toast.error(t("max_cart_limit_error"));
    } else {
      addToCart(
        product.id,
        selectedVariant?.id,
        (cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty || 0) + 1,
      );
    }
  };
  const handleQuantityIncrease = (e) => {
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
            prdct?.product_variant_id == selectedVariant?.id,
        )?.qty + 1,
      );
    } else {
      serverIncrement();
    }
  };
  const handleQuantityDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      AddToGuestCart(
        product,
        product?.id,
        selectedVariant?.id,
        cart?.guestCart?.find(
          (prdct) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty - 1,
        1,
        "remove",
      );
    } else {
      serverDecrement();
    }
  };
  const handleShowVariantModal = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.variants.length > 1) {
      setShowVariants(true);
    } else {
      return;
    }
  };
  const handleShowDetailModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowProductDetail(true);
  };

  // Optimistic + in-flight-guarded wishlist toggle. Rapid clicks used to each
  // read the pre-response redux state and fire their own addToFavorite; the hook
  // flips redux on click and drops clicks while a call is running.
  const {
    liked,
    pending: likePending,
    toggle: handleProductLikes,
  } = useFavoriteToggle({
    productId: product?.id,
    onToggled: (nowLiked) => {
      // Pop + burst animation on a fresh like only (auto-reset so it replays).
      if (!nowLiked) return;
      setLikeBurst(true);
      setTimeout(() => setLikeBurst(false), 600);
    },
  });

  const productsVariants = product.variants;

  const isProductAlreadyAdded =
    (cart?.isGuest === false &&
      cart?.cartProducts?.find(
        (prdct) => prdct?.product_variant_id == selectedVariant?.id,
      )?.qty > 0) ||
    (cart?.isGuest === true &&
      cart?.guestCart?.find(
        (prdct) => prdct?.product_variant_id === selectedVariant?.id,
      )?.qty > 0);

  const addedQuantity =
    cart.isGuest === false
      ? cart?.cartProducts?.find(
          (prdct) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty
      : cart?.guestCart?.find(
          (prdct) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty;

  // Upper bound for the stepper: the smaller of stock (when limited) and the
  // per-product allowed quantity. Unlimited stock → only the allowed cap applies.
  const allowedCap = Number(product?.total_allowed_quantity) || Infinity;
  const stockCap =
    selectedVariant?.is_unlimited_stock == 0
      ? Number(selectedVariant?.stock) || 0
      : Infinity;
  const maxQty = Math.min(allowedCap, stockCap);

  const {
    displayQty: serverDisplayQty,
    increment: serverIncrement,
    decrement: serverDecrement,
  } = useDebouncedQuantity({
    serverQty: addedQuantity || 0,
    onCommit: (qty, ctx) =>
      addToCart(product?.id, selectedVariant?.id, qty, ctx),
    onRemove: (units = 1, ctx) =>
      removeFromCart(product?.id, selectedVariant?.id, units, ctx),
    max: Number.isFinite(maxQty) ? maxQty : undefined,
    onMax: () =>
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      }),
  });

  // Gated on `hydrated` — the persisted cart renders an Add button on the server
  // and a stepper on the client, and those are different elements (hydration
  // mismatch). See HomeVerticleProductCard for the full note.
  const showStepper =
    hydrated && (cart?.isGuest ? isProductAlreadyAdded : serverDisplayQty > 0);

  // home_layout `store_closed: 1` — catalogue stays browsable, buy path is shut.
  // The API layer already rejects the add; these keep the buttons honest: same
  // shape as always, faded, and a toast on click instead of a silent no-op.
  const {
    storeClosed,
    guard: guardClosed,
    closedProps,
    closedDecorClass,
  } = useStoreClosed();

  const isProductAvailabel =
    (product?.variants?.length <= 1 &&
      product?.variants?.[0]?.is_unlimited_stock == 0 &&
      product?.variants?.[0]?.stock == 0) ||
    (selectedVariant?.stock <= 0 && selectedVariant?.is_unlimited_stock == 0) ||
    selectedVariant?.status == 0 ||
    product?.status == 0;

  const hasDiscount =
    selectedVariant?.discounted_price !== 0 &&
    selectedVariant?.discounted_price !== selectedVariant?.price;
  // Exact % from API variant, else computed (not rounded up).
  const discountPercent = hasDiscount
    ? (selectedVariant?.discount_percent ??
      Number(
        calculateDiscount(
          selectedVariant?.discounted_price,
          selectedVariant?.price,
        ).toFixed(2),
      ))
    : null;

  return (
    <div className="h-full">
      <Link
        href={zoneHref(`/product/${product?.slug}`)}
        prefetch={false}
        style={{
          ...(radius != null ? { borderRadius: radius } : {}),
          // Border tinted from the API theme (--primary-color) — soft hairline.
          borderColor:
            "color-mix(in srgb, var(--primary-color) 18%, transparent)",
        }}
        className={`flex flex-row h-full min-h-[140px] w-full gap-3 p-2.5 sm:p-3 group border bg-white dark:bg-zinc-900 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_3px_14px_rgba(0,0,0,0.08)] transition-shadow duration-200 ${
          isProductAvailabel ? "cursor-not-allowed" : ""
        }`}
        onMouseEnter={startHoverSlide}
        onMouseLeave={stopHoverSlide}
      >
        {/* Image — fixed square, top-aligned so card height is driven by content,
            not a stretched image. Keeps every card the same height across a row. */}
        <div className="relative shrink-0 self-start w-24 h-24 sm:w-28 sm:h-28 overflow-hidden rounded-xl bg-[#f7f8fa] dark:bg-zinc-800">
          {hasDiscount && discountPercent > 0 && (
            <span
              className={`absolute -left-10 top-4 z-10 w-32 -rotate-45 rtl:left-auto rtl:-right-10 rtl:rotate-45 primaryBackColor py-1 text-center text-[11px] font-bold uppercase leading-none tracking-wide text-white shadow-md ${closedDecorClass}`}
            >
              {Math.round(discountPercent)}% {t("off")}
            </span>
          )}
          {/* wishlist + quick view overlay — desktop only, reveal on hover */}
          <div className="absolute right-1.5 top-1.5 z-20 hidden lg:flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer">
            <button
              type="button"
              onClick={handleProductLikes}
              aria-label={t("wishlist")}
              className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 shadow-sm hover:primaryBorder transition-transform active:scale-90"
            >
              {likeBurst && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="like-particle"
                      style={{ "--i": i }}
                    />
                  ))}
                </span>
              )}
              <span
                className={`relative z-10 flex items-center justify-center ${
                  likeBurst ? "like-pop" : ""
                }`}
              >
                {liked ? (
                  <BiSolidHeart size={14} className="primaryFilledColor" />
                ) : (
                  <BiHeart size={14} className="svgColors hover:primaryColor" />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              aria-label={t("quick_view")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 shadow-sm hover:primaryBorder"
            >
              <FaRegEye size={13} className="svgColors hover:primaryColor" />
            </button>
          </div>
          {galleryImages.length > 1 ? (
            // Stacked crossfade: active slide opaque, others fade in/out.
            <div className="absolute inset-0">
              {galleryImages.map((img, idx) => (
                <ImageWithPlaceholder
                  key={img + idx}
                  src={img}
                  alt={
                    product?.translations?.name ??
                    product?.product_name ??
                    product?.name
                  }
                  width={400}
                  height={400}
                  className={`absolute inset-0 w-full h-full object-contain p-2.5 transition-opacity duration-500 ease-out ${
                    idx === hoverImgIdx ? "opacity-100" : "opacity-0"
                  } ${isProductAvailabel || storeClosed ? "grayscale" : ""}`}
                  sizes="(max-width: 640px) 40vw, 200px"
                  quality={75}
                  priority={idx === 0}
                />
              ))}
            </div>
          ) : (
            <ImageWithPlaceholder
              src={product?.image_url}
              alt={
                product?.translations?.name ??
                product?.product_name ??
                product?.name
              }
              width={400}
              height={400}
              className={`w-full h-full object-contain p-2.5 transition-all duration-200 ${
                isProductAvailabel || storeClosed ? "grayscale" : ""
              }`}
              sizes="(max-width: 640px) 40vw, 200px"
              quality={75}
            />
          )}
        </div>

        {/* vertical divider between image and content — API-themed hairline. */}
        <div
          className="hidden sm:block self-stretch w-px my-1"
          style={{
            background:
              "color-mix(in srgb, var(--primary-color) 14%, transparent)",
          }}
        />

        {/* Content */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* {product?.category_name && (
            <span className="text-[11px] font-medium text-gray-400 line-clamp-1">
              {product.category_name}
            </span>
          )} */}

          <h3 className="text-sm sm:text-base font-bold capitalize line-clamp-1 textColor group-hover:primaryColor">
            {product?.translations?.name ??
              product?.product_name ??
              product?.name}
          </h3>

          {showQuickDelivery && (
            <span className="inline-flex w-fit items-center gap-1 rounded-md bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-300">
              <TimeIcon size={12} className="primaryColor dark:text-zinc-200" />
              {t("delivery_in")} {deliveryLabel}
            </span>
          )}

          {!!product?.product_rating && Number(product?.rating_count) > 0 && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar
                    key={star}
                    size={12}
                    className={
                      star <= Math.round(product?.average_rating || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200 dark:fill-zinc-600 dark:text-zinc-600"
                    }
                  />
                ))}
              </div>
              <span className="text-gray-400">
                ({Number(product?.average_rating || 0).toFixed(1)})
              </span>
              <span className="line-clamp-1">
                ({product?.rating_count} {t("reviews")})
              </span>
            </div>
          )}

          <FewLeftBadge
            variant={selectedVariant}
            product={product}
            className="mt-0.5"
          />

          {/* Price */}
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight textColor">
              {money(
                hasDiscount
                  ? selectedVariant?.discounted_price
                  : selectedVariant?.price,
              )}
            </span>
            {hasDiscount && (
              <span className="text-xs line-through text-gray-400 dark:text-zinc-500">
                {money(selectedVariant?.price)}
              </span>
            )}
          </div>

          {/* Actions — pinned to the bottom (mt-auto) so the ADD row lines up
              across cards regardless of how much text each card has. */}
          <div className="mt-auto pt-2 flex items-center gap-2">
            {/* like + view inline — mobile/tablet only (desktop uses image overlay) */}
            <button
              type="button"
              onClick={handleProductLikes}
              aria-label={t("wishlist")}
              className="relative flex lg:hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg buttonBackground hover:primaryBorder transition-transform active:scale-90"
            >
              {likeBurst && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="like-particle"
                      style={{ "--i": i }}
                    />
                  ))}
                </span>
              )}
              <span
                className={`relative z-10 flex items-center justify-center ${
                  likeBurst ? "like-pop" : ""
                }`}
              >
                {liked ? (
                  <BiSolidHeart size={18} className="primaryFilledColor" />
                ) : (
                  <BiHeart size={18} className="svgColors hover:primaryColor" />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              aria-label={t("quick_view")}
              className="flex lg:hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg buttonBackground hover:primaryBorder"
            >
              <FaRegEye size={16} className="svgColors hover:primaryColor" />
            </button>
            {isProductAvailabel ? (
              <div className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-sm font-semibold text-gray-400 dark:text-zinc-500">
                {t("out_of_stock")}
              </div>
            ) : (
              <>
                {showStepper ? (
                  <div
                    {...closedProps}
                    className={`flex h-10 flex-1 min-w-0 basis-0 items-center justify-between overflow-hidden rounded-lg primaryBackColor text-white ${closedProps.className ?? ""}`}
                  >
                    <button
                      className="flex h-full w-9 shrink-0 items-center justify-center"
                      aria-label={t("decrease")}
                      onClick={guardClosed(handleQuantityDecrease)}
                    >
                      <FaMinus size={12} />
                    </button>
                    <span className="text-sm font-bold">
                      {cart?.isGuest ? addedQuantity : serverDisplayQty}
                    </span>
                    <button
                      className="flex h-full w-9 shrink-0 items-center justify-center disabled:opacity-40"
                      aria-label={t("increase")}
                      onClick={guardClosed(handleQuantityIncrease)}
                      disabled={hasReachedAllowedQty(
                        cart?.isGuest ? addedQuantity : serverDisplayQty,
                        product?.total_allowed_quantity,
                      )}
                      aria-disabled={hasReachedAllowedQty(
                        cart?.isGuest ? addedQuantity : serverDisplayQty,
                        product?.total_allowed_quantity,
                      )}
                    >
                      <FaPlus size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={guardClosed((e) =>
                      productsVariants?.length > 1
                        ? handleShowVariantModal(e, product)
                        : handleIntialAddToCart(e),
                    )}
                    {...closedProps}
                    className={`flex h-10 flex-1 min-w-0 basis-0 flex-col items-center justify-center rounded-lg border primaryBorderColor primaryColor bg-white dark:bg-zinc-900 text-sm font-semibold whitespace-nowrap hover:primaryLightBack transition px-3 ${closedProps.className ?? ""}`}
                  >
                    <span className="flex items-center gap-1.5 leading-none">
                      <MdAddShoppingCart size={16} className="shrink-0" />
                      {t("add")}
                    </span>
                    {productsVariants?.length > 1 && (
                      <span className="text-[9px] font-medium normal-case leading-none mt-0.5 opacity-80">
                        {productsVariants?.length} {t("options") || "options"}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Link>
      <ProductDetailModal
        product={product}
        showDetailModal={showProductDetail}
        setShowDetailModal={setShowProductDetail}
      />
      <VariantsModal
        product={product}
        showVariants={showVariants}
        setShowVariants={setShowVariants}
      />
    </div>
  );
};

export default ListViewProductCard;
