import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaStar, FaMinus, FaPlus, FaRegHeart, FaHeart } from "react-icons/fa";
import { MdAddShoppingCart } from "react-icons/md";
import Link from "next/link";
import { t } from "@/utils/translation";
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
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import FewLeftBadge from "./FewLeftBadge";
import TimeIcon from "./TimeIcon";
import { GoEye } from "react-icons/go";
import {
  hasReachedAllowedQty,
  formatCurrency,
  isVariantOutOfStock,
  getMaxAddableQuantity,
  getCartTotalQuantity,
} from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useZoneHref from "@/hooks/useZoneHref";
import useIsRtl from "@/hooks/useIsRtl";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";
import useCurrency from "@/hooks/useCurrency";
import type { FlushCtx } from "@/hooks/useDebouncedQuantity";

interface VerticleProductCardProps {
  /** Product, raw API shape. */
  product: any;
  largeImage?: boolean;
  radius?: number | string | null;
}

const VerticleProductCard = ({
  product,
  largeImage = false,
  radius = null,
}: VerticleProductCardProps) => {
  const zoneHref = useZoneHref();
  const rtl = useIsRtl();
  const dispatch = useDispatch();

  const cart = useSelector((state: any) => state.Cart);
  const setting = useSelector((state: any) => state.Setting.setting);
  // country_setting currently omits decimal_point, so the per-product
  // decimal_point (sent by the home-builder/products API) is passed as the
  // last-resort fallback — a zone value still wins once the backend sends one.
  const { currency, decimals } = useCurrency(product);
  const money = (val: number) => formatCurrency(val, currency, decimals, true);
  const city = useSelector((state: any) => state.City.city);
  const shopMode = useSelector((state: any) => state.ShopMode.mode);

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

  // The variant the card shows when nothing cart-specific overrides it: the
  // first in-stock one, else the first. Computed DURING RENDER, not in the
  // effect below, because effects never run on the server — the old
  // `useState([])` meant every server-rendered card printed ₹0 (and no discount
  // badge) and only got a real price after hydration, so that was the price
  // crawlers saw. Deriving it here makes the SSR HTML carry the true price.
  const defaultVariant = useMemo(() => {
    const variants = product?.variants;
    if (!Array.isArray(variants) || variants.length === 0) return undefined;
    const inStock = variants.find(
      (variant: any) => variant?.is_unlimited_stock === 0 && variant?.stock > 0,
    );
    return inStock ?? variants[0];
  }, [product?.variants]);

  // Seeded with the derived default so the first render (server AND client) has
  // a priced variant; the effect below only ever swaps it for a cart-specific
  // one, which is client-only state by nature.
  const [selectedVariant, setSelectedVariant] = useState<any>(defaultVariant);
  // Drives the like-button pop + particle burst on a fresh like.
  const [likeBurst, setLikeBurst] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);

  // Flipkart-style hover slideshow: cycle the product gallery while hovered.
  // Gallery = primary image_url + extra images[] (deduped). Single image → no-op.
  const galleryImages: string[] = useMemo(() => {
    const toUrl = (img: any) => (typeof img === "string" ? img : img?.image_url);
    const list = [
      product?.image_url,
      ...(product?.images || []).map(toUrl),
    ].filter(Boolean);
    return [...new Set(list)];
  }, [product?.image_url, product?.images]);

  const [hoverImgIdx, setHoverImgIdx] = useState(0);
  const hoverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    // variant: they inline-step, and the add/remove handlers key off
    // selectedVariant.id — if it drifts to a different variant than the one
    // server-side, remove fires the wrong product_variant_id and the API
    // 0-returns "No item(s) found in users cart".
    if (!isMultiVariant) {
      const cartList = cart?.isGuest ? cart?.guestCart : cart?.cartProducts;
      const inCart = product?.variants?.find((variant: any) =>
        cartList?.some((c: any) => c?.product_variant_id == variant?.id),
      );
      if (inCart) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected variant with the cart's current line for this product
        setSelectedVariant(inCart);
        return;
      }
    }
    setSelectedVariant(defaultVariant);
    // Recompute when the product or its cart presence changes (re-fetch, channel
    // switch, remount with a reused key) so selection never goes stale.
  }, [
    product?.id,
    product?.variants,
    defaultVariant,
    cart?.isGuest,
    cart?.cartProducts,
    cart?.guestCart,
  ]);

  const calculateDiscount = (discountPrice: number, actualPrice: number) => {
    const difference = actualPrice - discountPrice;
    const actualDiscountPrice = difference / actualPrice;
    return actualDiscountPrice * 100;
  };

  const getProductQuantities = (products: any[]) => {
    return Object.entries(
      products?.reduce((quantities: Record<string, number>, product: any) => {
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
  const addToCart = async (
    productId: number | string,
    productVId: number | string,
    qty: number,
    ctx?: FlushCtx,
  ) => {
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
        const serverCart = response?.data?.cart?.map((item: any) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCart({ data: response }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      } else {
        toast.error(response.message);
        // Signals the debounced-quantity hook to revert its optimistic qty —
        // this commit never actually landed.
        throw new Error(response?.message || "addToCart failed");
      }
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  };

  const removeFromCart = async (
    productId: number | string,
    variantId: number | string,
    units: number = 1,
    ctx?: FlushCtx,
  ) => {
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
        const serverCart = response?.data?.cart?.map((item: any) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
      } else {
        toast.error(response.message);
        // Signals the debounced-quantity hook to revert its optimistic qty —
        // this commit never actually landed.
        throw new Error(response?.message || "removeFromCart failed");
      }
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  };

  const AddToGuestCart = (
    product: any,
    productId: number | string,
    productVariantId: number | string,
    Qty: number,
    isExisting: number,
    flag: "add" | "remove",
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
        updatedProducts = cart?.guestCart?.map((product: any) => {
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
          (product: any) =>
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
    productQuantity: any[],
    product: any,
    quantity: number,
  ) => {
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_id == product?.id,
    )?.qty;

    const maxAddableExisting = getMaxAddableQuantity({
      maxCartItemsCount: setting?.max_cart_items_count,
      otherLinesQty: getCartTotalQuantity(cart?.guestCart) - (productQty || 0),
      totalAllowedQty: product?.total_allowed_quantity,
      isUnlimitedStock: selectedVariant?.is_unlimited_stock != 0,
      stock: selectedVariant?.stock,
    });

    if (Number(product.is_unlimited_stock !== 0)) {
      if (hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
        toast.error(t("max_cart_limit_error"));
      } else if (Number(productQty) >= maxAddableExisting) {
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
      } else if (Number(productQty) >= maxAddableExisting) {
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

  const handleAddNewProductGuest = (productQuantity: any[], product: any) => {
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_id == product?.id,
    )?.qty;
    const variantDisabled =
      selectedVariant?.status !== undefined &&
      Number(selectedVariant?.status) === 0;

    const maxAddableNew = getMaxAddableQuantity({
      maxCartItemsCount: setting?.max_cart_items_count,
      otherLinesQty: getCartTotalQuantity(cart?.guestCart),
      totalAllowedQty: product?.total_allowed_quantity,
      isUnlimitedStock: selectedVariant?.is_unlimited_stock != 0,
      stock: selectedVariant?.stock,
    });

    if (isVariantOutOfStock(selectedVariant) || variantDisabled) {
      toast.error(t("out_of_stock_message"));
    } else if (
      !hasReachedAllowedQty(
        Number(productQty || 0),
        product.total_allowed_quantity,
      )
    ) {
      if (maxAddableNew <= 0) {
        toast.error(t("maximum_cart_quantity_reach"));
      } else {
        AddToGuestCart(product, product?.id, selectedVariant?.id, 1, 0, "add");
      }
    } else {
      toast.error(t("out_of_stock_message"));
    }
  };

  const handleValidateAddNewProduct = (productQuantity: any[], product: any) => {
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_id == product?.id,
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
    } else if (
      getMaxAddableQuantity({
        maxCartItemsCount: setting?.max_cart_items_count,
        otherLinesQty: getCartTotalQuantity(cart?.cartProducts),
        totalAllowedQty: product?.total_allowed_quantity,
        isUnlimitedStock: selectedVariant?.is_unlimited_stock != 0,
        stock: selectedVariant?.stock,
      }) <= 0
    ) {
      toast.error(t("maximum_cart_quantity_reach"));
    } else {
      addToCart(product?.id, selectedVariant?.id, 1);
    }
  };

  const handleIntialAddToCart = (e: React.MouseEvent) => {
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

  // NOTE: dead code (pre-existing) — this function is defined but never called
  // anywhere in this file; the increment path goes through useDebouncedQuantity's
  // serverIncrement instead. Typed as-is, not removed (zero behavior change).
  const handleValidateAddExistingProduct = (productQuantity: any[], product: any) => {
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_id == product?.id,
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
        product?.id,
        selectedVariant?.id,
        (cart?.cartProducts?.find(
          (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty || 0) + 1,
      );
    }
  };

  const handleQuantityIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      const productQuantity = getProductQuantities(cart?.guestCart);
      handleValidateAddExistingGuestProduct(
        productQuantity,
        product,
        cart?.guestCart?.find(
          (prdct: any) =>
            prdct?.product_id == product?.id &&
            prdct?.product_variant_id == selectedVariant?.id,
        )?.qty + 1,
      );
    } else {
      serverIncrement();
    }
  };

  const handleQuantityDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cart?.isGuest) {
      AddToGuestCart(
        product,
        product?.id,
        selectedVariant?.id,
        cart?.guestCart?.find(
          (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty - 1,
        1,
        "remove",
      );
    } else {
      serverDecrement();
    }
  };

  const handleShowVariantModal = (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.variants.length > 1) {
      setShowVariants(true);
    } else {
      return;
    }
  };

  const handleShowDetailModal = (e: React.MouseEvent) => {
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

  // Upper bound for the stepper: effective_max = MIN(remaining store-wide cart
  // capacity, per-product allowed quantity, available stock). otherLinesQty
  // excludes this line's own qty so it isn't subtracted from its own headroom.
  const otherLinesQty =
    getCartTotalQuantity(cart?.cartProducts) - (addedQuantity || 0);
  const maxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.max_cart_items_count,
    otherLinesQty,
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: selectedVariant?.is_unlimited_stock != 0,
    stock: selectedVariant?.stock,
  });

  const guestMaxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.max_cart_items_count,
    otherLinesQty:
      getCartTotalQuantity(cart?.guestCart) -
      (cart?.guestCart?.find(
        (prdct) => prdct?.product_variant_id == selectedVariant?.id,
      )?.qty || 0),
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: selectedVariant?.is_unlimited_stock != 0,
    stock: selectedVariant?.stock,
  });

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
    isVariantOutOfStock(selectedVariant) ||
    (selectedVariant?.status !== undefined &&
      Number(selectedVariant?.status) === 0) ||
    (product?.status !== undefined && Number(product?.status) === 0);

  const hasDiscount =
    selectedVariant?.discounted_price !== 0 &&
    selectedVariant?.discounted_price !== selectedVariant?.price;
  // Discount badge label: exact % from API variant, else computed. Rounded to int.
  const discountPercent = hasDiscount
    ? Math.round(
        selectedVariant?.discount_percent ??
          product?.discount_percent ??
          calculateDiscount(
            selectedVariant?.discounted_price,
            selectedVariant?.price,
          ),
      )
    : null;

  const sellerName =
    product?.brand_name ??
    product?.store_name ??
    product?.seller?.store_name ??
    "";

  // Recommendation/similar payloads carry `rating`, not `average_rating`; read
  // whichever is present so stars fill (was reading only `average_rating` → empty
  // stars despite a non-zero rating_count).
  const ratingValue = Math.round(
    Number(product?.average_rating ?? product?.rating ?? 0),
  );

  // Ratings are opt-in per product. `product_rating` can arrive as true/1/"1"
  // depending on the backend, so coerce loosely instead of strict `== true`.
  const showRating =
    !!product?.product_rating && Number(product?.rating_count) > 0;

  return (
    <div className="relative h-full">
      <Link
        href={zoneHref(`/product/${product?.slug}`)}
        prefetch={false}
        style={{
          ...(radius != null ? { borderRadius: radius } : {}),
          // Border tinted from the API theme (--primary-color) — soft hairline.
          borderColor:
            "color-mix(in srgb, var(--primary-color) 18%, transparent)",
        }}
        className={`group flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-200 ${
          isProductAvailabel ? "cursor-not-allowed" : ""
        }`}
        onMouseEnter={startHoverSlide}
        onMouseLeave={stopHoverSlide}
      >
        {/* Image — inset on a light rounded panel (card-style image area) */}
        <div className="relative p-2">
          {/* Discount badge — corner triangle ribbon (on the outer corner) */}
          {hasDiscount && (discountPercent ?? 0) > 0 && (() => {
            const offLabel = `${discountPercent}% ${t("off")}`;
            // Card wrapper below is overflow-hidden (rounded corners + hover
            // zoom), so the ribbon can't grow wider than the card no matter
            // what — only long translations (pt "DESLIGADO") need a smaller
            // size to fit the fixed w-40 strip; short labels (en "OFF") stay
            // exactly as before.
            const isLong = offLabel.length > 10;
            return (
              <span
                className={`absolute top-4 z-10 w-40 transform-gpu ${isLong ? "overflow-hidden whitespace-nowrap" : ""} [backface-visibility:hidden] primaryBackColor py-1.5 text-center font-bold uppercase leading-none text-white shadow-md ${isLong ? "text-[9px] tracking-tight" : "text-[13px] tracking-wide"} ${rtl ? "-right-12 rotate-45" : "-left-12 -rotate-45"} ${closedDecorClass}`}
              >
                {offLabel}
              </span>
            );
          })()}
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-800">
            {galleryImages.length > 1 ? (
              // Stacked crossfade: active slide opaque, others fade in/out.
              <div className="relative h-full w-full transition-transform duration-300 ease-out group-hover:scale-110">
                {galleryImages.map((img, idx) => (
                  <ImageWithPlaceholder
                    key={img + idx}
                    className={`absolute inset-0 object-contain h-full w-full p-2.5 transition-opacity duration-500 ease-out ${
                      idx === hoverImgIdx ? "opacity-100" : "opacity-0"
                    } ${isProductAvailabel || storeClosed ? "grayscale" : ""}`}
                    alt={
                      product?.translations?.name ??
                      product?.product_name ??
                      product?.name
                    }
                    src={img}
                    width={300}
                    height={300}
                    priority={idx === 0}
                  />
                ))}
              </div>
            ) : (
              <ImageWithPlaceholder
                className={`object-contain h-full w-full p-2.5 transition-transform duration-300 ease-out group-hover:scale-110 ${
                  isProductAvailabel || storeClosed ? "grayscale" : ""
                }`}
                alt={
                  product?.translations?.name ??
                  product?.product_name ??
                  product?.name
                }
                src={product?.image_url}
                width={300}
                height={300}
                // No `priority` — see HomeVerticleProductCard: one per grid
                // tile, so preloading them all hurts the actual LCP image.
              />
            )}
            {/* quick-delivery time — overlay, quick channel only. Frosted Blinkit pill. */}
            {showQuickDelivery && (
              <span
                className={`absolute bottom-2 z-10 inline-flex items-center gap-1 rounded-md bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-gray-800 dark:text-zinc-100 shadow-sm ring-1 ring-black/5 ${rtl ? "right-2" : "left-2"}`}
              >
                <TimeIcon size={12} className="primaryColor" />
                {deliveryLabel}
              </span>
            )}
          </div>

          {/* bookmark + quick-view — top-right, show on hover. Stay fully visible + clickable
              even when the card is dimmed for out-of-stock. */}
          <div
            className={`absolute top-3 z-20 flex flex-col gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 cursor-pointer ${rtl ? "left-3" : "right-3"}`}
          >
            <button
              type="button"
              onClick={handleProductLikes}
              aria-label={t("wishlist")}
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow transition-transform active:scale-90 hover:scale-110"
            >
              {likeBurst && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="like-particle"
                      style={{ "--i": i } as React.CSSProperties}
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
                  <FaHeart size={14} className="primaryColor" />
                ) : (
                  <FaRegHeart
                    size={14}
                    className="text-gray-600 dark:text-zinc-300"
                  />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              aria-label={t("quick_view")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow"
            >
              <GoEye size={15} className="text-gray-600 dark:text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Details — each row has a RESERVED height so every card is the same
            size and the price rows line up across a row. */}
        <div className="flex grow flex-col px-2 pt-1 pb-0 md:px-3">
          {/* category eyebrow — single-line truncate with ellipsis (long names like
              "MEN SMOOTHING" were clipped mid-word by the old fixed 12px box).
              block + min-h keeps every card the same height when category is absent. */}
          <span className="block min-h-[13px] text-[9px] md:text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 truncate leading-tight">
            {product?.category_name || ""}
          </span>

          {/* name — single line keeps the card compact and the price row aligned */}
          <h3 className="mt-0.5 textColor text-[12px] md:text-[13px] font-semibold leading-snug line-clamp-1 capitalize group-hover:primaryColor dark:group-hover:text-white">
            {product?.translations?.name ??
              product?.product_name ??
              product?.name}
          </h3>

          {/* Rating row. Rendered ONLY when this product is rated — the row used
              to reserve h-[14px] unconditionally to keep price rows aligned, but
              the details column is `grow` and the price row is `mt-auto`, so the
              prices already line up without it. Reserving the height meant a
              catalogue with no ratings at all left an empty 14px band on every
              card. */}
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

          {/* price (left) + add control (right) — pinned to bottom.
              No `flex-wrap`: the Add control is shrink-0 at 84px, so a wide
              price (₹50000) used to push it onto its own line, making that card
              a row taller than its neighbours in a carousel. The price block
              shrinks and truncates instead, keeping the row one line high. */}
          <div className="mt-auto flex items-end justify-between gap-x-1.5 pt-1.5 pb-1.5">
            <div className="flex min-w-0 shrink-0 flex-col leading-tight">
              <span className="textColor text-[13px] md:text-[15px] font-extrabold whitespace-nowrap">
                {money(
                  hasDiscount
                    ? selectedVariant?.discounted_price
                    : selectedVariant?.price,
                )}
              </span>
              {/* Reserve the strike-through line even without a discount so every
                  card's price block is the same height. */}
              <span
                className={`SecondaryTextColor text-[11px] md:text-[12px] truncate ${hasDiscount ? "line-through" : "invisible"}`}
              >
                {hasDiscount ? money(selectedVariant?.price) : "0"}
              </span>
            </div>

            {isProductAvailabel ? (
              <span className="flex h-8 md:h-9 w-auto min-w-0 md:min-w-[92px] shrink items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-2 text-[10px] md:text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500 text-center leading-tight">
                {t("out_of_stock")}
              </span>
            ) : showStepper ? (
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                {...closedProps}
                className={`flex h-8 md:h-9 w-[84px] md:w-[92px] shrink-0 items-center justify-between rounded-lg primaryBackColor text-white ${closedProps.className ?? ""}`}
              >
                <button
                  type="button"
                  onClick={guardClosed(handleQuantityDecrease)}
                  aria-label={t("decrease")}
                  className="flex h-full w-8 items-center justify-center"
                >
                  <FaMinus size={11} />
                </button>
                <span className="min-w-[14px] text-center text-sm font-bold">
                  {cart?.isGuest ? addedQuantity : serverDisplayQty}
                </span>
                <button
                  type="button"
                  onClick={guardClosed(handleQuantityIncrease)}
                  aria-label={t("increase")}
                  disabled={
                    (cart?.isGuest ? addedQuantity : serverDisplayQty) >=
                    (cart?.isGuest ? guestMaxQty : maxQty)
                  }
                  aria-disabled={
                    (cart?.isGuest ? addedQuantity : serverDisplayQty) >=
                    (cart?.isGuest ? guestMaxQty : maxQty)
                  }
                  className="flex h-full w-8 items-center justify-center disabled:opacity-40"
                >
                  <FaPlus size={11} />
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
                aria-label={t("add")}
                {...closedProps}
                className={`flex h-8 md:h-9 w-auto min-w-0 md:min-w-[92px] shrink flex-col items-center justify-center rounded-lg border primaryBorderColor primaryColor bg-white dark:bg-zinc-900 px-1.5 md:px-2 text-[13px] md:text-[14px] font-semibold whitespace-nowrap hover:primaryLightBack transition ${closedProps.className ?? ""}`}
              >
                <span className="flex items-center gap-1 leading-none">
                  <MdAddShoppingCart size={14} className="shrink-0" />
                  {t("add")}
                </span>
                {productsVariants?.length > 1 && (
                  <span className="text-[9px] font-medium normal-case leading-none mt-0.5 opacity-80">
                    {productsVariants?.length} {t("options") || "options"}
                  </span>
                )}
              </button>
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

export default VerticleProductCard;
