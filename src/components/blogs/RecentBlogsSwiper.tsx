import React from "react";
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { t } from "@/utils/translation";
import BlogCard from "./BlogCard";
import useDir from "@/hooks/useDir";
import useIsRtl from "@/hooks/useIsRtl";

interface RecentBlogsSwiperProps {
  recentBlogs: any[];
}

const RecentBlogsSwiper = ({ recentBlogs }: RecentBlogsSwiperProps) => {
  const dir = useDir();
  const rtl = useIsRtl();

  return (
    <div>
      {recentBlogs?.length > 0 ? (
        <section className="bodyBackgroundColor py-10 sm:py-14">
          <div className="container feature-section">
            <div dir={dir}>
              <div className="mb-8 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  {/* eyebrow */}
                  <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] primaryColor">
                    <span className="h-4 w-1 rounded-full primaryBackColor" />
                    {t("blogs") || "Blog"}
                  </span>
                  <h2 className="textColor text-2xl sm:text-3xl font-extrabold leading-tight m-0">
                    {t("recentlyAddedBlogs")}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm SecondaryTextColor leading-relaxed">
                    {t("recentlyAddedBlogsDesc")}
                  </p>
                </div>
                {/* Nav arrows only when there's more than one desktop page to
                    scroll (>3 slides) — otherwise there's nothing to navigate. */}
                {recentBlogs.length > 3 && (
                  <div className="flex shrink-0 items-center">
                    <div
                      className={`hidden gap-2 md:flex ${
                        dir === "RTL" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <button
                      type="button"
                        className="group prev-blog-1 flex h-10 w-10 items-center justify-center rounded-full border cardBorder textColor transition-all duration-200 hover:primaryBackColor hover:border-transparent hover:text-white"
                      >
                        <IoMdArrowBack
                          className="swiperNavButtonColor transition-colors duration-200 group-hover:text-white"
                          size={18}
                        />
                      </button>
                      <button
                      type="button"
                        className="group next-blog-1 flex h-10 w-10 items-center justify-center rounded-full border cardBorder textColor transition-all duration-200 hover:primaryBackColor hover:border-transparent hover:text-white"
                      >
                        <IoMdArrowForward
                          className="swiperNavButtonColor transition-colors duration-200 group-hover:text-white"
                          size={18}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Swiper
                  key={String(rtl)}
                  spaceBetween={20}
                  modules={[Navigation]}
                  className="brand-swiper"
                  navigation={{
                    prevEl: `.prev-blog-1`,
                    nextEl: `.next-blog-1`,
                  }}
                  breakpoints={{
                    1200: {
                      slidesPerView: 3,
                      spaceBetween: 10,
                    },
                    1024: {
                      slidesPerView: 3,
                      spaceBetween: 10,
                    },
                    768: {
                      slidesPerView: 2,
                      spaceBetween: 10,
                    },
                    500: {
                      slidesPerView: 1.5,
                      spaceBetween: 10,
                    },
                    300: {
                      slidesPerView: 1,
                      spaceBetween: 10,
                    },
                  }}
                >
                  {recentBlogs?.map((blog, index) => (
                    <SwiperSlide key={blog.id} className="h-auto">
                      <BlogCard blog={blog} />
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default RecentBlogsSwiper;
