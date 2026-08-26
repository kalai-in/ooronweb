import { IoClose } from "react-icons/io5";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  addtoGuestCart,
  clearCartPromo,
  setCartDecimal,
  setCartProducts,
  setCartPromo,
  setCartSubTotal,
  setGuestCartTotal,
} from "@/redux/slices/cartSlice";
import { toast } from "react-toastify";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { t } from "@/utils/translation";
import { FiMinus, FiPlus } from "react-icons/fi";
import { TbDiscount } from "react-icons/tb";
import { formatCurrency, hasReachedAllowedQty } from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useStoreClosed from "@/hooks/useStoreClosed";
import PrescriptionUpload from "@/components/prescription/PrescriptionUpload";

const CartDrawerProductsCard = ({
  product,
  setCartProductsData,
  setCartData,
  currency,
  decimals = 0,
}) => {
  const dispatch = useDispatch();
  const { guard: guardClosed, closedProps } = useStoreClosed();
  const setting = useSelector((state) => state.Setting.setting);

  // Prefer currency/decimals from the /cart response; fall back to settings.
  const cur = currency ?? setting?.currency;
  const dec = decimals ?? setting?.decimal_point ?? 0;
  const money = (amount) => formatCurrency(amount, cur, dec);
  const cart = useSelector((state) => state.Cart);
  const coupon = useSelector((state) => state.Cart.promo_code);
  const city = useSelector((state) => state.City.city);

  // Guest cart: redux is source of truth, but totals/stock must come from server.
  // Re-fetch guest cart with the updated variant_ids/quantities and sync UI + totals.
  const refreshGuestCart = async (guestCartItems) => {
    dispatch(addtoGuestCart({ data: guestCartItems }));
    if (!guestCartItems || guestCartItems.length === 0) {
      setCartProductsData([]);
      dispatch(setGuestCartTotal({ data: 0 }));
      return;
    }
    try {
      const response = await api.getGuestCart({
        latitude: city?.latitude,
        longitude: city?.longitude,
        variant_ids: guestCartItems.map((p) => p.product_variant_id).join(","),
        quantities: guestCartItems.map((p) => p.qty).join(","),
      });
      if (response.status == 1) {
        // Server cart uses variant_id/variants[].quantity; normalize to the
        // product_variant_id/qty shape the card + redux guestCart rely on.
        const normalizedCart = response?.data?.cart?.map((item) => {
          const variant = item?.variants?.[0] || {};
          return {
            ...item,
            product_id: item?.id,
            product_variant_id: item?.variant_id,
            qty: variant?.quantity ?? item?.quantity,
            image_url: item?.images?.[0]?.image_url,
            attributes_text: variant?.attributes_text,
            variant_attributes:
              variant?.variant_attributes ?? item?.variant_attributes ?? [],
            // Per-product purchase cap from the API. Do NOT alias to stock —
            // stock far exceeds the cap, which would let + run past the limit.
            total_allowed_quantity: item?.total_allowed_quantity ?? item?.stock,
          };
        });
        setCartProductsData(normalizedCart);
        dispatch(setGuestCartTotal({ data: response?.data?.sub_total }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // Rebuild redux cartProducts + the drawer's local row list from the server's
  // authoritative cart array (NOT by spreading the captured closure snapshot, which
  // races on rapid clicks → last-write-wins stale qty). Mirrors HomeVerticleProductCard.
  const syncFromServerCart = (response) => {
    const serverCart = response?.data?.cart?.map((item) => ({
      product_id: item?.id,
      product_variant_id: item?.variant_id,
      qty: item?.variants?.[0]?.quantity ?? item?.quantity,
    }));
    dispatch(setCartProducts({ data: serverCart ?? [] }));
    dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
    // Keep the redux decimal mirror fresh when the response carries it; the
    // reducer ignores null/undefined so a remove/add that omits it is a no-op.
    dispatch(setCartDecimal({ data: response?.data?.decimal_point }));

    // Refresh the drawer summary (saved_amount / sub_total / currency) from the
    // SAME response so Total Savings + Total Amount track the latest API values.
    if (typeof setCartData === "function" && response?.data) {
      setCartData((prev) => ({ ...prev, ...response.data }));
    }

    // Rebuild the drawer's local list FROM the server cart (source of truth) so
    // it stays in sync in every direction: rows the server dropped disappear,
    // rows added elsewhere (variant modal / FBT / quick view) appear, and existing
    // rows get fresh qty-dependent fields — slab_discount_message, price,
    // discounted_price, discount_percent all change with quantity and were going
    // stale (e.g. slab nudge never hid after reaching the threshold). Iterating
    // `prev` alone dropped brand-new server lines; iterate the server array and
    // carry over prior row fields (image_url, attributes, etc.) as a base.
    const serverItems = response?.data?.cart ?? [];
    setCartProductsData((prev) => {
      const prevRows = prev ?? [];
      const next = serverItems.map((serverItem) => {
        const priorRow = prevRows.find(
          (row) => row?.product_variant_id == serverItem?.variant_id,
        );
        return {
          ...priorRow,
          ...serverItem,
          product_id: serverItem?.id,
          product_variant_id: serverItem?.variant_id,
          qty:
            serverItem?.variants?.[0]?.quantity ??
            serverItem?.quantity ??
            priorRow?.qty,
          slab_discount_message: serverItem?.slab_discount_message ?? "",
          price: serverItem?.price ?? priorRow?.price,
          discounted_price:
            serverItem?.discounted_price ?? priorRow?.discounted_price,
          discount_percent:
            serverItem?.discount_percent ?? priorRow?.discount_percent,
          image_url: serverItem?.images?.[0]?.image_url ?? priorRow?.image_url,
        };
      });
      if (next.length <= 0) dispatch(clearCartPromo());
      return next;
    });
  };

  const handleRemoveFromCart = async (units, ctx) => {
    try {
      const response = await api.removeFromCart({
        product_id: product?.product_id,
        product_variant_id: product?.product_variant_id,
        qty: units,
      });
      // Out-of-order guard: if a newer +/- flush already started, this response is
      // stale — dropping it stops old totals (or 0) from clobbering the latest state.
      if (ctx?.isStale?.()) return;
      // status 1 = removed. status 0 with "not found" = already gone server-side
      // (stale row). In both cases the row must leave the UI; otherwise the phantom
      // row sticks and the user can never clear it without a refetch.
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

  // Server: clear the whole line in one call (is_remove_all=1) so the X button
  // removes the product regardless of how many units are in it.
  const handleRemoveWholeLine = async () => {
    try {
      // Send is_remove_all AND the full line qty — some backends ignore the flag
      // and only honour qty, so passing both guarantees the whole line drops
      // instead of decrementing a single unit.
      const lineQty = serverAddedQty ?? product?.qty;
      const response = await api.removeFromCart({
        product_id: product?.product_id,
        product_variant_id: product?.product_variant_id,
        qty: lineQty,
        isRemoveAll: true,
      });
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

  const handleGuestCartRemove = async () => {
    const remainItems = cart?.guestCart?.filter(
      (cartProduct) =>
        cartProduct?.product_variant_id !== product?.product_variant_id,
    );
    await refreshGuestCart(remainItems);
  };

  // X button = drop the ENTIRE line (all units), not a single-unit decrement.
  const handleRemoveItem = async () => {
    if (cart.isGuest) {
      await handleGuestCartRemove();
    } else {
      await handleRemoveWholeLine();
    }
  };

  const getProductQuantities = (products) => {
    return Object.entries(
      products?.reduce((quantities, item) => {
        const existingQty = quantities[item.product_id] || 0;
        return { ...quantities, [item.product_id]: existingQty + item.qty };
      }, {}),
    ).map(([productId, qty]) => ({
      product_id: Number.parseInt(productId, 10),
      qty,
    }));
  };

  // Server-cart upsert to an absolute qty. Rebuilds from the server's authoritative
  // cart so rapid clicks can't land on a stale qty. Mirrors HomeVerticleProductCard.
  const serverCommitQty = async (qty, ctx) => {
    try {
      const response = await api.addToCart({
        product_id: product?.product_id,
        product_variant_id: product?.product_variant_id,
        qty: Number(qty),
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      // Out-of-order guard — drop this response if a newer flush already fired.
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

  const handleGuestIncrease = async () => {
    const productQuantity = getProductQuantities(cart?.guestCart);
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.product_id,
    )?.qty;
    if (
      product?.is_unlimited_stock === 0 &&
      productQty >= Number(product?.stock)
    ) {
      toast.error(t("out_of_stock_message"));
      return;
    }
    if (hasReachedAllowedQty(productQty, product?.total_allowed_quantity)) {
      toast.error(t("max_cart_limit_error"));
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct) => {
      if (
        cartProduct?.product_id == product?.product_id &&
        cartProduct?.product_variant_id == product?.product_variant_id
      ) {
        return { ...cartProduct, qty: Number(cartProduct?.qty + 1) };
      }
      return cartProduct;
    });
    await refreshGuestCart(updatedProducts);
  };

  const handleQuantityIncrease = async () => {
    try {
      if (cart.isGuest) {
        await handleGuestIncrease();
      } else {
        // Server cart: optimistic UI now, one debounced addToCart later
        // (hook enforces the stock/allowed cap via onMax).
        serverIncrement();
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // Calling this function on every increament decreament so total adjust with coupon card
  const handleApplyCoupon = async (total) => {
    try {
      const response = await api.setPromoCode({
        promoCodeName: coupon?.promo_code,
        amount: total,
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

  const handleRemoveCoupon = async () => {
    dispatch(clearCartPromo());
  };

  const handleGuestDecrease = async () => {
    const variantQty = cart?.guestCart?.find(
      (prdct) =>
        prdct?.product_id == product?.product_id &&
        prdct?.product_variant_id == product?.product_variant_id,
    )?.qty;
    if (variantQty <= 1) {
      await handleGuestCartRemove();
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct) => {
      if (
        cartProduct?.product_id == product?.product_id &&
        cartProduct?.product_variant_id == product?.product_variant_id
      ) {
        return { ...cartProduct, qty: Number(cartProduct?.qty - 1) };
      }
      return cartProduct;
    });
    await refreshGuestCart(updatedProducts);
  };

  const handleQuantityDecrease = async () => {
    try {
      if (cart.isGuest) {
        await handleGuestDecrease();
      } else {
        // Server cart: optimistic UI now, one debounced addToCart/removeFromCart
        // later (hook calls onRemove automatically when target hits 0).
        serverDecrement();
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const serverAddedQty = cart?.cartProducts?.find(
    (prdct) => prdct?.product_variant_id == product?.product_variant_id,
  )?.qty;
  const guestAddedQty = cart?.guestCart?.find(
    (prdct) => prdct?.product_variant_id == product?.product_variant_id,
  )?.qty;

  // Upper bound for the stepper: smaller of stock (when limited) and the per-product
  // allowed quantity. Unlimited stock → only the allowed cap applies.
  const allowedCap = Number(product?.total_allowed_quantity) || Infinity;
  const stockCap =
    product?.is_unlimited_stock == 0 ? Number(product?.stock) || 0 : Infinity;
  const maxQty = Math.min(allowedCap, stockCap);

  // Optimistic + debounced stepper for the SERVER cart (guest stays instant/local).
  // Commits one final addToCart / removeFromCart after clicks settle.
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

  // Disable + once the displayed (optimistic) qty hits the cap, so the user can't
  // spam past it even before the debounced commit lands. hasReachedAllowedQty
  // treats cap 0/missing as unlimited → button stays enabled.
  const atMaxQty = hasReachedAllowedQty(
    addedQuantity,
    product?.total_allowed_quantity,
  );

  const hasDiscount =
    product?.discounted_price != 0 &&
    product?.discounted_price !== product?.price;
  const discountPercent = product?.discount_percent;

  const renderVariantInfo = () => {
    if (
      Array.isArray(product?.variant_attributes) &&
      product.variant_attributes.length > 0
    ) {
      return (
        <div className="mt-1 flex flex-wrap gap-1">
          {product.variant_attributes.map((attr, i) => (
            <span
              key={`${attr?.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-zinc-300"
            >
              <span className="font-medium opacity-60">{attr?.name}:</span>
              <span className="font-semibold capitalize">{attr?.value}</span>
            </span>
          ))}
        </div>
      );
    }
    if (product?.attributes_text) {
      return (
        <p className="mt-0.5 truncate text-xs opacity-60">
          {product?.attributes_text}
        </p>
      );
    }
    return null;
  };

  return (
    <div
      className="group flex gap-3 rounded-lg border bg-white dark:bg-zinc-900 p-2.5 transition-all hover:shadow-md"
      style={{
        borderColor:
          "color-mix(in srgb, var(--primary-color) 16%, transparent)",
      }}
    >
      {/* image on a soft panel — contain so products never crop */}
      <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-zinc-800">
        <ImageWithPlaceholder
          src={product?.image_url}
          alt={product?.name ?? "Image"}
          fill
          sizes="96px"
          className="h-full w-full object-contain p-1.5"
        />
        {hasDiscount && discountPercent ? (
          <span className="absolute left-0 top-0 primaryBackColor rounded-br-lg px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {discountPercent}% {t("off")}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug capitalize">
            {product?.name ?? product?.product?.translations?.name}
          </h2>
          <button
            type="button"
            aria-label={t("delete")}
            onClick={handleRemoveItem}
            className="shrink-0 -mr-0.5 -mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <IoClose size={16} />
          </button>
        </div>

        {/* variant attribute chips (Color / Size / Fabric) */}
        {renderVariantInfo()}

        {/* slab / buy-more discount nudge */}
        {product?.slab_discount_message ? (
          <p className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/15 px-2 py-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
            <TbDiscount size={14} className="shrink-0" />
            {product.slab_discount_message}
          </p>
        ) : null}

        {(() => {
          const isMedical = Number(product?.product_type) === 5;
          const Stepper = (
            <div
              {...closedProps}
              className={`flex w-fit items-center rounded-lg border primaryBorderColor ${closedProps.className ?? ""}`}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                className="flex h-8 w-8 items-center justify-center primaryColor transition-colors hover:primaryLightBack disabled:opacity-40"
                onClick={handleQuantityDecrease}
              >
                <FiMinus size={15} />
              </button>
              <span
                className={`min-w-[26px] text-center text-sm font-bold transition-opacity ${!cart?.isGuest && serverPending ? "opacity-50 animate-pulse" : ""}`}
              >
                {addedQuantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={atMaxQty}
                aria-disabled={atMaxQty}
                className="flex h-8 w-8 items-center justify-center primaryColor transition-colors hover:primaryLightBack disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={guardClosed(() => handleQuantityIncrease())}
              >
                <FiPlus size={15} />
              </button>
            </div>
          );
          const Price = (
            <div className="flex h-8 items-center gap-1.5">
              <span className="text-[15px] font-extrabold">
                {money(
                  hasDiscount ? product?.discounted_price : product?.price,
                )}
              </span>
              {hasDiscount ? (
                <span className="text-xs line-through opacity-50">
                  {money(product?.price)}
                </span>
              ) : null}
            </div>
          );

          // Medical: DESKTOP = two columns (left stacks price + prescription,
          // right holds the stepper). MOBILE = fully stacked (stepper, price,
          // prescription) so the narrow drawer never squeezes the upload
          // button under the stepper.
          if (isMedical) {
            const Prescription = (
              <PrescriptionUpload
                variantId={product?.product_variant_id}
                isRequired={product?.is_prescription_required}
                inline
              />
            );
            return (
              <>
                {/* mobile: stacked */}
                <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:hidden">
                  {Stepper}
                  {Price}
                  {Prescription}
                </div>
                {/* desktop: 2 columns */}
                <div className="mt-auto hidden items-center justify-between gap-3 pt-2 sm:flex">
                  <div className="flex min-w-0 flex-col gap-1">
                    {Price}
                    {Prescription}
                  </div>
                  <div className="shrink-0">{Stepper}</div>
                </div>
              </>
            );
          }

          // Non-medical: simple qty + price row (price left, qty right on
          // desktop; stacked on mobile).
          return (
            <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-2">
              {Stepper}
              <div className="sm:text-right">{Price}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default CartDrawerProductsCard;
