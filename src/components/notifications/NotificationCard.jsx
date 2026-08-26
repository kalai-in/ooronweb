import { formatCustomDate } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { FaRegBell } from "react-icons/fa";
import { IoTimeOutline } from "react-icons/io5";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useFullCategoryTree from "@/hooks/useFullCategoryTree";
import { findNodeById } from "@/utils/categorySlugResolver";
import * as api from "@/api/apiRoutes";
import { t } from "@/utils/translation";

const NotificationCard = ({ notification }) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();
  const city = useSelector((state) => state.City);
  const setting = useSelector((state) => state.Setting?.setting);
  const [resolving, setResolving] = useState(false);
  // The notification payload only carries a numeric `type_id`, no slug — the
  // URL's category param is slug-typed (see categorySlugResolver.js), and the
  // categories API has no id lookup endpoint, so resolving this needs the
  // full tree (same as the products page's own category-filter resolution).
  const latitude = city?.city?.latitude || setting?.default_city?.latitude;
  const longitude = city?.city?.longitude || setting?.default_city?.longitude;
  const { data: categoryTree } = useFullCategoryTree({ latitude, longitude });

  const handleCategoryNotificationClick = async (notification) => {
    if (notification?.type === "category") {
      const node = findNodeById(categoryTree ?? [], notification?.type_id);
      if (!node?.slug) {
        toast.error(t("something_went_wrong"));
        return;
      }
      router.push({
        pathname: zoneHref("/products"),
        query: buildQueryPatch({ category_id: node.slug }),
      });
    } else if (notification?.type === "product") {
      // The notification payload carries only a numeric `type_id`, but the
      // product route is /product/[slug] — pushing the id straight into the URL
      // made the detail page query by slug="17", which returns "No item(s)
      // found" and rendered the not-found screen. Resolve id -> slug first so
      // we navigate to the same canonical URL every other product link uses.
      if (resolving) return;
      const latitude = city?.city?.latitude || setting?.default_city?.latitude;
      const longitude =
        city?.city?.longitude || setting?.default_city?.longitude;
      setResolving(true);
      try {
        const res = await api.getProductById({
          latitude,
          longitude,
          id: notification?.type_id,
        });
        const product = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (res?.status == 1 && product?.slug) {
          router.push(zoneHref(`/product/${product.slug}`));
        } else {
          toast.error(
            res?.message ||
              t("product_is_either_unavailable_or_does_not_exist"),
          );
        }
      } catch (err) {
        console.log("notification product resolve failed:", err?.message);
        toast.error(t("something_went_wrong"));
      } finally {
        setResolving(false);
      }
    } else if (notification?.type === "url") {
      window.open(notification?.link_url, "_blank");
    }
    return;
  };

  const isClickable = ["category", "product", "url"].includes(
    notification?.type,
  );

  return (
    <div
      onClick={() =>
        isClickable && handleCategoryNotificationClick(notification)
      }
      className={`group relative flex items-start gap-4 rounded-2xl border cardBorder bg-white dark:bg-zinc-900 p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
        isClickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:primaryColorBorder"
          : ""
      }`}
    >
      {/* Accent rail — brand tint down the start edge, reads as a notification item */}
      <span className="absolute inset-y-3 start-0 w-1 rounded-full bg-[color-mix(in_srgb,var(--primary-color)_35%,transparent)] group-hover:primaryBackColor transition-colors" />

      {/* Icon — product/category image if present, else a soft primary-tinted bell */}
      <div className="shrink-0 ps-1.5">
        {notification?.image_url ? (
          <Image
            src={notification?.image_url}
            alt="notificationImg"
            height={96}
            width={96}
            className="h-12 w-12 rounded-xl object-cover ring-1 ring-black/5"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl primaryColor bg-[color-mix(in_srgb,var(--primary-color)_12%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]">
            <FaRegBell size={20} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h3 className="font-bold text-[15px] textColor line-clamp-1 group-hover:primaryColor transition-colors">
            {notification?.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0 rounded-full bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium SecondaryTextColor">
            <IoTimeOutline size={12} className="shrink-0" />
            <span className="whitespace-nowrap">
              {formatCustomDate(notification?.date_sent)}
            </span>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed SecondaryTextColor line-clamp-2">
          {notification?.message}
        </p>
      </div>
    </div>
  );
};

export default NotificationCard;
