import React, { useEffect, useState, useRef, useMemo } from "react";
import { t } from "@/utils/translation";
import { FaMinus, FaPlus, FaRegEye, FaStar } from "react-icons/fa";
import { MdAddShoppingCart } from "react-icons/md";
import Link from "next/link";
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
  getMaxAddableQuantity,
  getCartTotalQuantity,
} from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";
import useCurrency from "@/hooks/useCurrency";
import type { FlushCtx } from "@/hooks/useDebouncedQuantity";

interface HomeListViewCardProps {
  /** Product, raw API shape. */
  product: any;
  radius?: number | string | null;
}

const HomeListViewCard = ({
  product,
  radius = null,
}: HomeListViewCardProps) => {
  const zoneHref = useZoneHref();
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

  // Seed from the first variant SYNCHRONOUSLY so the price renders on the server
  // (and the first client paint) instead of 0 until the effect runs post-mount.
  // The effect then refines to the in-stock / in-cart variant. Same value server
  // + first client render → no hydration mismatch.
  const [selectedVariant, setSelectedVariant] = useState<any>(
    () => product?.variants?.[0] ?? [],
  );
  const [showVariants, setShowVariants] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);
  // Drives the like-button pop + particle burst on a fresh like.
  const [likeBurst, setLikeBurst] = useState(false);

  // Flipkart-style hover slideshow: cycle the product gallery while hovered.
  // Gallery = primary image_url + extra images[] (deduped). Single image → no-op.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- compiler infers product.images alone; deps intentionally include product?.image_url too since it also feeds the list
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
    }, 2400);
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
      const inCart = product?.variants?.find((variant: any) =>
        cartList?.some((c: any) => c?.product_variant_id == variant?.id),
      );
      if (inCart) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected variant with the cart's current line for this product
        setSelectedVariant(inCart);
        return;
      }
    }
    const inStockVariant = product?.variants?.find(
      (variant: any) => variant?.is_unlimited_stock === 0 && variant?.stock > 0,
    );
    setSelectedVariant(inStockVariant ?? product?.variants?.[0]);
  }, [
    product?.id,
    product?.variants,
    cart?.isGuest,
    cart?.cartProducts,
    cart?.guestCart,
  ]);

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
        AddToGuestCart(product, product.id, selectedVariant?.id, 1, 0, "add");
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
      addToCart(product.id, selectedVariant?.id, 1);
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
  // Mirrors the identical dead function in VerticleProductCard.tsx.
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
        product.id,
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

  const productsVariants = product.variants;

  const isProductAlreadyAdded =
    (cart?.isGuest === false &&
      cart?.cartProducts?.find(
        (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
      )?.qty > 0) ||
    (cart?.isGuest === true &&
      cart?.guestCart?.find(
        (prdct: any) => prdct?.product_variant_id === selectedVariant?.id,
      )?.qty > 0);

  const addedQuantity =
    cart.isGuest === false
      ? cart?.cartProducts?.find(
          (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
        )?.qty
      : cart?.guestCart?.find(
          (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
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
        (prdct: any) => prdct?.product_variant_id == selectedVariant?.id,
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
    (product?.variants?.length <= 1 &&
      product?.variants?.[0]?.is_unlimited_stock == 0 &&
      product?.variants?.[0]?.stock == 0) ||
    (selectedVariant?.stock <= 0 && selectedVariant?.is_unlimited_stock == 0) ||
    selectedVariant?.status == 0 ||
    product?.status == 0;

  const hasDiscount =
    selectedVariant?.discounted_price !== 0 &&
    selectedVariant?.discounted_price !== selectedVariant?.price;
  // Discount % comes straight from the API. It sits on the product (some payloads
  // also echo it on the variant). No static/computed fallback — hidden if 0/absent.
  const discountPercent =
    Number(selectedVariant?.discount_percent ?? product?.discount_percent) ||
    null;

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
        className={`relative flex h-full flex-row items-center w-full gap-3 sm:gap-4 p-2.5 sm:p-3 group border bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out ${
          isProductAvailabel ? "cursor-pointer" : ""
        }`}
        onMouseEnter={startHoverSlide}
        onMouseLeave={stopHoverSlide}
      >
        {/* Discount ribbon — hangs from the card's top-left corner with a wavy
            bottom edge. Shown only when the API sends a percent. */}
        {discountPercent && (
          <div
            className={`absolute top-0 left-4 z-10 drop-shadow-md ${closedDecorClass}`}
          >
            <div className="primaryBackColor text-white text-center px-1.5 pt-1 pb-0.5">
              <span className="block text-[11px] md:text-[13px] font-extrabold leading-none">
                {discountPercent}%
              </span>
              <span className="block text-[8px] md:text-[9px] font-semibold uppercase tracking-wide leading-none mt-0.5">
                {t("off")}
              </span>
            </div>
            <svg
              className="block w-full primaryColor"
              height="6"
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
        {/* Image */}
        <div className="relative shrink-0 w-24 h-24 sm:w-32 sm:h-32 overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900">
          {galleryImages.length > 1 ? (
            // Hover slideshow via CROSS-FADE, not remount. All gallery images are
            // stacked; only the active one is opacity-1. The previous image stays
            // painted underneath during the fade, so there's no white flash/blink
            // between swaps. Scale-on-hover stays on the wrapper.
            <div className="relative h-full w-full transition-transform duration-300 ease-out group-hover:scale-110">
              {galleryImages.map((imgSrc, idx) => (
                <ImageWithPlaceholder
                  key={idx}
                  src={imgSrc}
                  alt={product?.name}
                  width={400}
                  height={400}
                  className={`absolute inset-0 w-full h-full object-contain p-3 transition-opacity duration-700 ease-in-out ${
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
              alt={product?.name}
              width={400}
              height={400}
              className={`w-full h-full object-contain p-3 transition-transform duration-300 ease-out group-hover:scale-110 ${isProductAvailabel || storeClosed ? "grayscale" : ""}`}
              sizes="(max-width: 640px) 40vw, 200px"
              quality={75}
            />
          )}

          {/* wishlist + quick view — desktop-only overlay revealed on hover.
              Hidden on mobile to keep the compact list row uncluttered. */}
          <div className="absolute top-1.5 right-1.5 z-20 hidden lg:flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer">
            <button
              type="button"
              onClick={handleProductLikes}
              aria-label={t("wishlist")}
              className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur shadow-md ring-1 ring-black/5 transition-transform duration-200 hover:scale-110 active:scale-95"
            >
              {/* Myntra-style particle burst on a fresh like. */}
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
                  <BiSolidHeart size={14} className="primaryFilledColor" />
                ) : (
                  <BiHeart size={14} className="svgColors" />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              aria-label={t("quick_view")}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur shadow-md ring-1 ring-black/5 transition-transform duration-200 hover:scale-110 active:scale-95"
            >
              <FaRegEye size={13} className="svgColors" />
            </button>
          </div>
        </div>

        {/* vertical divider between image and details — API-themed hairline. */}
        <div
          className="hidden sm:block self-stretch w-px my-1"
          style={{
            background:
              "color-mix(in srgb, var(--primary-color) 14%, transparent)",
          }}
        />

        {/* Details + Actions wrapper — stacks on mobile, side-by-side on lg */}
        <div className="flex flex-1 min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          {/* Details */}
          <div className="flex flex-1 min-w-0 flex-col">
            {product?.category_name && (
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 line-clamp-1">
                {product.category_name}
              </span>
            )}

            <h3 className="textColor text-sm sm:text-base font-bold capitalize line-clamp-1 sm:line-clamp-2 transition-colors duration-200 group-hover:primaryColor dark:group-hover:text-white">
              {product?.translations?.name ?? product?.name}
            </h3>

            {/* rating + delivery on one line */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {!!product?.product_rating &&
                Number(product?.rating_count) > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-zinc-200">
                    <FaStar size={11} className="text-amber-400" />
                    {Number(product?.average_rating).toFixed(1)}
                    <span className="font-normal text-gray-400 dark:text-zinc-500">
                      ({product?.rating_count})
                    </span>
                  </span>
                )}
              {showQuickDelivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-gray-700 dark:text-zinc-300">
                  {/* 12px, not the 9px the react-icons clock used: that icon was
                      a plain outline circle, while this artwork carries a bell,
                      feet and hands — at 9px the detail collapses into a smudge. */}
                  <TimeIcon
                    size={12}
                    className="primaryColor dark:text-zinc-200"
                  />
                  {deliveryLabel}
                </span>
              )}
            </div>

            {product?.short_description && (
              <p className="mt-1 text-[12px] sm:text-sm text-gray-500 dark:text-zinc-400 leading-snug line-clamp-1 lg:line-clamp-2">
                {product.short_description}
              </p>
            )}

            <FewLeftBadge
              variant={selectedVariant}
              product={product}
              className="mt-1"
            />

            {/* Price */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="textColor text-lg sm:text-xl font-extrabold tracking-tight">
                {money(
                  hasDiscount
                    ? selectedVariant?.discounted_price
                    : selectedVariant?.price,
                )}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xs sm:text-sm line-through SecondaryTextColor">
                    {money(selectedVariant?.price)}
                  </span>
                  {(discountPercent ?? 0) > 0 && (
                    <span className="text-[11px] sm:text-xs font-bold text-green-600 whitespace-nowrap">
                      {discountPercent}% {t("off")}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions — one row on mobile (wishlist + view sit inline with ADD),
              fixed-width right column on lg where the image overlay takes over. */}
          <div className="flex items-center gap-2 self-end lg:self-center lg:shrink-0">
            {/* Mobile-only wishlist + quick view — the image overlay is
                desktop-only, so surface them inline beside ADD on small screens. */}
            <button
              type="button"
              onClick={handleProductLikes}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-black/5 transition-transform duration-200 active:scale-90"
              aria-label={t("add_to_wishlist") || "Wishlist"}
            >
              {liked ? (
                <BiSolidHeart size={15} className="primaryFilledColor" />
              ) : (
                <BiHeart size={15} className="svgColors" />
              )}
            </button>
            <button
              type="button"
              onClick={handleShowDetailModal}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-black/5 transition-transform duration-200 active:scale-90"
              aria-label={t("quick_view") || "Quick view"}
            >
              <FaRegEye size={14} className="svgColors" />
            </button>

            {/* ADD / stepper — min width so long translated labels can grow it */}
            <div className="w-auto min-w-[76px] sm:min-w-[84px] shrink-0">
              {isProductAvailabel ? (
                <div className="flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 text-center leading-tight px-2">
                  {t("out_of_stock")}
                </div>
              ) : showStepper ? (
                <div
                  {...closedProps}
                  className={`flex h-9 w-full items-center justify-between overflow-hidden rounded-lg primaryBackColor text-white ${closedProps.className ?? ""}`}
                >
                  <button
                    className="flex h-full w-8 items-center justify-center"
                    aria-label={t("decrease")}
                    onClick={guardClosed(handleQuantityDecrease)}
                  >
                    <FaMinus size={11} />
                  </button>
                  <span className="text-sm font-bold">
                    {cart?.isGuest ? addedQuantity : serverDisplayQty}
                  </span>
                  <button
                    className="flex h-full w-8 items-center justify-center disabled:opacity-40"
                    aria-label={t("increase")}
                    onClick={guardClosed(handleQuantityIncrease)}
                    disabled={
                      (cart?.isGuest ? addedQuantity : serverDisplayQty) >=
                      (cart?.isGuest ? guestMaxQty : maxQty)
                    }
                    aria-disabled={
                      (cart?.isGuest ? addedQuantity : serverDisplayQty) >=
                      (cart?.isGuest ? guestMaxQty : maxQty)
                    }
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
                  {...closedProps}
                  className={`flex h-9 w-full flex-col items-center justify-center rounded-lg border primaryBorderColor primaryColor bg-white dark:bg-zinc-900 px-2 text-[13px] md:text-[14px] font-semibold whitespace-nowrap hover:primaryLightBack transition ${closedProps.className ?? ""}`}
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

export default HomeListViewCard;
