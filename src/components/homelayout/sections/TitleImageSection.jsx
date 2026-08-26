import React from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { pickDeviceImage, toCssAspectRatio } from "@/utils/helperFunction";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

// `priority` is set by HomeLayout only for the first block of the first section
// — the one image that can be the LCP element. See renderBlock there.
const TitleImageSection = ({ block, borderRadius, device = "web", priority = false }) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();

  const src = pickDeviceImage(block?.images, device, block?.image_url);

  // Shape from the API's `image_aspect` ("3:1"); unset/malformed → natural
  // proportions (auto height).
  const aspectRatio = toCssAspectRatio(block?.config?.image_aspect) ?? null;

  const clickable =
    (block?.redirect_type === "url" && block?.redirect_url) ||
    (block?.redirect_type !== "url" &&
      block?.redirect_type !== "none" &&
      block?.redirect_slug);

  const handleClick = () => {
    if (block?.redirect_type === "url" && block?.redirect_url) {
      window.open(block.redirect_url, "_blank");
    } else if (block?.redirect_type === "product" && block?.redirect_slug) {
      router.push(zoneHref(`/product/${block.redirect_slug}`));
    } else if (block?.redirect_type === "category" && block?.redirect_id) {
      router.push({
        pathname: zoneHref("/products"),
        query: buildQueryPatch({ category_id: block.redirect_id.toString() }),
      });
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
