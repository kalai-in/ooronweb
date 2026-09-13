import { t } from "@/utils/translation";
import React from "react";
import { MdOutlineCelebration } from "react-icons/md";
import { RiWallet3Line } from "react-icons/ri";
import { FiChevronRight, FiTrash2 } from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { clearCartPromo } from "@/redux/slices/cartSlice";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { formatCurrency } from "@/utils/helperFunction";
import useIsRtl from "@/hooks/useIsRtl";
import useZoneHref from "@/hooks/useZoneHref";
import useCurrency from "@/hooks/useCurrency";
import UnlockCouponNudge from "./UnlockCouponNudge";

interface CartCouponCardProps {
  setShowCouponCode: (show: boolean) => void;
  /** /cart API response's `data` payload — no exported type, kept `any`. */
  cartData: any;
}

const CartCouponCard = ({ setShowCouponCode, cartData }: CartCouponCardProps) => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const dispatch = useDispatch();
  const rtl = useIsRtl();
  // Notch/tear sit 66% from start edge; mirror to 34% under RTL to stay on
  // the (flex-reversed) stub's side.
  const notchPct = rtl ? 34 : 66;

  const cart = useSelector((state: any) => state.Cart);
  const user = useSelector((state: any) => state.User);

  const handleClearPromo = () => {
    dispatch(clearCartPromo());
  };

  const handleToCheckOut = () => {
    if (user?.jwtToken) {
      router.push(zoneHref("/checkout"));
    } else {
      toast.error(t("login_to_access_checkout_page"));
    }
  };

  const handleToProducts = () => {
    router.push(zoneHref("/products"));
  };

  // Currency/decimals: countrySetting (zone-aware) is the authoritative live
  // source — wins over any per-response /cart field for this live screen.
  const { currency, decimals } = useCurrency();
  const money = (val) => formatCurrency(val, currency, decimals);

  // Product slab savings, independent of any coupon. API sends it as a string.
  const savedAmount = Number(cartData?.saved_amount || 0);
  const promoDiscount = Number(cart?.promo_code?.discount || 0);
  // "wallet" coupons are cashback (credited after order, doesn't reduce total).
  // Other types reduce the total up-front.
  const isCashbackCoupon = cart?.promo_code?.discount_apply_type === "wallet";
  const subTotal = Number(cartData?.sub_total ?? cart?.cartSubTotal ?? 0);
  const cartTotal = Math.max(
    subTotal - savedAmount - (isCashbackCoupon ? 0 : promoDiscount),
    0,
  );
  // saved_amount already accounts for the applied promo — don't add promoDiscount again.
  const totalSaved = savedAmount;

  // Cashback: credited amount, or "Reward" until known. Else: amount taken off.
  let couponAmountLabel;
  if (!isCashbackCoupon) {
    couponAmountLabel = `-${money(promoDiscount)}`;
  } else if (promoDiscount > 0) {
    couponAmountLabel = money(promoDiscount);
  } else {
    couponAmountLabel = t("reward") || "Reward";
  }

  return (
    <div className="max-w-[702px] p-4 sm:p-5 border rounded-xl cardBorder shadow-sm flex flex-col">
      {/* Unlock nudge + view-all footer; the footer IS the way into the coupon list. */}
      {user?.jwtToken && (
        <UnlockCouponNudge
          className="mb-4"
          code={cartData?.unlock_promo_code}
          message={cartData?.unlock_message}
          onAction={cartData?.unlock_message ? handleToProducts : undefined}
          onViewAll={() => setShowCouponCode(true)}
        />
      )}

      {/* Applied coupon ticket — notched via radial-gradient masks, matches
          the checkout coupon ticket. Left: code. Right stub: amount + remove. */}
      {cart?.promo_code && (
        <div
          className="relative mb-4 flex items-stretch rounded-lg"
          style={{
            backgroundImage:
              "linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 14%, var(--category-card-bg)), color-mix(in srgb, var(--primary-color) 7%, var(--category-card-bg)))",
            WebkitMaskImage: `radial-gradient(circle 8px at ${notchPct}% 0, transparent 8px, #000 8.5px), radial-gradient(circle 8px at ${notchPct}% 100%, transparent 8px, #000 8.5px)`,
            maskImage: `radial-gradient(circle 8px at ${notchPct}% 0, transparent 8px, #000 8.5px), radial-gradient(circle 8px at ${notchPct}% 100%, transparent 8px, #000 8.5px)`,
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
          }}
        >
          {/* dashed tear line between the two notches */}
          <span
            className="pointer-events-none absolute top-3 bottom-3 -translate-x-1/2 border-l border-dashed border-[color-mix(in_srgb,var(--primary-color)_45%,transparent)] dark:border-white/40"
            style={{ left: `${notchPct}%` }}
          />

          {/* left: icon + label + code */}
          <div className="flex items-center gap-2.5 min-w-0 basis-[66%] grow px-3 sm:px-3.5 py-3.5">
            <span
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              <MdOutlineCelebration size={20} />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium primaryColor dark:text-white leading-tight">
                {t("promoCodeSuccess")}
              </span>
              <span className="text-sm sm:text-base font-extrabold textColor truncate leading-tight tracking-wide uppercase">
                {cart?.promo_code?.promo_code}
              </span>
            </div>
          </div>

          {/* right (stub): discount/cashback + remove */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 basis-[34%] grow pl-2 sm:pl-4 pr-2 sm:pr-3 py-3.5">
            <div className="flex flex-col items-center leading-tight min-w-0">
              <span className="text-base sm:text-lg font-extrabold primaryColor dark:text-white truncate max-w-full">
                {couponAmountLabel}
              </span>
              <span className="text-[9px] font-bold SecondaryTextColor uppercase tracking-widest">
                {isCashbackCoupon ? t("cashback") : t("you_save") || "Saved"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearPromo}
              aria-label={t("delete")}
              className="flex items-center justify-center text-gray-400 hover:text-red-500 transition shrink-0"
            >
              <FiTrash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Pricing Details */}
      <div className="flex flex-col gap-2.5 py-1">
        <div className="flex justify-between items-center text-sm">
          <p className="SecondaryTextColor">{t("sub_total")}</p>
          <p className="font-semibold textColor">{money(subTotal)}</p>
        </div>

        {savedAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <p className="SecondaryTextColor">
              {t("you_save") || t("you_saved")}
            </p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              - {money(savedAmount)}
            </p>
          </div>
        )}

        {cart?.promo_code && !isCashbackCoupon && (
          <div className="flex justify-between items-center text-sm">
            <p className="SecondaryTextColor">{t("promoDiscount")}</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              - {money(promoDiscount)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 items-center backgroundColor p-3 rounded-lg">
        <p className="text-base font-bold">{t("total")}</p>
        <p className="text-lg font-extrabold primaryColor dark:text-white">
          {money(cartTotal)}
        </p>
      </div>

      {/* Savings banner, scalloped top edge. */}
      {totalSaved > 0 && (
        <div
          className="mt-2 flex items-center justify-center gap-1.5 px-3 pb-2.5 pt-3.5 text-sm font-bold primaryColor dark:text-green-400"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--primary-color) 8%, transparent)",
            WebkitMaskImage:
              "radial-gradient(circle 6px at 8px -2px, transparent 6px, #000 6.5px)",
            maskImage:
              "radial-gradient(circle 6px at 8px -2px, transparent 6px, #000 6.5px)",
            WebkitMaskSize: "16px 100%",
            maskSize: "16px 100%",
            WebkitMaskRepeat: "repeat-x",
            maskRepeat: "repeat-x",
          }}
        >
          <MdOutlineCelebration size={18} className="shrink-0" />
          <span>
            {t("you_saved")} {money(totalSaved)} {t("you_saved_on_this_order")}
          </span>
        </div>
      )}

      {/* Cashback isn't part of the total — credited to wallet after order. */}
      {cart?.promo_code && isCashbackCoupon && promoDiscount > 0 && (
        <div className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-3.5 py-3 dark:border-amber-500/25 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-amber-500/10">
          {/* slow shine sweep */}
          <span className="savings-shine pointer-events-none absolute inset-y-0 start-0 w-1/4 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/15" />
          {/* start-edge accent bar */}
          <span className="absolute inset-y-0 start-0 w-1 bg-amber-500" />
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/5">
            <RiWallet3Line size={20} />
          </span>
          <div className="relative min-w-0 flex-grow">
            <p className="text-sm font-extrabold text-amber-700 dark:text-amber-400 leading-tight">
              {t("you_will_earn_cashback")}
            </p>
            <p className="text-[11px] text-amber-700/75 dark:text-amber-400/75 mt-0.5">
              {t("cashback_added_to_wallet")}
            </p>
          </div>
          <span className="relative shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-sm font-extrabold text-white shadow-sm">
            +{money(promoDiscount)}
          </span>
        </div>
      )}

      <p className="text-[11px] SecondaryTextColor mt-2.5 mb-4 leading-relaxed">
        * {t("delivery_charges_note")}
      </p>

      <button
        type="button"
        className="group w-full flex items-center justify-center gap-1.5 py-3 mb-2.5 text-sm font-bold text-white primaryBackColor rounded-xl transition hover:opacity-95 active:scale-[0.99]"
        onClick={handleToCheckOut}
      >
        {t("proceed_to_checkout")}
        <FiChevronRight
          size={18}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </button>
      <button
        type="button"
        className="w-full py-2.5 rounded-xl text-sm font-semibold border cardBorder textColor hover:primaryBackColor hover:text-white hover:border-transparent transition"
        onClick={handleToProducts}
      >
        {t("continue_shopping")}
      </button>
    </div>
  );
};

export default CartCouponCard;
