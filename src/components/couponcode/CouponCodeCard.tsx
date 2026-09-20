import { t } from "@/utils/translation";
import Image from "next/image";
import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import * as api from "@/api/apiRoutes";
import { setCartPromo, clearCartPromo } from "@/redux/slices/cartSlice";
import { Copy, Scissors } from "lucide-react";
import { RiCoupon3Line, RiWallet3Line } from "react-icons/ri";
import useCurrency from "@/hooks/useCurrency";

interface CouponCodeCardProps {
  /** promo code row shape from the /promo API — no exported type, kept `any`. */
  coupon: any;
  setShowCouponCode: (show: boolean) => void;
}

const CouponCodeCard = ({ coupon, setShowCouponCode }: CouponCodeCardProps) => {
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.Cart);
  const city = useSelector((state: any) => state.City?.city);
  // Coupon is shown in the current checkout/cart context (live promo list for
  // the active zone), not a past record — use the current-zone currency.
  const { currency } = useCurrency();

  const isApplied = cart?.promo_code?.promo_code == coupon?.promo_code;

  const handleApplyCoupon = async () => {
    if (isApplied) {
      dispatch(clearCartPromo());
      return;
    }
    try {
      const response = await api.setPromoCode({
        promoCodeName: coupon?.promo_code,
        amount: cart?.cartSubTotal,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        dispatch(setCartPromo({ data: response.data }));
        toast.success(response.message);
        setShowCouponCode(false);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("Error", error);
      toast.error(t("something_went_wrong"));
    }
  };

  const handleCopyCode = () => {
    if (!coupon?.promo_code) return;
    navigator.clipboard
      .writeText(coupon.promo_code)
      .then(() => toast.success(t("copied")))
      .catch(() => toast.error(t("something_went_wrong")));
  };

  const isDisabled = coupon?.is_applicable == 0;
  // Backend may return an empty image_url — render a branded icon tile instead of
  // a broken <Image> (broken alt box / missing-image placeholder).
  const hasImage = Boolean(coupon?.image_url);
  // "wallet" apply type = cashback credited to the wallet AFTER the order — it is
  // NOT subtracted from the order total. "instant" = discount taken off up-front.
  // The card must visually distinguish the two so cashback doesn't read as a
  // price deduction.
  const isCashback = coupon?.discount_apply_type === "wallet";
  const description = coupon?.description || coupon?.translations?.message;
  // `discount` is always a CURRENCY amount — the saving the backend computed for
  // this cart, already capped by max_discount_amount. It is NOT the coupon's
  // headline rate: a "50% up to ₹200" coupon on a ₹2650 cart returns
  // discount:200, and rendering that as a percentage of the total showed "8% OFF"
  // on a 50% coupon. The rate lives in `title` ("Save 50% on up to 200"), so the
  // badge shows the money saved and lets the title carry the rate.
  const discountValue = `${currency}${coupon?.discount}`;
  // Cashback → "₹10 Cashback"; discount → "₹100 OFF".
  const discountLabel = `${discountValue} ${isCashback ? t("cashback") : t("off")}`;
  // Not applicable yet (min order / min qty unmet) → the backend hasn't computed a
  // discount, so every amount is 0 and a "₹0 OFF" badge is noise. Show what the
  // user must do instead; `unlock_message` is the API's own copy for that.
  // `unlock_message` is the actionable copy ("Add 1 more items to unlock this
  // offer"); `message` is the raw reason ("requires at least 4 items in cart").
  // Prefer the former, fall back to the latter when the backend omits it.
  const unlockMessage = isDisabled
    ? coupon?.unlock_message || coupon?.message
    : "";
  const showDiscountBadge = !isDisabled && Number(coupon?.discount) > 0;

  return (
    <div
      className={`overflow-hidden rounded-xl transition-colors ${isApplied ? "primaryBorder bg-[#55AE7B0A]" : "cardBorder"
        } ${isDisabled && !isApplied ? "opacity-60" : ""}`}
    >
      {/* Top: image + title/desc + discount badge */}
      <div className="flex items-start gap-3 p-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg cardBorder">
          {hasImage ? (
            <Image
              src={coupon.image_url}
              alt="Promo image"
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : isCashback ? (
            <div className="flex h-full w-full items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RiWallet3Line size={24} />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--primary-color)]/10 primaryColor dark:text-white">
              <RiCoupon3Line size={24} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-grow">
          <h3 className="truncate text-sm font-bold textColor">
            {coupon?.title || coupon?.promo_code}
          </h3>
          {description ? (
            <p className="line-clamp-1 text-xs SecondaryTextColor">{description}</p>
          ) : null}
        </div>
        {showDiscountBadge && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-white ${
              isCashback ? "bg-amber-500" : "bg-[var(--primary-color)]"
            }`}
          >
            {isCashback && <RiWallet3Line size={12} />}
            {discountLabel}
          </span>
        )}
      </div>

      {/* Dashed tear line with scissors */}
      <div className="flex items-center gap-2 px-3 SecondaryTextColor">
        <Scissors size={14} className="shrink-0 rtl:-scale-x-100" />
        <span className="flex-grow border-t border-dashed" />
      </div>

      {/* Bottom: code chip + apply */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2.5">
        <button
          type="button"
          onClick={handleCopyCode}
          className="group inline-flex min-w-0 items-center gap-1.5 rounded-md primaryDashedBorder px-2.5 py-1 text-xs font-bold uppercase tracking-wide primaryColor dark:text-zinc-200"
        >
          <span className="truncate">{coupon?.promo_code}</span>
          <Copy size={12} className="shrink-0 opacity-70 group-hover:opacity-100" />
        </button>
        <button
          disabled={isDisabled && !isApplied}
          className={`shrink-0 rounded-md px-5 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-zinc-800 ${isApplied
            ? "border primaryBorder primaryColor"
            : "primaryBackColor text-white hover:opacity-90"
            }`}
          onClick={handleApplyCoupon}
        >
          {isApplied ? t("remove") : t("apply")}
        </button>
      </div>

      {unlockMessage && (
        <p className="flex items-center gap-1.5 bg-[var(--primary-color)]/[0.07] px-3 py-1.5 text-[11px] font-medium primaryColor dark:text-zinc-200">
          <RiCoupon3Line size={13} className="shrink-0" />
          {unlockMessage}
        </p>
      )}

      {isCashback && (
        <p className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <RiWallet3Line size={13} className="shrink-0" />
          {t("cashback_credited_after_order")}
        </p>
      )}

      {coupon?.minimum_order_amount > 0 && (
        <p className="bg-black/[0.02] px-3 py-1.5 text-[11px] SecondaryTextColor dark:bg-white/[0.03]">
          {t("min_order")}: {currency}
          {coupon?.minimum_order_amount}
        </p>
      )}
    </div>
  );
};

export default CouponCodeCard;
