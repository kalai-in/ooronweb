import { RiDiscountPercentFill } from "react-icons/ri";
import { FiPlus, FiChevronDown } from "react-icons/fi";
import { t } from "@/utils/translation";

/**
 * Standalone coupon card (not nested in the cart card): unlock nudge row +
 * view-all footer. No separate header — the footer already opens the list.
 * Borderless, themed via a --primary-color shadow/gradient; the discount
 * rosette and green benefit text stay fixed colors regardless of brand hue.
 *
 * @param {string}    code       promo code to unlock (e.g. "B2G10")
 * @param {string}    message    API copy — what the user must do to unlock
 * @param {string}    benefit    short reward label (e.g. "Get 10% off")
 * @param {()=>void}  onAction   optional — renders the "Shop more" button
 * @param {()=>void}  onViewAll  optional — renders the "View all coupons" footer
 * @param {string}    className  extra wrapper classes (spacing at call site)
 */
const UnlockCouponNudge = ({
  code,
  message,
  benefit,
  onAction,
  onViewAll,
  className = "",
}) => {
  const hasNudge = Boolean(message || code);
  if (!hasNudge && !onViewAll) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] ${className}`}
      style={{
        // Light brand tint at the top fading out at the bottom, so the card reads
        // as one surface and the footer sits on the pale end. Fades to
        // --category-card-bg rather than a literal #fff so dark mode lands on the
        // dark card surface instead of staying white.
        backgroundImage:
          "linear-gradient(to bottom, color-mix(in srgb, var(--primary-color) 6%, var(--category-card-bg)), var(--category-card-bg))",
      }}
    >
      {hasNudge && (
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          {/* Full-strength primary, not a transparent mix — the rosette is a
              small mark and any wash made it read as disabled. */}
          <span className="flex shrink-0 items-center justify-center primaryColor">
            <RiDiscountPercentFill size={24} />
          </span>

          <div className="min-w-0 flex-grow">
            {/* Code + benefit share a line: the code identifies the offer, the
                benefit is the reason to care. */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {code && (
                <span className="text-sm font-extrabold uppercase tracking-wide textColor">
                  {code}
                </span>
              )}
              {benefit && (
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {benefit}
                </span>
              )}
            </div>

            {message && (
              <p className="mt-1 text-[13px] leading-snug SecondaryTextColor">
                {message}
              </p>
            )}
          </div>

          {onAction && (
            <button
              type="button"
              onClick={onAction}
              className="ms-auto flex shrink-0 items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] bg-[var(--category-card-bg)] px-3 py-1.5 text-[13px] font-semibold textColor shadow-sm transition hover:primaryBackColor hover:text-white hover:border-transparent active:scale-95"
            >
              <FiPlus size={14} />
              {t("shop_more") || "Shop more"}
            </button>
          )}
        </div>
      )}

      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className={`flex w-full items-center justify-between px-4 py-3 text-sm font-semibold textColor ${
            hasNudge
              ? "border-t border-[color-mix(in_srgb,var(--primary-color)_15%,transparent)]"
              : ""
          }`}
        >
          {t("view_all_coupons") || "View all coupons"}
          <FiChevronDown size={18} className="SecondaryTextColor" />
        </button>
      )}
    </div>
  );
};

export default UnlockCouponNudge;
