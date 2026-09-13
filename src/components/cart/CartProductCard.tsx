import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  addtoGuestCart,
  clearCartPromo,
  setCart,
  setCartProducts,
  setCartPromo,
  setCartSubTotal,
  setGuestCartTotal,
} from "@/redux/slices/cartSlice";
import { toast } from "react-toastify";
import { BiTrash } from "react-icons/bi";
import { FaMinus, FaPlus } from "react-icons/fa";
import { TbDiscount } from "react-icons/tb";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { t } from "@/utils/translation";
import {
  formatCurrency,
  hasReachedAllowedQty,
  getCartTotalQuantity,
  getMaxAddableQuantity,
} from "@/utils/helperFunction";
import { useDebouncedQuantity, FlushCtx } from "@/hooks/useDebouncedQuantity";
import useStoreClosed from "@/hooks/useStoreClosed";
import useCurrency from "@/hooks/useCurrency";
// PrescriptionUpload.jsx (src/components/prescription/, out of scope for this
// migration batch) is still untyped JS; under this project's allowJs/checkJs:false
// config TS misinfers its exported component type from its JSDoc param comments as
// `(string | number)` rather than a proper prop type. Cast to `any` at the import
// boundary rather than touch a file outside this batch's scope.
import PrescriptionUploadRaw from "@/components/prescription/PrescriptionUpload";
const PrescriptionUpload = PrescriptionUploadRaw as any;

interface StepperProps {
  closedProps: Record<string, any>;
  addedQuantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  pending: boolean;
  atMax: boolean;
}

const Stepper = ({
  closedProps,
  addedQuantity,
  onDecrease,
  onIncrease,
  pending,
  atMax,
}: StepperProps) => (
  <div
    {...closedProps}
    className={`flex items-center cardBorder rounded-full overflow-hidden ${closedProps.className ?? ""}`}
  >
    <button
      type="button"
      className="w-8 h-8 flex items-center justify-center primaryColor hover:primaryLightBack disabled:opacity-30 transition"
      onClick={onDecrease}
      disabled={addedQuantity <= 1}
      aria-label={t("decrease")}
    >
      <FaMinus size={11} />
    </button>
    <span
      className={`text-sm font-bold w-7 text-center transition-opacity ${
        pending ? "opacity-50 animate-pulse" : ""
      }`}
    >
      {addedQuantity}
    </span>
    <button
      type="button"
      className="w-8 h-8 flex items-center justify-center primaryColor hover:primaryLightBack disabled:opacity-30 disabled:cursor-not-allowed transition"
      onClick={onIncrease}
      disabled={atMax}
      aria-disabled={atMax}
      aria-label={t("increase")}
    >
      <FaPlus size={11} />
    </button>
  </div>
);

interface CartProductCardProps {
  /** cart row shape varies by API response (guest vs server cart) — no shared
   * exported type, kept `any` like the rest of this migration's cart rows. */
  product: any;
  cartProductsData: any[];
  setCartProductsData: React.Dispatch<React.SetStateAction<any[]>>;
  setCartData?: React.Dispatch<React.SetStateAction<any>>;
  currency?: string;
  decimals?: number;
}

