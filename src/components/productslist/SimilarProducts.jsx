import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { t } from "@/utils/translation";
import VerticleProductCard from "../productcards/VerticleProductCard";
import * as api from "@/api/apiRoutes";
import { useSelector } from "react-redux";
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import useDir from "@/hooks/useDir";
import useIsRtl from "@/hooks/useIsRtl";

const SimilarProducts = ({ productId }) => {
  const rtl = useIsRtl();
  const dir = useDir();
  const lat = useSelector((state) => state.City.city?.latitude);
  const lng = useSelector((state) => state.City.city?.longitude);
  const language = useSelector((state) => state.Language.selectedLanguage);

  const [similarProducts, setSimilarProducts] = useState([]);
  const [totalSimilarProducts, setTotalSimilarProducts] = useState(0);
  const [offset, setOffset] = useState(0);

  const productPerPage = 10;

  const handleFetchSimilarProducts = async () => {
    try {
      const response = await api.getProductByFilter({
        latitude: lat,
        longitude: lng,
        is_similar_product_id: productId,
      });
      // Card reads product.image_url, but this payload only carries images[]/variants[].image.
      const list = Array.isArray(response?.data)
        ? response.data.map((p) => ({
            ...p,
            image_url:
              p?.image_url ||
              p?.images?.[0]?.image_url ||
              p?.variants?.[0]?.image ||
              "",
          }))
        : [];
      setSimilarProducts(list);
      setTotalSimilarProducts(response.total);
    } catch (error) {
      console.log("Error", error);
    }
  };

  useEffect(() => {
    if (productId && lat != null && lng != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-dependency-change pattern; not derivable from render
      handleFetchSimilarProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, lat, lng, productId]);

  const handleLoadMore = () => {
    if (totalSimilarProducts > similarProducts?.length) {
      setOffset((offset) => offset + productPerPage);
    } else {
      return;
    }
  };

  return similarProducts?.length > 0 ? (
    <div className="overflow-hidden" dir={dir}>
      <div
        className={`flex flex-col gap-1 ${dir === "RTL" ? "flex-row-reverse" : ""}`}
      >
        <div className="font-bold text-lg md:text-xl rounded-sm flex justify-between items-center textColor py-3">
          <h2>{t("similar_product")}</h2>
          <div
            className={` flex  gap-2 ${dir === "RTL" ? "flex-row-reverse" : ""}`}
          >
            <button className="group category-button-next swiperBorderColor rounded-full !p-2 inline-block text-[15px] transition-all duration-200 ease-linear visibility-visible z-10 hover:primaryBackColor hover:text-white hover:primaryBorder">
              <IoMdArrowBack
                className="swiperNavButtonColor group-hover:text-white transition-colors duration-200"
                size={20}
              />
            </button>
            <button className="group category-button-prev swiperBorderColor rounded-full !p-2 inline-block text-[15px] transition-all duration-200 ease-linear visibility-visible z-10 hover:primaryBackColor hover:text-white hover:primaryBorder">
              <IoMdArrowForward
                className="swiperNavButtonColor group-hover:text-white transition-colors duration-200"
                size={20}
              />
            </button>
          </div>
        </div>
        <div>
          <Swiper
            key={rtl}
            spaceBetween={20}
            modules={[Navigation]}
            className="brand-swiper"
            onReachEnd={handleLoadMore}
            navigation={{
              nextEl: ".category-button-prev",
              prevEl: ".category-button-next",
            }}
            breakpoints={{
              0: { slidesPerView: 1.5, spaceBetween: 10 },
              500: { slidesPerView: 2.2, spaceBetween: 10 },
              768: { slidesPerView: 3.3, spaceBetween: 12 },
              1024: { slidesPerView: 4.5, spaceBetween: 12 },
              1280: { slidesPerView: 6.5, spaceBetween: 12 },
            }}
          >
            {similarProducts?.map((product, index) => (
              <SwiperSlide
                key={product.id}
                className={
                  index === similarProducts.length - 1 ? "last-slide" : ""
                }
              >
                <VerticleProductCard product={product} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </div>
  ) : null;
};

export default SimilarProducts;
