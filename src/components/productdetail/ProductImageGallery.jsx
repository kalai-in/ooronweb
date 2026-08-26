"use client";
import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { BiHeart, BiSolidHeart } from "react-icons/bi";
import { RiShareForwardLine } from "react-icons/ri";
import { MdOutlineZoomOutMap } from "react-icons/md";
import useHydratedMediaQuery from "@/hooks/useHydratedMediaQuery";
import useDir from "@/hooks/useDir";
import { t } from "@/utils/translation";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import ProductZoomImage from "./ProductZoomImage";

/**
 * Product image gallery: main image (hover-zoom on lg+), wishlist + share
 * overlay buttons, and a thumbnail strip — vertical on the left at lg+,
 * horizontal below the image on mobile.
 */
const ProductImageGallery = ({
  product,
  productImages,
  selectedImage,
  onSelectImage,
  canHoverZoom,
  isFavorite,
  onToggleFavorite,
  onShare,
}) => {
  // Hydration-safe — see useHydratedMediaQuery. Server and first client render
  // both get false (horizontal thumbs), then it settles to the real breakpoint.
  const isLgUp = useHydratedMediaQuery("(min-width: 1024px)");
  const dir = useDir();

  // Drives the wishlist pop + burst animation. Fire only on a fresh "like"
  // (unliked → liked), auto-cleared after the animation so it can retrigger.
  const [likeBurst, setLikeBurst] = useState(false);

  const handleFavoriteClick = (e) => {
    if (!isFavorite) {
      setLikeBurst(true);
      setTimeout(() => setLikeBurst(false), 600);
    }
    onToggleFavorite?.(e);
  };

  // Fullscreen lightbox: opens on the currently-selected image, lets the user
  // swipe through the whole gallery at full size.
  const [showLightbox, setShowLightbox] = useState(false);
  const slides = (productImages || []).map((src) => ({ src }));
  const openLightbox = () => {
    if (productImages?.length > 0) setShowLightbox(true);
  };
  const selectedIndex = Math.max(
    0,
    (productImages || []).indexOf(selectedImage),
  );

  const Thumb = ({ image }) => (
    <button
      type="button"
      onClick={() => onSelectImage(image)}
      className={`relative box-border aspect-square w-full shrink-0 overflow-hidden rounded-lg border bg-white dark:bg-zinc-900 transition-all ${
        selectedImage === image
          ? "primaryBorder border-2 shadow-sm"
          : "border-[#E5E7EB] dark:border-zinc-700 opacity-70 hover:opacity-100 hover:border-gray-400"
      }`}
    >
      <ImageWithPlaceholder
        src={image}
        alt={product?.name}
        height={114}
        width={114}
        className="h-full w-full object-contain p-1.5"
      />
    </button>
  );

  // Desktop: clean stacked column on the left, scrolls if it overflows.
  const VerticalThumbs = () =>
    productImages?.length > 0 && (
      <div className="flex max-h-[600px] w-[80px] shrink-0 flex-col gap-2.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
        {productImages.map((image) => (
          <Thumb key={image} image={image} />
        ))}
      </div>
    );

  // Mobile: horizontal swiper below the image. Fixed 64px thumbs so the row
  // height is stable and the arrows center on the thumbnails.
  const overflows = (productImages?.length || 0) > 5;
  const HorizontalThumbs = () =>
    productImages?.length > 0 && (
      <div
        dir={dir}
        className={`relative flex items-center ${overflows ? "px-7" : "px-0"}`}
      >
        {overflows && (
          <button
            type="button"
            aria-label="Previous thumbnails"
            className="thumb-prev absolute left-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            <IoIosArrowBack size={13} />
          </button>
        )}
        <Swiper
          spaceBetween={8}
          slidesPerView="auto"
          modules={[Navigation]}
          navigation={{ prevEl: ".thumb-prev", nextEl: ".thumb-next" }}
          className="brand-swiper w-full [&_.swiper-slide]:!w-16"
        >
          {productImages.map((image) => (
            <SwiperSlide key={image}>
              <Thumb image={image} />
            </SwiperSlide>
          ))}
        </Swiper>
        {overflows && (
          <button
            type="button"
            aria-label="Next thumbnails"
            className="thumb-next absolute right-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            <IoIosArrowForward size={13} />
          </button>
        )}
      </div>
    );

  return (
    <div className="flex h-fit flex-col gap-4 rounded-lg border border-[#DFE3E8] dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 lg:flex-row lg:gap-4">
      {/* Thumbnails — left column on lg+ */}
      {/* eslint-disable-next-line react-hooks/static-components -- VerticalThumbs closes over productImages/onSelectImage/selectedImage; hoisting would require threading all of them as props */}
      {isLgUp && <VerticalThumbs />}

      {/* Main image */}
      <div className="relative min-w-0 flex-1">
        <div className="relative flex w-full h-[380px] sm:h-[500px] lg:h-[600px] items-center justify-center">
          {(() => {
            // Overlay controls. On the zoom path these are rendered INSIDE the
            // ProductZoomImage hover box (via the `overlay` prop) so hovering
            // them never fires the box's mouseleave (no zoom flicker). Each is
            // tagged data-zoom-ignore so the lens ignores moves over them.
            const Overlay = (
              <>
                {/* Wishlist — top-right corner of the image */}
                <button
                  type="button"
                  data-zoom-ignore
                  onClick={handleFavoriteClick}
                  aria-label="wishlist"
                  className="like-btn absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-md transition-transform active:scale-90 hover:scale-110 hover:primaryBorder"
                >
                  {/* Myntra-style heart burst — ring flash + 6 radiating particles. */}
                  {likeBurst && (
                    <span
                      data-zoom-ignore
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          data-zoom-ignore
                          className="like-particle"
                          style={{ "--i": i }}
                        />
                      ))}
                    </span>
                  )}
                  <span
                    data-zoom-ignore
                    className={`relative z-10 flex items-center justify-center ${
                      likeBurst ? "like-pop" : ""
                    }`}
                  >
                    {isFavorite ? (
                      <BiSolidHeart size={20} className="primaryFilledColor" />
                    ) : (
                      <BiHeart
                        size={20}
                        className="text-gray-500 dark:text-zinc-400"
                      />
                    )}
                  </span>
                </button>

                {/* Share — below wishlist, opens Flipkart-style drawer */}
                <button
                  type="button"
                  data-zoom-ignore
                  onClick={onShare}
                  aria-label="share"
                  className="absolute right-2 top-14 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-md hover:primaryBorder"
                >
                  <RiShareForwardLine
                    size={20}
                    className="text-gray-500 dark:text-zinc-400"
                  />
                </button>

                {/* Enlarge — bottom-left. Collapses to an icon; expands the
                    "Click to Enlarge" label on hover. Opens the lightbox. */}
                {selectedImage && (
                  <button
                    type="button"
                    data-zoom-ignore
                    onClick={openLightbox}
                    aria-label={t("click_to_enlarge")}
                    className="group absolute bottom-2 left-2 z-20 flex h-10 items-center gap-0 overflow-hidden rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 shadow-md transition-all hover:gap-2 hover:px-4 hover:primaryBorder"
                  >
                    <MdOutlineZoomOutMap
                      size={18}
                      className="shrink-0 text-gray-600 dark:text-zinc-300"
                    />
                    <span className="max-w-0 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-zinc-200 opacity-0 transition-all duration-200 group-hover:max-w-[160px] group-hover:opacity-100">
                      {t("click_to_enlarge")}
                    </span>
                  </button>
                )}
              </>
            );

            return canHoverZoom ? (
              <ProductZoomImage image={selectedImage} overlay={Overlay} />
            ) : (
              <>
                <ImageWithPlaceholder
                  src={selectedImage}
                  alt={product?.name}
                  width={871}
                  height={871}
                  className="h-full w-full object-contain"
                />
                {Overlay}
              </>
            );
          })()}
        </div>
      </div>

      {/* Thumbnails — horizontal below image on mobile */}
      {/* eslint-disable-next-line react-hooks/static-components -- HorizontalThumbs closes over productImages/dir/overflows/onSelectImage/selectedImage; hoisting would require threading all of them as props */}
      {!isLgUp && <HorizontalThumbs />}

      <Lightbox
        styles={{ container: { backgroundColor: "#000000bf" } }}
        open={showLightbox}
        close={() => setShowLightbox(false)}
        index={selectedIndex}
        slides={slides}
      />
    </div>
  );
};

export default ProductImageGallery;
