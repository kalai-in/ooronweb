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

const RecentalyViewedProducts = ({ recentalyViewedProducts }) => {
  const rtl = useIsRtl();
  const language = useSelector((state) => state.Language.selectedLanguage);
  const dir = useDir();
  return recentalyViewedProducts?.length > 0 ? (
    <section className="bg-white dark:bg-zinc-900">
      <div className="container py-3 px-2" dir={dir}>
        <div
          className={`flex flex-col gap-1 ${
            dir === "RTL" ? "flex-row-reverse" : ""
          }`}
        >
          <div className="font-bold text-xl rounded-sm flex justify-between items-center textColor py-3">
            <h2>{t("recentaly_products")}</h2>
            <div
              className={` flex  gap-2 ${dir === "RTL" ? "flex-row-reverse" : ""}`}
            >
              <button className=" group category-button-next1 swiperBorderColor rounded-full  !p-2 inline-block text-[15px] relative right-[5%] top-0 transition-all duration-200 ease-linear visibility-visible z-10 hover:primaryBackColor hover:text-white hover:primaryBorder">
                <IoMdArrowBack
                  className="swiperNavButtonColor group-hover:text-white transition-colors duration-200"
                  size={20}
                />
              </button>
              <button className=" group category-button-prev1 swiperBorderColor rounded-full   !p-2 inline-block text-[15px] relative right-[5%] top-0 transition-all duration-200 ease-linear visibility-visible z-10 hover:primaryBackColor hover:text-white hover:primaryBorder">
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
              // `!items-stretch` on the track: Swiper's wrapper is a flex row,
              // and stretching it is what gives the `!h-auto` slides a shared
              // height to fill.
              className="brand-swiper [&_.swiper-wrapper]:!items-stretch"
              navigation={{
                nextEl: ".category-button-prev1",
                prevEl: ".category-button-next1",
              }}
              //   onReachEnd={handleLoadMore}
              breakpoints={{
                0: { slidesPerView: 1.5, spaceBetween: 10 },
                500: { slidesPerView: 2.2, spaceBetween: 10 },
                768: { slidesPerView: 3.3, spaceBetween: 12 },
                1024: { slidesPerView: 4.5, spaceBetween: 12 },
                1280: { slidesPerView: 6.5, spaceBetween: 12 },
              }}
            >
              {recentalyViewedProducts?.map((product, index) => (
                // `!h-auto` overrides Swiper's fixed slide height so the flex
                // row can stretch them; the card's own `h-full` then resolves
                // against the tallest slide instead of its own content. Without
                // it a card with no rating row renders shorter than its
                // neighbours and its Add button sits at a different baseline.
                <SwiperSlide
                  key={product.id}
                  className={`!h-auto ${
                    index === recentalyViewedProducts.length - 1
                      ? "last-slide"
                      : ""
                  }`}
                >
                  <VerticleProductCard product={product} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  ) : null;
};

export default RecentalyViewedProducts;