const CartProductCard = ({
  product,
  cartProductsData,
  setCartProductsData,
  setCartData,
  currency,
  decimals,
}: CartProductCardProps) => {
  const dispatch = useDispatch();
  const { guard: guardClosed, closedProps } = useStoreClosed();
  const cart = useSelector((state: any) => state.Cart);
  const setting = useSelector((state: any) => state.Setting.setting);

  // Prefer currency/decimals passed down from the parent (Cart.tsx already computes
  // them via useCurrency for the whole page); fall back to useCurrency() directly
  // when this card is used without those props.
  const { currency: liveCurrency, decimals: liveDecimals } = useCurrency();
  const cur = currency || liveCurrency;
  const dec = decimals ?? liveDecimals;
  const money = (amount: number | string = 0) => formatCurrency(amount, cur, dec);

  const coupon = useSelector((state: any) => state.Cart.promo_code);
  const city = useSelector((state: any) => state.City.city);
  const [totalPrice, setTotalPrice] = useState<number | undefined>();

  // ---- normalize new API shape (fallback to old keys) ----
  const productId = product?.id ?? product?.["product_id"];
  const variantId = product?.variant_id ?? product?.["product_variant_id"];
  const productName = product?.name ?? product?.product?.translations?.name;
  const productImage =
    product?.images?.[0]?.image_url ??
    product?.variants?.[0]?.image ??
    product?.image_url;
  const variantText =
    product?.variants?.[0]?.attributes_text ??
    `${product?.measurement || ""} ${product?.unit?.translations?.short_code || ""}`.trim();

  const getProductQuantities = (products?: any[]) => {
    return Object.entries(
      // Object.entries(undefined) throws — same as the pre-TS behavior when
      // `products` is undefined; kept as-is (not a TS-forced change).
      products?.reduce((quantities: Record<string, number>, item: any) => {
        const key = item.product_variant_id ?? item.product_id;
        const existingQty = quantities[key] || 0;
        return {
          ...quantities,
          [key]: existingQty + item.qty,
        };
      }, {}) as Record<string, number>,
    ).map(([variantKey, qty]) => ({
      product_variant_id: Number.parseInt(variantKey, 10),
      qty,
    }));
  };

  useEffect(() => {
    let productQuantity = cart?.isGuest
      ? getProductQuantities(cart?.guestCart)
      : getProductQuantities(cart?.cartProducts);
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_variant_id == variantId,
    )?.qty;
    const finalPrice =
      product?.discounted_price == 0
        ? product?.price
        : product?.discounted_price;
    // Number(undefined) is NaN, same as the original `finalPrice * undefined` — no
    // behavior change, just satisfies TS's arithmetic-operand check.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives totalPrice from cart + product price
    setTotalPrice(finalPrice * Number(productQty));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-derives only when `cart` changes; product/variantId are stable for this row's lifetime
  }, [cart]);

  // Rebuild redux cartProducts + the local row list from the server's authoritative
  // cart array. Server cart = source of truth, so rapid clicks / out-of-order responses
  // can't land on a stale qty or 0 total. Uses response.data.sub_total (NOT response.sub_total,
  // which was undefined here → the 0/incorrect total bug on the cart page).
  const syncFromServerCart = (response: any) => {
    const serverCart = response?.data?.cart?.map((item: any) => ({
      product_id: item?.id,
      product_variant_id: item?.variant_id,
      qty: item?.variants?.[0]?.quantity ?? item?.quantity,
    }));
    dispatch(setCartProducts({ data: serverCart ?? [] }));
    dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
    // Store the FULL server cart in redux so the cart page can render straight from
    // it — no extra getCart round-trip on every add/remove. Add paths (FBT / variant
    // modal / product cards) already dispatch setCart, so the page has one redux
    // source of truth for the item list.
    dispatch(setCart({ data: response }));
    // Refresh the cart-page summary (saved_amount / sub_total / currency) from the
    // SAME response so Total Savings + Total Amount track the latest API values
    // instead of the stale snapshot captured on the initial fetchCart().
    if (typeof setCartData === "function" && response?.data) {
      setCartData((prev: any) => ({ ...prev, ...response.data }));
    }
    // Rebuild the local row list FROM the server cart (source of truth) so it stays
    // in sync in every direction: rows the server dropped disappear, rows added
    // elsewhere (variant modal / FBT / quick view) appear, and existing rows get the
    // fresh qty-dependent fields (slab_discount_message, price, discounted_price,
    // discount_percent — all change with quantity and were going stale, e.g. the slab
    // nudge never hid after the threshold). Iterating `prev` alone dropped brand-new
    // server lines (add via modal never showed) and could keep phantom rows; iterate
    // the server array instead, carrying over any prior row fields as a base.
    const serverItems = response?.data?.cart ?? [];
    setCartProductsData((prev) => {
      const prevRows = prev ?? [];
      const next = serverItems.map((serverItem: any) => {
        const priorRow = prevRows.find(
          (row: any) =>
            (row?.variant_id ?? row?.product_variant_id) ==
            serverItem?.variant_id,
        );
        return { ...priorRow, ...serverItem };
      });
      return next;
    });
  };

  // Clear the applied promo when the cart empties. Kept out of the setState
  // updater above (updaters must stay pure) — driven by the row-list length.
  useEffect(() => {
    if ((cartProductsData?.length ?? 0) <= 0) {
      dispatch(clearCartPromo());
    }
  }, [cartProductsData?.length, dispatch]);

  const handleRemoveFromCart = async (units: number, ctx?: FlushCtx) => {
    try {
      const response = await api.removeFromCart({
        product_id: productId,
        product_variant_id: variantId,
        qty: units,
      });
      // Out-of-order guard: drop this response if a newer +/- flush already fired.
      if (ctx?.isStale?.()) return;
      // status 1 = removed. status 0 + "not found" = already gone server-side (stale row);
      // both must leave the UI, else a phantom row sticks.
      const alreadyGone =
        response?.status != 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status == 1 || alreadyGone) {
        syncFromServerCart(response);
        if (response?.status == 1) {
          await handleApplyCoupon(response?.data?.sub_total);
        }
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleCalculateTotal = (products?: any[]) => {
    const total = products?.reduce((prev: number, curr: any) => {
      prev += curr?.productPrice * curr.qty;
      return prev;
    }, 0);
    dispatch(setCartSubTotal({ data: total }));
    dispatch(setGuestCartTotal({ data: total }));
  };

  const handleGuestCartRemove = () => {
    const remainItems = cart?.guestCart?.filter(
      (cartProduct: any) => cartProduct?.product_variant_id !== variantId,
    );
    const updatedProducts = cartProductsData?.filter(
      (cartProduct: any) => cartProduct?.product_variant_id !== variantId,
    );
    setCartProductsData(updatedProducts);
    dispatch(addtoGuestCart({ data: remainItems }));
    handleCalculateTotal(remainItems);
  };

  // Server trash: drop the row from the LOCAL list IMMEDIATELY, then hit the remove
  // API in the background. The row vanishes instantly (no skeleton, no round-trip
  // wait). handleRemoveFromCart's syncFromServerCart updates redux + the list from
  // the authoritative server cart when the response lands.
  //
  // Do NOT dispatch setCartProducts here: shortening redux would fire the parent's
  // reduxCartCount effect → fetchCart runs BEFORE the remove API finishes → the
  // server still returns the item → the row blinks back for ~2s until the remove
  // response lands. Keeping redux untouched until the API confirms avoids the race.
  const handleServerRemoveOptimistic = async () => {
    setCartProductsData((prev) =>
      (prev ?? []).filter(
        (row: any) => (row?.variant_id ?? row?.product_variant_id) != variantId,
      ),
    );
    // Remove the whole line — send its full current qty.
    const lineQty = serverAddedQty ?? product?.qty ?? 1;
    await handleRemoveFromCart(lineQty);
  };

  const handleRemoveItem = async () => {
    if (cart.isGuest) {
      handleGuestCartRemove();
    } else {
      await handleServerRemoveOptimistic();
    }
  };

  // Server-cart upsert to an absolute qty. Rebuilds from the server's authoritative
  // cart; stale responses dropped via ctx.isStale().
  const serverCommitQty = async (qty: number, ctx?: FlushCtx) => {
    try {
      const response = await api.addToCart({
        product_id: productId,
        product_variant_id: variantId,
        qty: Number(qty),
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (ctx?.isStale?.()) return;
      if (response.status == 1) {
        syncFromServerCart(response);
        await handleApplyCoupon(
          response?.data?.sub_total ?? response.sub_total,
        );
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handleGuestIncrease = () => {
    const productQuantity = getProductQuantities(cart?.guestCart);
    const productQty = productQuantity?.find(
      (prdct: any) => prdct?.product_variant_id == variantId,
    )?.qty;
    if (
      product?.is_unlimited_stock === 0 &&
      Number(productQty) >= Number(product?.stock)
    ) {
      toast.error(t("out_of_stock_message"));
      return;
    }
    if (hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
      toast.error(t("max_cart_limit_error"), { toastId: "max_cart_limit_error" });
      return;
    }
    const maxAddable = getMaxAddableQuantity({
      maxCartItemsCount: setting?.max_cart_items_count,
      otherLinesQty: getCartTotalQuantity(cart?.guestCart) - (productQty || 0),
      totalAllowedQty: product?.total_allowed_quantity,
      isUnlimitedStock: product?.is_unlimited_stock != 0,
      stock: product?.stock,
    });
    if (Number(productQty) >= maxAddable) {
      toast.error(t("max_cart_limit_error"), { toastId: "max_cart_limit_error" });
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct: any) => {
      if (
        cartProduct?.product_id == productId &&
        cartProduct?.product_variant_id == variantId
      ) {
        return { ...cartProduct, qty: Number(cartProduct?.qty + 1) };
      }
      return cartProduct;
    });
    handleCalculateTotal(updatedProducts);
    dispatch(addtoGuestCart({ data: updatedProducts }));
  };

  const handleQuantityIncrease = async () => {
    try {
      if (cart.isGuest) {
        handleGuestIncrease();
      } else {
        // Server cart: optimistic UI now, one debounced addToCart later.
        serverIncrement();
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // Calling this function on every increament decreament so total adjust with coupon card
  const handleApplyCoupon = async (total: number) => {
    if (!coupon?.promo_code) return;
    try {
      const response = await api.setPromoCode({
        promoCodeName: coupon?.promo_code,
        amount: total,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
      } else {
        await handleRemoveCoupon();
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handleGuestDecrease = () => {
    const variantQty = cart?.guestCart?.find(
      (prdct: any) =>
        prdct?.product_id == productId &&
        prdct?.product_variant_id == variantId,
    )?.qty;
    if (variantQty <= 1) {
      // Cart page keeps its existing behavior: the stepper bottoms out at 1; the
      // trash button is the way to remove the last unit.
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct: any) => {
      if (
        cartProduct?.product_id == productId &&
        cartProduct?.product_variant_id == variantId
      ) {
        return { ...cartProduct, qty: Number(cartProduct?.qty - 1) };
      }
      return cartProduct;
    });
    handleCalculateTotal(updatedProducts);
    dispatch(addtoGuestCart({ data: updatedProducts }));
  };

  const handleQuantityDecrease = async () => {
    try {
      if (cart.isGuest) {
        handleGuestDecrease();
      } else {
        // Server cart: optimistic UI now, one debounced addToCart/removeFromCart later.
        serverDecrement();
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleRemoveCoupon = async () => {
    dispatch(clearCartPromo());
  };

  const serverAddedQty = cart?.cartProducts?.find(
    (prdct: any) => prdct?.product_variant_id == variantId,
  )?.qty;
  const guestAddedQty = cart?.guestCart?.find(
    (prdct: any) => prdct?.product_variant_id == variantId,
  )?.qty;

  // Upper bound: MIN(remaining store-wide cart capacity, per-product allowed
  // quantity, available stock).
  const maxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.max_cart_items_count,
    otherLinesQty: getCartTotalQuantity(cart?.cartProducts) - (serverAddedQty || 0),
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: product?.is_unlimited_stock != 0,
    stock: product?.stock,
  });

  // Same cap, computed against the GUEST cart — the stepper's "+" disabled
  // state must reflect the store-wide limit for guests too, not just the
  // per-product cap (guestAddedQty/guestMaxQty mirror serverAddedQty/maxQty above).
  const guestMaxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.max_cart_items_count,
    otherLinesQty: getCartTotalQuantity(cart?.guestCart) - (guestAddedQty || 0),
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: product?.is_unlimited_stock != 0,
    stock: product?.stock,
  });

  // Optimistic + debounced + out-of-order-safe stepper for the SERVER cart.
  // Guest stays instant/local. Commits one final addToCart/removeFromCart after clicks settle.
  const {
    displayQty: serverDisplayQty,
    increment: serverIncrement,
    decrement: serverDecrement,
    pending: serverPending,
  } = useDebouncedQuantity({
    serverQty: serverAddedQty || 0,
    onCommit: (qty, ctx) => serverCommitQty(qty, ctx),
    onRemove: (units, ctx) => handleRemoveFromCart(units, ctx),
    max: Number.isFinite(maxQty) ? maxQty : undefined,
    onMax: () =>
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      }),
  });

  const addedQuantity = !cart.isGuest ? serverDisplayQty : guestAddedQty;
  const hasDiscount =
    product?.discounted_price != 0 &&
    product?.discounted_price < product?.price;
  const unitPrice = hasDiscount ? product?.discounted_price : product?.price;

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 border-b w-full min-w-0">
      {/* image */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden cardBorder shrink-0 bg-white p-1">
        <ImageWithPlaceholder
          src={productImage}
          alt={productName}
          width={160}
          height={160}
          className="w-full h-full object-contain"
        />
      </div>

      {/* details */}
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        {/* top: name (left) + line total (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold line-clamp-2 leading-snug">
              {productName}
            </h3>
            {variantText && (
              <p className="text-xs SecondaryTextColor truncate mt-0.5">
                {variantText}
              </p>
            )}
          </div>
          <span className="text-sm sm:text-base font-bold primaryColor whitespace-nowrap shrink-0">
            {money(totalPrice)}
          </span>
        </div>

        {/* unit price + strike */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">{money(unitPrice)}</span>
          {hasDiscount && (
            <span className="text-xs SecondaryTextColor line-through">
              {money(product?.price)}
            </span>
          )}
        </div>

        {/* slab / buy-more discount nudge — full width, no squeeze */}
        {product?.slab_discount_message && (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/15 px-2 py-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
            <TbDiscount size={14} className="shrink-0" />
            {product.slab_discount_message}
          </p>
        )}

        {/* bottom: stepper + inline prescription upload + remove — one row when
            empty (3 together); the uploaded file link wraps to its own line below
            (PrescriptionUpload uses basis-full when a file is present). */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Stepper
            closedProps={closedProps}
            addedQuantity={addedQuantity}
            onDecrease={handleQuantityDecrease}
            onIncrease={guardClosed(handleQuantityIncrease)}
            pending={!cart?.isGuest && serverPending}
            atMax={
              Number(addedQuantity) >=
              (cart?.isGuest ? guestMaxQty : maxQty)
            }
          />
          {/* prescription — medical (product_type 5) only */}
          {Number(product?.product_type) === 5 && (
            <PrescriptionUpload
              variantId={variantId}
              isRequired={product?.is_prescription_required}
              inline
            />
          )}
          <button
            type="button"
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            onClick={handleRemoveItem}
            aria-label={t("delete")}
          >
            <BiTrash size={16} />
            <span className="hidden xs:inline sm:inline">{t("delete")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartProductCard;
