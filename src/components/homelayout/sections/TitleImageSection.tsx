"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { pickDeviceImage, toCssAspectRatio } from "@/utils/helperFunction";
import { resolveIdCsvToSlugCsv } from "@/utils/categorySlugResolver";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

interface TitleImageSectionProps {
  block: any;
  borderRadius?: string | number;
  device?: string;
  priority?: boolean;
  // Resolves the full category tree on demand — see the identical comment in
  // GridBannerSection.tsx for why this is a function, not raw tree data.
  resolveCategoryTree?: () => Promise<any[]>;
}

// `priority` is set by HomeLayout only for the first block of the first section
// — the one image that can be the LCP element. See renderBlock there.
const TitleImageSection = ({
  block,
  borderRadius,
  device = "web",
  priority = false,
  resolveCategoryTree,
}: TitleImageSectionProps) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();

  const src = pickDeviceImage(block?.images, device, block?.image_url);

  // Shape from the API's `image_aspect` ("3:1", or a per-device
  // {app,tablet,web} object — pick before parsing); unset/malformed → natural
  // proportions (auto height).
  const imageAspectRaw =
    block?.config?.image_aspect && typeof block.config.image_aspect === "object"
      ? pickDeviceImage(block.config.image_aspect, device)
      : block?.config?.image_aspect;
  const aspectRatio = toCssAspectRatio(imageAspectRaw) ?? null;

  const clickable =
    (block?.redirect_type === "url" && block?.redirect_url) ||
    (block?.redirect_type === "product" && block?.redirect_slug) ||
    (block?.redirect_type === "category" && block?.redirect_id);

  const handleClick = async () => {
    if (block?.redirect_type === "url" && block?.redirect_url) {
      window.open(block.redirect_url, "_blank");
    } else if (block?.redirect_type === "product" && block?.redirect_slug) {
      router.push(zoneHref(`/product/${block.redirect_slug}`));
    } else if (block?.redirect_type === "category" && block?.redirect_id) {
      // The URL's category param is a SLUG (see ProductFilter.tsx), not the
      // numeric id the home_layout payload gives us — resolve it first.
      // Awaited so a fast click right after page load still gets the real
      // tree instead of racing its fetch.
      const tree = (await resolveCategoryTree?.()) || [];
      const slug =
        resolveIdCsvToSlugCsv(tree, block.redirect_id.toString()) ||
        block.redirect_id.toString();
      const qs = new URLSearchParams(
        buildQueryPatch({ category_id: slug }),
      ).toString();
      const dest = zoneHref("/products");
      router.push(qs ? `${dest}?${qs}` : dest);
    }
  };

  if (!src) return null;

  return (
    <section >
  
        <div
          className={`relative w-full overflow-hidden ${
            clickable ? "cursor-pointer" : ""
          }`}
          style={{ borderRadius, ...(aspectRatio ? { aspectRatio } : {}) }}
          onClick={clickable ? handleClick : undefined}
        >
          <Image
            src={src}
            alt="Title image"
            priority={priority}
            className={`w-full ${aspectRatio ? "h-full object-cover" : "h-auto object-contain"}`}
            width={1920}
            height={640}
            sizes="100vw"
            quality={75}
          />
        </div>

    </section>
  );
};

export default React.memo(TitleImageSection);
