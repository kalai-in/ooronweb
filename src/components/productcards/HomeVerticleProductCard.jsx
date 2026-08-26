import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaStar, FaMinus, FaPlus, FaRegHeart, FaHeart } from "react-icons/fa";
import Link from "next/link";
import { t } from "@/utils/translation";
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
import { formatCurrency } from "@/utils/helperFunction";
import { toast } from "react-toastify";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import FewLeftBadge from "./FewLeftBadge";
import TimeIcon from "./TimeIcon";
import { GoEye } from "react-icons/go";
import { MdAddShoppingCart } from "react-icons/md";
import VariantsModal from "../variantsmodal/VariantsModal";
import {
  hasReachedAllowedQty,
  isVariantInStock,
  isVariantOutOfStock,
  isVariantUnlimitedStock,
  variantStock,
} from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";

const HomeVerticleProductCard = ({
  product,
  largeImage = false,
  radius = null,
}) => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();

  const cart = useSelector((state) => state.Cart);
  const setting = useSelector((state) => state.Setting.setting);
  const currency = product?.currency ?? setting?.currency;
  // Price decimals: prefer the product's own decimal_point (now sent per product),
  // then settings. formatCurrency renders the symbol + fixed fraction (150.00).
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
  // badge's *presence* differs between the two → hydration mismatch. Hold it
  // back until after mount so the first client render matches the server.
  const hydrated = useIsHydrated();
  const deliveryLabel = product?.time_to_deliver;
  const showQuickDelivery = hydrated && shopMode === "quick" && !!deliveryLabel;

  // Seed from the first variant SYNCHRONOUSLY so the price renders on the server
  // (and the first client paint) instead of showing 0 until the effect below
  // runs post-mount. The effect then refines this to the in-stock / in-cart
  // variant. Same value server + first client render → no hydration mismatch.
  const [selectedVariant, setSelectedVariant] = useState(
    () => product?.variants?.[0] ?? [],
  );
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  // Drives the like-button pop + burst animation. Set true on a fresh "like",
  // auto-cleared after the animation so it can retrigger next time.
  const [likeBurst, setLikeBurst] = useState(false);

  // Flipkart-style hover slideshow: cycle the product gallery while hovered.
  // Gallery = primary image_url + extra images[] (deduped). Single image → no-op.
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
    }, 1600);
  };

  const stopHoverSlide = () => {
    if (hoverTimerRef.current) {
      clearInterval(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverImgIdx(0);
  };

  // Clear the interval on unmount so a hovered card that unmounts mid-cycle
  // (filter change, route nav) doesn't leak a timer.
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
    // Prefer the first variant with stock. Uses tolerant helpers so string/
    // missing stock fields (thin recommendation payloads) don't fail the strict
    // `=== 0 && > 0` test and wrongly fall through to variants[0].
    const inStockVariant = product?.variants?.find((variant) =>
      isVariantInStock(variant),
    );
    setSelectedVariant(inStockVariant ?? product?.variants?.[0]);
  }, [
    product?.id,
    product?.variants,
    cart?.isGuest,
    cart?.cartProducts,
    cart?.guestCart,
  ]);

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
      // Out-of-order guard: drop this response if a newer +/- flush already fired,
      // so a slow earlier response can't overwrite the latest totals/qty.
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
        // `alreadyGone` (last item) returns no cart array → empty list.
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
    if (isVariantOutOfStock(selectedVariant)) {
      toast.error(t("out_of_stock_message"));
    } else if (
      !hasReachedAllowedQty(
        Number(productQty || 0),
        product.total_allowed_quantity,
      )
    ) {
      AddToGuestCart(product, product?.id, selectedVariant?.id, 1, 0, "add");
    } else {
      toast.error(t("out_of_stock_message"));
    }
  };

  const handleValidateAddNewProduct = (productQuantity, product) => {
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;

    // Stock is judged from the VARIANT via tolerant helpers (handles string /
    // missing fields in thin recommendation payloads). Only a definitively
    // out-of-stock variant blocks the add; an explicitly disabled variant
    // (status === 0) also blocks, but a MISSING status does not.
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
      addToCart(product?.id, selectedVariant?.id, 1);
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
    if (Number(product.is_unlimited_stock)) {
      if (!hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
        addToCart(
          product?.id,
          selectedVariant?.id,
          cart?.cartProducts?.find(
            (prdct) => prdct?.product_variant_id == selectedVariant?.id,
          )?.qty + 1,
        );
      } else {
        toast.error(t("max_cart_limit_error"));
      }
    } else {
      if (productQty >= Number(selectedVariant.stock)) {
        toast.error(t("out_of_stock_message"));
      } else if (
        hasReachedAllowedQty(Number(productQty), product.total_allowed_quantity)
      ) {
        toast.error(t("max_cart_limit_error"));
      } else {
        addToCart(
          product?.id,
          selectedVariant?.id,
          cart?.cartProducts?.find(
            (prdct) => prdct?.product_variant_id == selectedVariant?.id,
          )?.qty + 1,
        );
      }
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
      // Server cart: optimistic UI now, one debounced addToCart later.
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
      // Server cart: optimistic UI now, one debounced addToCart/removeFromCart
      // later (hook calls removeFromCart automatically when target hits 0).
      serverDecrement();
    }
  };

  const handleShowDetailModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowProductDetail(true);
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

  const productsVariants = product?.variants;

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
  // Tolerant of string/missing stock (thin recommendation payloads): unlimited
  // or missing stock → Infinity cap; only a real limited stock number caps.
  const stockCap = isVariantUnlimitedStock(selectedVariant)
    ? Infinity
    : variantStock(selectedVariant);
  const maxQty = Math.min(allowedCap, stockCap);

  // Stepper shows while the (optimistic) quantity is > 0; otherwise the Add
  // button. For guests this tracks the store directly.

  // Optimistic + debounced stepper for the SERVER cart (guest stays instant /
  // local). Commits one final addToCart / removeFromCart after clicks settle.
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

  // Gated on `hydrated`: the cart lives in redux-persist, so the server renders
  // the empty initial state (Add button) while the client rehydrates a populated
  // cart (stepper). Those are different ELEMENTS — <button> vs <div> — so React
  // throws a hydration mismatch and discards the tree. Render the server's view
  // on the first client pass; the stepper lands on the second.
  const showStepper =
    hydrated && (cart?.isGuest ? isProductAlreadyAdded : serverDisplayQty > 0);

  // NOTE: truthy means UN-available (out of stock / disabled). Uses tolerant
  // stock helpers so string/missing fields don't falsely flag as out of stock.
  // status/product.status only count when explicitly 0 (missing ≠ disabled).
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
      isVariantOutOfStock(product?.variants?.[0])) ||
    isVariantOutOfStock(selectedVariant) ||
    Number(selectedVariant?.status) === 0 ||
    Number(product?.status) === 0;

  const hasDiscount =
    selectedVariant?.discounted_price !== 0 &&
    selectedVariant?.discounted_price !== selectedVariant?.price;
  // Discount % comes straight from the API. It sits on the product (some payloads
  // also echo it on the variant). No static/computed fallback — hidden if 0/absent.
  const discountPercent =
    Number(selectedVariant?.discount_percent ?? product?.discount_percent) ||
    null;

  // The product-list payload exposes the average as `rating`; some responses use
  // `average_rating`. Take whichever is present so the stars fill correctly (the
  // card was reading only `average_rating`, which is absent here → empty stars
  // despite a non-zero rating_count).
  const ratingValue = Math.round(
    Number(product?.average_rating ?? product?.rating ?? 0),
  );

  // Ratings are opt-in per product. `product_rating` can arrive as true/1/"1"
  // depending on the backend, so coerce loosely instead of strict `== true`.
  const showRating =
    !!product?.product_rating && Number(product?.rating_count) > 0;

  return (
    <div
      style={{
        ...(radius != null ? { borderRadius: radius } : {}),
        // Border tinted from the API theme (--primary-color), soft so it reads as
        // a modern hairline rather than a hard outline.
        borderColor:
          "color-mix(in srgb, var(--primary-color) 18%, transparent)",
      }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
      onMouseEnter={startHoverSlide}
      onMouseLeave={stopHoverSlide}
    >
      {/* Discount ribbon — hangs from the top-left with a wavy bottom edge.
          Shown only when the API sends a percent. */}
      {discountPercent && (
        <div
          className={`absolute top-0 left-3 z-10 drop-shadow-md ${closedDecorClass}`}
        >
          <div className="primaryBackColor text-white text-center px-1 md:px-1.5 pt-0.5 md:pt-1 pb-0.5">
            <span className="block text-[9px] md:text-[12px] font-extrabold leading-none">
              {discountPercent}%
            </span>
            <span className="block text-[7px] md:text-[9px] font-semibold uppercase tracking-wide leading-none mt-0.5">
              {t("off")}
            </span>
          </div>
          <svg
            className="block w-full primaryColor"
            height="4"
            viewBox="0 0 40 6"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M0,0 Q2.5,6 5,0 Q7.5,6 10,0 Q12.5,6 15,0 Q17.5,6 20,0 Q22.5,6 25,0 Q27.5,6 30,0 Q32.5,6 35,0 Q37.5,6 40,0 Z"
            />
          </svg>
        </div>
      )}
      {/* Link wraps only image + text — action buttons MUST stay outside the
          anchor, else clicking +/- can fall through and navigate to the PDP. */}
      <Link
        href={zoneHref(`/product/${product?.slug}`)}
        prefetch={false}
        className={`flex grow flex-col ${isProductAvailabel ? "cursor-pointer" : ""}`}
      >
        {/* Image — Blinkit-style: product shown full (contain) on a soft panel */}
        <div className="relative p-1.5 md:p-2">
          <div className="relative aspect-[4/3] md:aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-800">
            {galleryImages.length > 1 ? (
              // Hover slideshow via CROSS-FADE, not remount. All gallery images
              // are stacked; only the active one is opacity-1. The previous image
              // stays painted underneath during the fade, so there's no white
              // flash/blink between swaps. Scale-on-hover stays on the wrapper.
              <div className="relative h-full w-full transition-transform duration-300 ease-out group-hover:scale-110">
                {galleryImages.map((imgSrc, idx) => (
                  <ImageWithPlaceholder
                    key={idx}
                    className={`absolute inset-0 object-contain h-full w-full p-1.5 md:p-2.5 transition-opacity duration-700 ease-in-out ${
                      idx === hoverImgIdx ? "opacity-100" : "opacity-0"
                    } ${isProductAvailabel || storeClosed ? "grayscale" : ""}`}
                    alt={product?.translations?.name ?? product?.name}
                    src={imgSrc}
                    width={300}
                    height={300}
                    priority={idx === 0}
                  />
                ))}
              </div>
            ) : (
              <ImageWithPlaceholder
                className={`object-contain h-full w-full p-1.5 md:p-2.5 transition-transform duration-300 ease-out group-hover:scale-110 ${isProductAvailabel || storeClosed ? "grayscale" : ""}`}
                alt={product?.translations?.name ?? product?.name}
                src={product?.image_url}
                width={300}
                height={300}
                // No `priority`. This renders once per product, so a bare
                // priority preloaded EVERY card in the grid at high priority —
                // which starves the real LCP element of bandwidth and disables
                // the lazy-loading these below-fold images should get.
              />
            )}
            {/* Desktop: ETA overlays the image. Mobile renders it below instead
                (see details block) so it never hides the product. */}
            {showQuickDelivery && (
              <span className="absolute bottom-2 left-2 z-10 hidden md:inline-flex items-center gap-1 rounded-md bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-gray-800 dark:text-zinc-100 shadow-sm ring-1 ring-black/5">
                <TimeIcon size={12} className="primaryColor" />
                {deliveryLabel}
              </span>
            )}
          </div>

          {/* bookmark + quick-view — top-right, reveal on hover */}
          <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-20 flex flex-col gap-1.5 md:gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 cursor-pointer">
            <button
              type="button"
              onClick={handleProductLikes}
              aria-label={t("wishlist") || "Wishlist"}
              className="like-btn relative flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow transition-transform active:scale-90 hover:scale-110"
            >
              {/* Myntra-style heart burst — ring flash + 6 radiating particles. */}
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
              {(() => {
                const HeartIcon = liked ? FaHeart : FaRegHeart;
                const color = liked
                  ? "primaryColor dark:text-zinc-200"
                  : "text-gray-600 dark:text-zinc-300";
                return (
                  <span
                    className={`relative z-10 flex items-center justify-center ${
                      likeBurst ? "like-pop" : ""
                    }`}
                  >
                    <HeartIcon size={11} className={`${color} md:hidden`} />
                    <HeartIcon
                      size={13}
                      className={`${color} hidden md:block`}
                    />
                  </span>
                );
              })()}
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              aria-label={t("quick_view")}
              className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow"
            >
              <GoEye
                size={12}
                className="text-gray-600 dark:text-zinc-300 md:hidden"
              />
              <GoEye
                size={14}
                className="text-gray-600 dark:text-zinc-300 hidden md:block"
              />
            </button>
          </div>

          {/* Featured pill — bottom-right */}
          {/* {product?.is_featured && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full primaryBackColor text-white text-[9px] font-semibold px-1.5 py-0.5">
              <FaStar size={8} /> Featured
            </span>
          )} */}
        </div>

        {/* Details (navigable) — name + rating. Each row has a RESERVED height so
            every card is the same size and the price rows line up across a row. */}
        <div className="flex grow flex-col px-2 pt-1 pb-0 md:px-3 md:pb-0">
          {/* ETA chip — mobile only (desktop shows it over the image). Sits in its
              own row below the image so it never covers the product. */}
          {showQuickDelivery && (
            <span className="md:hidden mb-0.5 inline-flex w-fit items-center gap-1 rounded-md primaryLightBack px-1.5 py-0.5 text-[10px] font-bold primaryColor">
              <TimeIcon size={12} className="primaryColor" />
              {deliveryLabel}
            </span>
          )}
          {/* category eyebrow — desktop only (hidden on mobile to save a row) */}
          <span className="hidden md:block h-[12px] text-[9px] md:text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 line-clamp-1 leading-none">
            {product?.category_name || ""}
          </span>

          {/* name — single line on mobile (Blinkit-style), reserved min-height keeps
              every card the same size so price rows align across a row. */}
          <h3 className="mt-0.5 textColor text-[12px] md:text-[13px] font-semibold leading-snug line-clamp-1 capitalize">
            {product?.translations?.name ?? product?.name}
          </h3>

          {/* Rating row — rendered only when the product is rated. Desktop used
              to reserve md:h-[14px] for card alignment, but that left an empty
              band on every card in a catalogue with no ratings at all; the price
              row's mt-auto in a grow column keeps cards aligned regardless. */}
          {showRating && (
            <div className="mt-0.5 flex items-center">
              <span className="flex items-center gap-0.5 text-[10px] md:text-[11px] text-gray-500 dark:text-zinc-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <FaStar
                    key={i}
                    size={11}
                    className={
                      i <= ratingValue
                        ? "text-yellow-400"
                        : "text-gray-300 dark:text-zinc-600"
                    }
                  />
                ))}
                <span className="text-gray-400 dark:text-zinc-500">
                  ({product?.rating_count})
                </span>
              </span>
            </div>
          )}

          <FewLeftBadge variant={selectedVariant} product={product} />
        </div>
      </Link>

      {/* price + ADD — OUTSIDE the Link so +/- never trigger navigation.
          Narrow 3-col mobile can't fit price + button side-by-side, so stack them
          (price above, full-width control below); md+ goes back to a single row. */}
      <div className="flex flex-row flex-wrap items-end justify-between gap-x-2 gap-y-1 px-2 py-1.5 md:px-3">
        <div className="flex min-w-0 flex-row md:flex-col flex-wrap items-baseline md:items-stretch gap-x-1.5 leading-tight">
          <span className="textColor text-[13px] md:text-[15px] font-extrabold whitespace-nowrap">
            {money(
              hasDiscount
                ? selectedVariant?.discounted_price
                : selectedVariant?.price,
            )}
          </span>
          {/* Strike-through original price — only when discounted. Inline beside the
              price on mobile (saves a row); md+ stacks it below. */}
          {hasDiscount && (
            <span className="SecondaryTextColor text-[11px] md:text-[12px] whitespace-nowrap line-through">
              {money(selectedVariant?.price)}
            </span>
          )}
        </div>

        {isProductAvailabel ? (
          <div className="flex h-8 md:h-9 w-full md:w-auto md:min-w-[92px] shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[10px] md:text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500 text-center leading-tight px-2">
            {t("out_of_stock")}
          </div>
        ) : product?.variants?.length > 1 ? (
          // Multi-variant: Blinkit-style outlined ADD (icon + label) with an
          // "N options" subtext. Routes through the variant picker modal.
          <button
            type="button"
            onClick={guardClosed((e) => handleShowVariantModal(e, product))}
            {...closedProps}
            className={`flex h-8 md:h-9 w-full md:w-auto md:min-w-[92px] shrink-0 flex-col items-center justify-center rounded-lg border primaryBorderColor primaryColor bg-white dark:bg-zinc-900 px-2 text-[13px] md:text-[14px] font-semibold whitespace-nowrap hover:primaryLightBack transition ${closedProps.className ?? ""}`}
          >
            <span className="flex items-center gap-1 leading-none">
              <MdAddShoppingCart size={14} className="shrink-0" />
              {t("add")}
            </span>
            <span className="text-[9px] font-medium normal-case leading-none mt-0.5 opacity-80">
              {product?.variants?.length} {t("options") || "options"}
            </span>
          </button>
        ) : showStepper ? (
          <div
            {...closedProps}
            className={`flex h-8 md:h-9 w-[92px] shrink-0 items-center justify-between rounded-lg primaryBackColor text-white ${closedProps.className ?? ""}`}
          >
            <button
              type="button"
              onClick={guardClosed(handleQuantityDecrease)}
              aria-label={t("decrease")}
              className="flex h-full w-8 items-center justify-center"
            >
              <FaMinus size={11} />
            </button>
            <span className="min-w-[14px] text-center text-[13px] md:text-[14px] font-bold">
              {cart?.isGuest ? addedQuantity : serverDisplayQty}
            </span>
            <button
              type="button"
              onClick={guardClosed(handleQuantityIncrease)}
              disabled={hasReachedAllowedQty(
                cart?.isGuest ? addedQuantity : serverDisplayQty,
                product?.total_allowed_quantity,
              )}
              aria-disabled={hasReachedAllowedQty(
                cart?.isGuest ? addedQuantity : serverDisplayQty,
                product?.total_allowed_quantity,
              )}
              aria-label={t("increase")}
              className="flex h-full w-8 items-center justify-center disabled:opacity-40"
            >
              <FaPlus size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={guardClosed((e) => handleIntialAddToCart(e))}
            {...closedProps}
            className={`flex h-8 md:h-9 w-full md:w-auto md:min-w-[92px] shrink-0 items-center justify-center gap-1 rounded-lg border primaryBorderColor primaryColor bg-white dark:bg-zinc-900 px-2 text-[13px] md:text-[14px] font-semibold whitespace-nowrap hover:primaryLightBack transition ${closedProps.className ?? ""}`}
          >
            <MdAddShoppingCart size={14} className="shrink-0" />
            {t("add")}
          </button>
        )}
      </div>

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

export default HomeVerticleProductCard;
