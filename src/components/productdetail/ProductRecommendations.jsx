import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import * as api from "@/api/apiRoutes";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";

const VerticleProductCard = dynamic(
  () => import("../productcards/VerticleProductCard"),
  { ssr: false }
);

// Product-scoped recommendations shown on the product detail page. Fetches the
// cart/recommendations API with product_id and renders cross-sell + upsell as
// two horizontal card strips. Reuses HomeVerticleProductCard so add-to-cart /
// variant / favorite all work. Mirrors the checkout RecommendationStrip.
const Strip = ({ id, title, products }) => {
  const rtl = useIsRtl();
  if (!products || products.length === 0) return null;
  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 py-3">
        <span className="font-bold text-lg md:text-xl">{title}</span>
        {products.length > 1 && (
          <div className={`flex gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
            <button
            type="button"
              className={`group rec-prev-${id} swiperBorderColor rounded-full !p-2 inline-block text-[15px] transition-all duration-200 ease-linear z-10 hover:primaryBackColor hover:text-white hover:primaryBorder`}
              aria-label={t("previous") || "Previous"}
            >
              <IoMdArrowBack
                className="swiperNavButtonColor group-hover:text-white transition-colors duration-200"
                size={20}
              />
            </button>
            <button
              type="button"
              className={`group rec-next-${id} swiperBorderColor rounded-full !p-2 inline-block text-[15px] transition-all duration-200 ease-linear z-10 hover:primaryBackColor hover:text-white hover:primaryBorder`}
              aria-label={t("next") || "Next"}
            >
              <IoMdArrowForward
                className="swiperNavButtonColor group-hover:text-white transition-colors duration-200"
                size={20}
              />
            </button>
          </div>
        )}
      </div>
      <div className="pb-2">
        <Swiper
          key={rtl}
          modules={[Navigation]}
          spaceBetween={12}
          slidesOffsetBefore={2}
          slidesOffsetAfter={2}
          style={{ paddingTop: 4, paddingBottom: 4 }}
          navigation={{ prevEl: `.rec-prev-${id}`, nextEl: `.rec-next-${id}` }}
          breakpoints={{
            0: { slidesPerView: 1.5, spaceBetween: 10 },
            500: { slidesPerView: 2.2, spaceBetween: 10 },
            768: { slidesPerView: 3.3, spaceBetween: 12 },
            1024: { slidesPerView: 4.5, spaceBetween: 12 },
            1280: { slidesPerView: 6.5, spaceBetween: 12 },
          }}
        >
          {products.map((product) => (
            <SwiperSlide
              key={product?.variant_id || product?.id}
              className="h-auto"
            >
              <VerticleProductCard product={product} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

const ProductRecommendations = ({ productId }) => {
  const city = useSelector((state) => state.City.city);
  const defaultCity = useSelector(
    (state) => state.Setting?.setting?.default_city
  );
  // Re-fetch when the shop mode (quick / allShop) changes — recommendations are
  // channel-specific (the channel header is injected per active mode).
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const [crossSell, setCrossSell] = useState([]);
  const [upSell, setUpSell] = useState([]);

  useEffect(() => {
    const latitude = city?.latitude || defaultCity?.latitude;
    const longitude = city?.longitude || defaultCity?.longitude;
    if (!productId || !latitude || !longitude) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await api.getCartRecommendations({
          latitude,
          longitude,
          product_id: productId,
          cross_sell_limit: 10,
          cross_sell_offset: 0,
          upsell_limit: 10,
          upsell_offset: 0,
        });
        if (cancelled) return;
        if (response?.status == 1) {
          // Card reads product.image_url, but this payload only carries
          // images[]/variants[].image — derive image_url like SimilarProducts.
          const withImage = (arr) =>
            (Array.isArray(arr) ? arr : []).map((p) => ({
              ...p,
              image_url:
                p?.image_url ||
                p?.images?.[0]?.image_url ||
                p?.images?.[0] ||
                p?.variants?.[0]?.image ||
                "",
            }));
          setCrossSell(withImage(response?.data?.cross_sell?.products));
          setUpSell(withImage(response?.data?.upsell?.products));
        } else {
          setCrossSell([]);
          setUpSell([]);
        }
      } catch (error) {
        console.log("recommendations error", error);
        if (!cancelled) {
          setCrossSell([]);
          setUpSell([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    productId,
    city?.latitude,
    city?.longitude,
    defaultCity?.latitude,
    defaultCity?.longitude,
    shopMode,
  ]);

  if (crossSell.length === 0 && upSell.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <Strip
        id="pd-crosssell"
        title={t("frequently_bought_together")}
        products={crossSell}
      />
      <Strip
        id="pd-upsell"
        title={t("upgrade_your_order")}
        products={upSell}
      />
    </div>
  );
};

export default ProductRecommendations;
