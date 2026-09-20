import React, { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import useIsHydrated from "@/hooks/useIsHydrated";
import { pickDeviceImage } from "@/utils/helperFunction";

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  image?: string;
  headerIcon?: string;
  label?: string;
  collapsed: boolean;
}

// Module-scope so its type stays stable across renders — defined inside the
// parent it got a new type each render, Swiper remounted every slide, flicker.
const Tab = React.memo(function Tab({
  active,
  onClick,
  icon,
  image,
  headerIcon,
  label,
  collapsed,
}: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center w-[76px] cursor-pointer group transition-all duration-300 ease-out ${
        collapsed ? "gap-0 pt-0 pb-1.5" : "gap-1 pt-1 pb-1"
      }`}
    >
      {/* Icon collapses to height 0 + fades + shrinks. transition on all so
          height/opacity/scale animate together → no jump. */}
      <div
        style={{ borderRadius: 5 }}
        className={`relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-out ${
          collapsed
            ? "w-6 h-0 opacity-0 scale-75"
            : "w-6 h-6 sm:w-7 sm:h-7 opacity-100 scale-100"
        }`}
      >
        {image || headerIcon ? (
          <ImageWithPlaceholder
            src={headerIcon || image}
            width={120}
            height={120}
            alt={label}
            className="w-full h-full aspect-square object-contain"
          />
        ) : (
          icon
        )}
      </div>
      <span
        style={{ color: "var(--layout-header-text)" }}
        // overflow-hidden/whitespace-nowrap/text-ellipsis (proper CSS
        // truncation), not line-clamp-1: line-clamp's WebKit box-clamp
        // clipped centered text from BOTH edges when it overflowed the 76px
        // tab, cutting the leading character too (e.g. "Janmashtami"
        // rendered as "anmastami"). Plain text-overflow:ellipsis + centering
        // don't have that problem — the direction:ltr default always
        // truncates from the tail regardless of text-align, so text-center
        // is kept (matches the underline below, which spans the whole tab).
        className={`w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm sm:text-[15px] leading-tight text-center transition-colors ${
          active ? "font-bold" : "font-semibold"
        }`}
      >
        {label}
      </span>
      {/* Active underline flush to the section bottom border (Flipkart-style) */}
      <span
        style={active ? { backgroundColor: "var(--layout-header-text)" } : undefined}
        className="absolute bottom-0 inset-x-0 h-[2px] transition-all duration-200"
      />
    </button>
  );
});

interface CategoryTabsProps {
  /** Category tab rows, raw API shape. */
  categories?: any[];
  selectedId?: number | string | null;
  onSelect?: (categoryId: number | string) => void;
  device?: string;
}

// selectedId defaults to null ("no tab picked"); parent resolves that to the first tab.
const CategoryTabs = ({
  categories = [],
  selectedId = null,
  onSelect,
  device = "web",
}: CategoryTabsProps) => {
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  // Treat as LTR until hydrated so first paint matches the server (no dir/key flip).
  const isHydrated = useIsHydrated();
  const dir = isHydrated ? language?.type : undefined;
  const isRtl = isHydrated && language?.type === "rtl";

  const [headerH, setHeaderH] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Sticky offset = live header height. Also publishes header+strip heights to
  // :root so the shared background image (header top slice + strip bottom
  // slice) stays one seamless image with no repeat.
  useEffect(() => {
    const header = document.getElementById("site-header");
    const root = document.documentElement;
    const measure = () => {
      // getBoundingClientRect (not offsetHeight, which rounds and causes a
      // sub-pixel seam at fractional layout heights).
      const hh = header ? header.getBoundingClientRect().height : 0;
      const sh = stripRef.current
        ? stripRef.current.getBoundingClientRect().height
        : 0;
      setHeaderH(hh);
      root.style.setProperty("--layout-header-h", `${hh}px`);
      root.style.setProperty("--layout-strip-h", `${sh}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    if (stripRef.current) ro.observe(stripRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Collapse/expand driven by whether the bar is sticky under the header, via
  // an IntersectionObserver on a sentinel placed just above the sticky bar
  // (rootMargin offsets by header height so the trigger line matches). Sentinel
  // visible = bar not sticky yet (expand); gone = bar is stuck (collapse).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // isIntersecting === sentinel is above the trigger line == not sticky.
        setCollapsed(!entry.isIntersecting);
      },
      {
        // Trigger line at the header's bottom edge.
        rootMargin: `-${headerH}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [headerH]);

  // Driven by home_layout `category_tabs`. Hide when none returned.
  if (!categories || categories.length === 0) return null;

  return (
    <>
      {/* Sentinel above the sticky bar, drives collapse. 1px tall (h-0 made
          intersection ambiguous); visibility:hidden keeps it unpainted (avoids
          a hairline seam) while staying in layout for the observer. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="h-px -mb-px"
        style={{ visibility: "hidden" }}
      />
      <section
        ref={stripRef}
        dir={dir}
        // No negative margin — would desync the background slice from headerH.
        style={{ top: headerH }}
        className="sticky z-40 layoutHeaderGradientContinue layoutHeaderText "
      >
        <div
          className={`container relative transition-all duration-300 ease-out ${
            collapsed ? "pt-1 pb-0" : "pt-1.5 pb-0"
          }`}
        >
          <Swiper
            dir={dir}
            key={isRtl ? "rtl" : "ltr"}
            modules={[FreeMode, Mousewheel]}
            slidesPerView="auto"
            spaceBetween={16}
            freeMode={{ enabled: true, momentum: true }}
            mousewheel={{ forceToAxis: true }}
            className="!pb-0 !pt-0"
          >
            {/* ids arrive as strings, so compare as strings. */}
            {categories.map((category) => {
              // image_url is either a plain URL (legacy/custom-cat rows) or a
              // per-device object ({app,tablet,web}, current backend shape) —
              // pick the right variant only when it's actually the object form.
              const image =
                category.image_url && typeof category.image_url === "object"
                  ? pickDeviceImage(category.image_url, device)
                  : category.image_url;
              return (
                <SwiperSlide key={category.id} className="!w-auto">
                  <Tab
                    collapsed={collapsed}
                    active={String(selectedId) === String(category.id)}
                    onClick={() => onSelect?.(category.id)}
                    image={image}
                    headerIcon={category.header_icon_url}
                    label={category?.translations?.name ?? category?.name}
                  />
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </section>
    </>
  );
};

export default CategoryTabs;
