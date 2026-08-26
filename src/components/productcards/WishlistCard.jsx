import React from "react";
import Link from "next/link";
import { BiTrash } from "react-icons/bi";
import { AiFillStar } from "react-icons/ai";
import * as api from "@/api/apiRoutes";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { formatCurrency } from "@/utils/helperFunction";
import useZoneHref from "@/hooks/useZoneHref";

const WishlistCard = ({
  product,
  setWishlistProducts,
  wishlistProducts,
  setTotal,
  handleFetchLikedProducts,
}) => {
  const zoneHref = useZoneHref();
  const setting = useSelector((state) => state.Setting.setting);
  const currency = product?.currency ?? setting?.currency;
  const decimals = product?.decimal_point ?? setting?.decimal_point ?? 0;
  const money = (val) => formatCurrency(val, currency, decimals, true);

  const handleRemoveFromWishlist = async (prdctId) => {
    try {
      const response = await api.removeFromFavorite({ product_id: prdctId });
      if (response.status == 1) {
        const updateProducts = wishlistProducts?.filter(
          (prdct) => prdct?.id != prdctId,
        );
        setWishlistProducts(updateProducts);
        setTotal((prevTotal) => prevTotal - 1);
        await handleFetchLikedProducts();
      } else {
        console.log(response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  // favorites API: image lives in `images[0].image_url`, variant text in
  // `variants[0].attributes_text`. Fall back to legacy fields for other callers.
  const firstImage = product?.images?.[0];
  const imageUrl =
    product?.image_url ||
    (typeof firstImage === "string" ? firstImage : firstImage?.image_url) ||
    product?.variants?.[0]?.image ||
    "";

  const hasDiscount =
    product?.variants?.[0]?.discounted_price !== 0 &&
    product?.variants?.[0]?.discounted_price !== product?.variants?.[0]?.price;
  const variantLabel = (
    product?.variants?.[0]?.attributes_text ||
    [
      product?.variants?.[0]?.measurement,
      product?.variants?.[0]?.unit?.translations?.name ??
        product?.variants?.[0]?.stock_unit_name,
    ]
      .filter(Boolean)
      .join(" ")
  ).trim();

  const discountPercent = Number(product?.discount_percent) || null;
  const ratingValue = Number(product?.rating) || 0;
  const ratingCount = product?.rating_count;
  const inStock = product?.in_stock;
  const brandName = product?.brand_name;
  const productName = product?.translations?.name ?? product?.name;

  const displayPrice = hasDiscount
    ? product?.variants?.[0]?.discounted_price
    : product?.variants?.[0]?.price;

  return (
    <div className="group relative flex items-stretch gap-3 rounded-lg border border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 p-2.5 sm:p-3 transition-all duration-200 hover:border-gray-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      {/* Thumbnail — small, contain (no crop) on a soft panel */}
      <Link
        href={zoneHref(`/product/${product?.slug}`)}
        prefetch={false}
        className="relative h-[72px] w-[72px] sm:h-[88px] sm:w-[88px] shrink-0 self-center overflow-hidden rounded-lg bg-[#f5f6f8] dark:bg-zinc-800"
      >
        <ImageWithPlaceholder
          className={`h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-105 ${inStock ? "" : "opacity-60 grayscale"}`}
          alt={productName}
          src={imageUrl}
          width={200}
          height={200}
        />
      </Link>

      {/* Middle — brand, name, variant, rating + stock */}
      <Link
        href={zoneHref(`/product/${product?.slug}`)}
        prefetch={false}
        className="flex min-w-0 flex-1 flex-col justify-center gap-1"
      >
        {brandName && (
          <span className="text-[10px] font-bold uppercase tracking-wide SecondaryTextColor leading-none">
            {brandName}
          </span>
        )}
        <h3 className="textColor text-[13px] sm:text-sm font-semibold leading-snug line-clamp-2 capitalize">
          {productName}
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {variantLabel && (
            <span className="text-[11px] SecondaryTextColor line-clamp-1">
              {variantLabel}
            </span>
          )}
          {!!product?.product_rating && Number(ratingCount) > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-green-600 px-1 py-px text-[10px] font-bold text-white">
              {ratingValue}
              <AiFillStar size={8} />
            </span>
          )}
          <span
            className={`flex items-center gap-1 text-[11px] font-medium ${
              inStock ? "text-green-600" : "text-red-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                inStock ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {inStock ? t("inStock") : t("OutOfStock")}
          </span>
        </div>
      </Link>

      {/* Right — trash (top) + price (bottom) */}
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 pl-1">
        <button
          type="button"
          onClick={() => handleRemoveFromWishlist(product?.id)}
          aria-label={t("delete")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
        >
          <BiTrash size={16} />
        </button>

        <div className="flex flex-col items-end gap-0.5 leading-tight">
          <span className="textColor text-base font-bold whitespace-nowrap">
            {money(displayPrice)}
          </span>
          {hasDiscount && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="SecondaryTextColor text-[11px] line-through">
                {money(product?.variants?.[0]?.price)}
              </span>
              {discountPercent && (
                <span className="text-[11px] font-bold text-green-600">
                  {discountPercent}% {t("off")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WishlistCard;
