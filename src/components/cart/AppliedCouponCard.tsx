import React from "react";
import { MdOutlineCelebration } from "react-icons/md";
import { FiTrash2 } from "react-icons/fi";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";

interface AppliedCouponCardProps {
  /** applied promo code (e.g. "SAVE10") */
  code: string;
  /** pre-formatted saved amount (e.g. "₹10.00") */
  savedAmount: string;
  discountType?: string;
  /** remove-coupon handler */
  onRemove: () => void;
  /** disables the remove button */
  loading?: boolean;
}

/**
 * Applied-coupon success ticket — mirrors the canonical ticket used in the main
 * cart (CartCouponCard): a notched, primary-tinted coupon with a dashed tear
 * line. Left stub = celebration icon + "applied" label + code; right stub =
 * saved amount + caption + remove. Uses the brand --primary-color throughout
 * (theme-aware), NOT a hardcoded green, so it belongs with the rest of the app.
 */
const AppliedCouponCard = ({ code, savedAmount, discountType, onRemove, loading }: AppliedCouponCardProps) => {
  const rtl = useIsRtl();
  // Ticket notch/tear sit 66% from the start edge; mirror to 34% under RTL so
  // they land on the same side as the (flex-reversed) stub. Same as CartCouponCard.
  const notchPct = rtl ? 34 : 66;

  return (
    <div
      className="relative mb-2 flex items-stretch rounded-lg"
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
            {t("promoCodeSuccess") || t("coupon_applied") || "Coupon Applied"}
          </span>
          <span className="text-sm sm:text-base font-extrabold textColor truncate leading-tight tracking-wide uppercase">
            {code}
          </span>
        </div>
      </div>

      {/* right (stub): saved amount + remove */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 basis-[34%] grow pl-2 sm:pl-4 pr-2 sm:pr-3 py-3.5">
        <div className="flex flex-col items-center leading-tight min-w-0">
          {discountType === "free_delivery" ? (
            <span className="text-[10px] sm:text-[11px] font-bold primaryColor dark:text-white uppercase tracking-wide text-center leading-snug">
              {t("free_delivery") || "Free Delivery"}
            </span>
          ) : (
            <>
              <span className="text-base sm:text-lg font-extrabold primaryColor dark:text-white truncate max-w-full">
                {savedAmount}
              </span>
              <span className="text-[9px] font-bold SecondaryTextColor uppercase tracking-widest">
                {t("you_save") || t("you_saved") || "Saved"}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={loading}
          aria-label={t("delete") || t("remove") || "Remove"}
          className="flex items-center justify-center text-gray-400 hover:text-red-500 transition shrink-0 disabled:opacity-50"
        >
          <FiTrash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default AppliedCouponCard;
