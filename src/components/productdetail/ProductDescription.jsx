import React, { useEffect, useRef, useState } from "react";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import NoReviewImage from "@/assets/empty-state/review.svg";
import ProductReviewCard from "./ProductReviewCard";
import RatingImagesModal from "./RatingImagesModal";
import LightBox from "@/components/ui/LightBox";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import { useSelector } from "react-redux";

// Flipkart-style star row renderer.
const StarRow = ({ value = 0, size = "text-sm" }) => (
  <span className={`inline-flex items-center gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <span
        key={s}
        className={s <= Math.round(value) ? "text-amber-400" : "text-gray-300"}
      >
        &#9733;
      </span>
    ))}
  </span>
);

const ProductDescription = ({ product, ratingData }) => {
  const setting = useSelector((state) => state.Setting.setting);

  const [selectedTab, setSelectedTab] = useState(0);
  const [ratingImages, setRatingImages] = useState([]);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [showLightBox, setShowLightBox] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightBoxImages, setLightBoxImages] = useState([]);

  // Description clamp: show "View more" only when the HTML content overflows ~7 lines.
  const descRef = useRef(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isDescClamped, setIsDescClamped] = useState(false);

  const productImagesCount = 8;

  const fetchProductImages = async () => {
    try {
      const result = await api.getProductImages({
        id: product?.id,
        limit: productImagesCount,
        offset: 0,
      });
      setRatingImages(result.data);
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches rating images for the current product
    fetchProductImages();
    // fetchProductImages intentionally omitted: it's re-created each render
    // and only product?.id changing should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Detect whether description overflows its collapsed clamp; re-check on resize.
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const check = () => setIsDescClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [product?.translations?.description, product?.description, selectedTab]);

  const handleProductDescSelect = () => {
    setSelectedTab(0);
  };

  const handleProductReviewSelect = () => {
    setSelectedTab(1);
  };

  const handleOpenImagesModal = () => {
    setShowImagesModal(true);
  };

  const handleLightBox = (index) => {
    const images = ratingImages?.map((img) => ({
      src: img?.src ? img?.src : img,
    }));
    setLightBoxImages(images);
    setImageIndex(index);
    setShowLightBox(true);
  };

  const ratings = [
    { stars: 5, count: ratingData?.five_star_rating ?? 0 },
    { stars: 4, count: ratingData?.four_star_rating ?? 0 },
    { stars: 3, count: ratingData?.three_star_rating ?? 0 },
    { stars: 2, count: ratingData?.two_star_rating ?? 0 },
    { stars: 1, count: ratingData?.one_star_rating ?? 0 },
  ];
  const totalRatings = ratings.reduce(
    (total, rating) => total + rating.count,
    0,
  );
  const averageRating =
    totalRatings > 0
      ? (
          ratings.reduce((sum, { stars, count }) => sum + stars * count, 0) /
          totalRatings
        ).toFixed(1)
      : "0.0";

  // Show the Rating tab when the product allows ratings OR any rating data
  // actually exists. `product_rating` can arrive as true/1/"1" depending on the
  // backend, so coerce loosely instead of strict `== true`.
  const showRatingTab =
    !!product?.product_rating ||
    totalRatings > 0 ||
    (ratingData?.average_rating ?? 0) > 0;

  return (
    <div>
      <div className="rounded-xl my-2 cardBorder overflow-hidden">
        <div className="flex items-stretch gap-1 px-2 sm:px-4 border-b">
          <button
            type="button"
            className={`relative text-sm sm:text-base font-semibold px-3 sm:px-4 py-3 cursor-pointer transition-colors ${
              selectedTab == 0
                ? "primaryColor"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={handleProductDescSelect}
          >
            {t("product_desc_title")}
            {selectedTab == 0 && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 primaryBackColor rounded-full" />
            )}
          </button>
          {showRatingTab && (
            <button
              type="button"
              className={`relative text-sm sm:text-base font-semibold px-3 sm:px-4 py-3 cursor-pointer transition-colors flex items-center gap-1.5 ${
                selectedTab == 1
                  ? "primaryColor"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={handleProductReviewSelect}
            >
              {t("rating_and_reviews")}
              {totalRatings > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-bold text-gray-500">
                  {totalRatings.toLocaleString()}
                </span>
              )}
              {selectedTab == 1 && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 primaryBackColor rounded-full" />
              )}
            </button>
          )}
        </div>
        <div className=" ">
          {selectedTab == 0 ? (
            <div className="p-4 flex flex-col gap-6">
              {(product?.translations?.description ?? product?.description) ? (
                <div className="flex flex-col items-start gap-2">
                  <div
                    ref={descRef}
                    className={`overflow-x-auto md:overflow-hidden api-html-content ${
                      isDescExpanded ? "" : "line-clamp-[7]"
                    }`}
                    dangerouslySetInnerHTML={sanitizeHtml(
                      product?.translations?.description ??
                        product?.description,
                    )}
                  />
                  {(isDescClamped || isDescExpanded) && (
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded((prev) => !prev)}
                      className="primaryColor text-sm font-medium underline underline-offset-2"
                    >
                      {isDescExpanded ? t("view_less") : t("view_more")}
                    </button>
                  )}
                </div>
              ) : (
                <p>{t("no_product_description")}</p>
              )}
            </div>
          ) : (
            <></>
          )}
          {selectedTab == 1 && (
            <div className="p-4 sm:p-6">
              {totalRatings != 0 ? (
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                  {/* Summary column (Flipkart-style): big score + stars + total,
                      then per-star bar breakdown. */}
                  <div className="lg:w-72 shrink-0 lg:sticky lg:top-4 lg:self-start rounded-2xl border border-[var(--border-color)] bg-gray-50/60 dark:bg-zinc-900/40 p-5">
                    <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-color)]">
                      <div className="flex flex-col items-center">
                        <span className="flex items-end gap-1">
                          <span className="text-4xl font-bold textColor leading-none">
                            {(ratingData?.average_rating ?? 0).toFixed(
                              setting?.decimal_point || 1,
                            )}
                          </span>
                          <span className="text-xl text-amber-400 leading-none mb-0.5">
                            &#9733;
                          </span>
                        </span>
                        <StarRow
                          value={ratingData?.average_rating ?? averageRating}
                          size="text-base mt-1"
                        />
                      </div>
                      <p className="text-sm SecondaryTextColor leading-snug">
                        {totalRatings.toLocaleString()}{" "}
                        {t("rating_and_reviews")}
                      </p>
                    </div>

                    {/* Per-star bars */}
                    <div className="mt-4 flex flex-col gap-2.5">
                      {ratings.map(({ stars, count }) => {
                        const percentage = (count / totalRatings) * 100;
                        let barColor = "bg-red-400";
                        if (stars >= 4) barColor = "bg-green-500";
                        else if (stars == 3) barColor = "bg-amber-400";
                        return (
                          <div
                            key={stars}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="flex items-center gap-0.5 w-7 font-medium textColor">
                              {stars}
                              <span className="text-amber-400">&#9733;</span>
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs SecondaryTextColor tabular-nums">
                              {count.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reviews column */}
                  <div className="flex-1 min-w-0">
                    {ratingImages?.length > 0 && (
                      <div className="flex flex-col gap-3 pb-5 mb-5 border-b border-[var(--border-color)]">
                        <p className="font-semibold text-sm textColor">
                          {t("customer_photos")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {ratingImages?.slice(0, 6)?.map((image, index) => (
                            <div
                              className="relative w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border border-[var(--border-color)] cursor-pointer transition-transform hover:scale-105"
                              key={image?.src ?? image}
                            >
                              <ImageWithPlaceholder
                                src={image}
                                alt="Rating image"
                                className="h-full w-full object-cover"
                                handleOnClick={() => handleLightBox(index)}
                                height={400}
                                width={400}
                              />
                              {index === 5 && ratingImages?.length > 6 && (
                                <button
                                  type="button"
                                  onClick={handleOpenImagesModal}
                                  className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm"
                                >
                                  {`+${ratingImages?.length - 5}`}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h3 className="text-base font-semibold textColor mb-3">
                      {t("customer_feedbacks")}
                    </h3>
                    <div className="flex flex-col divide-y divide-[var(--border-color)]">
                      {ratingData?.rating_list?.map((review) => (
                        <ProductReviewCard
                          key={
                            review?.id ??
                            `${review?.user?.id}-${review?.updated_at}`
                          }
                          review={review}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center mx-auto gap-3 py-8">
                  <ThemedSvg
                    src={NoReviewImage}
                    alt="No review found"
                    className="w-32 max-w-[160px]"
                  />
                  <h2 className="text-lg md:text-xl font-bold textColor">
                    {t("no_ratings_available_yet")}
                  </h2>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <RatingImagesModal
        showImagesModal={showImagesModal}
        setShowImagesModal={setShowImagesModal}
        images={ratingImages}
      />
      <LightBox
        showLightBox={showLightBox}
        setShowLightBox={setShowLightBox}
        images={lightBoxImages}
        imageIndex={imageIndex}
      />
    </div>
  );
};

export default ProductDescription;
