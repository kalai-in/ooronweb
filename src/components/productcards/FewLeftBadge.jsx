import Image from "next/image";
import fewLeftIcon from "@/assets/few_left_icon.svg";
import { t } from "@/utils/translation";

/**
 * Low-stock notice: icon + "Only a few left".
 *
 * Driven by the variant's `is_min_alert` — the backend raises it once stock
 * drops to its minimum-alert threshold, so the card doesn't second-guess the
 * number. `few_quantity_left` is the field these call sites gated on before
 * `is_min_alert` existed, so either flag turns the notice on.
 */
const FewLeftBadge = ({ variant, product, size = 12, className = "" }) => {
  // `== true` matches how the cards already tested this: the API has sent both
  // real booleans and the string "true", and a loose compare covers both.
  const isLow =
    variant?.is_min_alert == true ||
    variant?.few_quantity_left == true ||
    product?.is_min_alert == true ||
    product?.few_quantity_left == true;

  if (!isLow) return null;

  return (
    <p
      className={`flex items-center gap-1 text-[10px] md:text-[11px] font-semibold text-bla ${className}`}
    >
      <Image
        src={fewLeftIcon}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="shrink-0"
      />
      <span>{t("few_quantity_left")}</span>
    </p>
  );
};

export default FewLeftBadge;
