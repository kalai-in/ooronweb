import React from "react";
import { useRouter } from "next/router";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import ImageWithPlaceholder from "@/components/image-with-placeholder/ImageWithPlaceholder";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useDir from "@/hooks/useDir";
import { toCssAspectRatio } from "@/utils/helperFunction";

// Renders a home_layout "brand_section" block. Supported layouts:
//   horizontal  -> single scrollable row of square chips
//   circular    -> single scrollable row of round chips
//   grid        -> N-column grid (N from config.grid_columns; legacy "grid_<n>" also works)
// config.brand_gap / brand_radius / show_name / section_title control the UI
// (legacy chip_gap / chip_radius still honored as fallback).
const BrandSection = ({ block, borderRadius }) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const dir = useDir();
  const router = useRouter();

  const brands = block?.brands || [];
  if (brands.length === 0) return null;

  const layout = String(block?.layout || "horizontal");
  const isCircular = layout === "circular";
  const isRow = layout === "horizontal" || isCircular;
  // Column count: prefer config.grid_columns, fall back to legacy "grid_<n>" layout suffix, then 4.
  // Cap at brand count so fewer brands than columns fill the row (no empty slots).
  const configCols =
    Number.parseInt(block?.config?.grid_columns, 10) ||
    Number.parseInt(layout.split("_")[1], 10) ||
    4;
  const cols = Math.min(configCols, brands.length);

  const gap = block?.config?.brand_gap ?? block?.config?.chip_gap ?? 8;
  const chipRadius = block?.config?.brand_radius ?? block?.config?.chip_radius ?? 12;
  const radius = isCircular ? "9999px" : `${chipRadius}px`;
  const showName = block?.config?.show_name !== false;

  // `variant` decides which adornments the block shows — same contract as
  // CategorySection / ProductSliderSection:
  //   "with_title"      → title only, no backdrop
  //   "with_background" → title + background image
  //   "with_color"      → title + background_color + text_color (no image)
  //   "default"/unset   → plain block: NO title, NO background, NO colors.
  // The admin may leave fields populated from a previously selected variant, so
  // they are ignored BY VARIANT rather than by emptiness.
  const config = block?.config || {};
  const variant = config?.variant;
  const isDefault = !variant || variant === "default";
  const isColorVariant = variant === "with_color";

  const showTitle = isDefault ? false : !!config?.section_title;
  const title = showTitle ? config?.section_title : null;

  // Background IMAGE: only for the image-backed variant, and only when a real
  // URL is present (the payload sends "" when none is configured).
  const hasBg =
    !isDefault && variant !== "with_title" && variant !== "with_color"
      ? !!config?.background_image_url
      : false;

  // Background COLOR: only for "with_color". null-safe — the API sends explicit
  // nulls on the other variants.
  const backgroundColor = isColorVariant
    ? config?.background_color || null
    : null;
  // Text colour applies to any variant that paints its own backdrop: on
  // "with_background" the title sits ON the artwork, where the default dark-gray
  // heading can be unreadable. Still ignored on "default" (no adornments).
  const textColor = isDefault ? null : config?.text_color || null;
  // Chip caption colour — configured independently of the heading's text_color,
  // since the captions sit under the chips rather than on the panel itself.
  const itemTextColor = isDefault ? null : config?.item_text_color || null;

  // block_padding: a number → that padding inside the panel; null/unset → none.
  const blockPadding = Number.isFinite(Number(config?.block_padding))
    ? Number(config.block_padding)
    : 0;
  // A 10px left/right gutter, but ONLY on the horizontal/circular rows — there
  // the chips run past the block edge, so without it the first one sits flush
  // against it. It's a BASE, not a fallback: block_padding stacks on top
  // (block_padding 5 → 15px horizontal). Same rule as the product slider.
  //
  // The grid layout does NOT take the base: its chips are laid out inside the
  // block already, and the extra gutter only narrowed them. It gets whatever
  // block_padding the backend sent, and nothing when that is unset.
  const BASE_INLINE_PADDING = isRow ? 10 : 0;
  const blockPaddingStyle = {
    paddingTop: blockPadding,
    paddingBottom: blockPadding,
    paddingLeft: BASE_INLINE_PADDING + blockPadding,
    paddingRight: BASE_INLINE_PADDING + blockPadding,
  };

  // Aspect ratio for the BACKGROUND artwork. This block names the key
  // `bg_image_aspect`; `image_aspect` is accepted too, since the sibling
  // sections use that name for the same idea.
  //
  // It sets a MINIMUM height, not a fixed one: the panel's height is driven by
  // its content (title + brand chips), and pinning it to a ratio would crop the
  // chips on a narrow viewport. So the ratio is the floor and the panel grows
  // past it when the content needs more room.
  //
  // Expressed as a padding-top percentage (H/W) rather than `aspect-ratio`,
  // because the spacer below is zero-width — see the comment at its usage.
  const bgAspectPadding = (() => {
    if (!hasBg) return undefined;
    const ratio = toCssAspectRatio(
      config?.bg_image_aspect ?? config?.image_aspect,
    );
    if (!ratio) return undefined;
    const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
    if (!w || !h) return undefined;
    return `${(h / w) * 100}%`;
  })();

  const handleBrandClick = (brand) => {
    // Filter values live in the URL (see useUrlProductFilters) — seed brand_ids
    // there directly, same as CategorySection's handleCategoryClick does for
    // category_id. buildQueryPatch starts from an empty query so this replaces
    // any stale filters from a prior /products visit.
    router.push({
      pathname: zoneHref("/products"),
      query: buildQueryPatch({ brand_ids: [brand.id] }),
    });
  };

  // Single brand chip — shared by the draggable row swiper and the CSS grid.
  const renderChip = (brand, { inSlide = false } = {}) => {
    // In a swiper slide the chip always fills it; outside a slide, a row
    // layout sizes chips to a fixed width while a grid fills its cell.
    const chipWidthClass =
      inSlide || !isRow ? "w-full" : "shrink-0 w-[72px] sm:w-20";
    return (
    <button
    type="button"
      key={brand.id}
      onClick={() => handleBrandClick(brand)}
      className={`flex flex-col items-center text-center cursor-pointer group ${chipWidthClass}`}
    >
      <div
        className={`w-full max-w-[110px] sm:max-w-[130px] mx-auto aspect-square overflow-hidden bg-white dark:bg-zinc-900 transition-all duration-200 group-hover:shadow-md border`}
        style={{
          borderRadius: radius,
          borderColor: "color-mix(in srgb, var(--primary-color) 25%, transparent)",
        }}
      >
        <ImageWithPlaceholder
          src={brand.image_url}
          width={300}
          height={300}
          alt={brand?.translations?.name ?? brand?.name}
          className={`w-full h-full aspect-square object-contain p-2`}
        />
      </div>
      {showName && (
        // Chip captions use `item_text_color`, which is configured separately
        // from the heading's `text_color` — the two sit on different backdrops
        // (heading on the panel, captions under the chips), so one colour can't
        // serve both. Unset → the default slate, readable on a plain block.
        <span
          className={`text-[11px] sm:text-xs leading-tight mt-2 w-full line-clamp-1 font-medium ${
            itemTextColor ? "" : "text-slate-700 dark:text-zinc-300"
          }`}
          style={itemTextColor ? { color: itemTextColor } : undefined}
        >
          {brand?.translations?.name ?? brand?.name}
        </span>
      )}
    </button>
    );
  };

  // Corner radius on the backdrop panel: an explicit borderRadius always wins
  // (applied via inline style below); otherwise fall back to the "default"
  // rounded-3xl look, but only when there's actually a backdrop to round.
  const panelRoundedClass =
    borderRadius == null && (hasBg || backgroundColor) ? "rounded-3xl" : "";

  return (
    <section dir={dir}>
      {/* Backdrop panel — carries the configured background image or colour and
          the section's corner radius. With no backdrop configured it is an inert
          wrapper, so the plain "default" variant renders exactly as before. */}
      <div
        className={`relative overflow-hidden ${panelRoundedClass}`}
        style={{
          ...(borderRadius != null ? { borderRadius } : {}),
          ...(hasBg
            ? {
                backgroundImage: `url(${config.background_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
          ...(backgroundColor ? { backgroundColor } : {}),
          // Set on the panel (not just the heading) so the title and anything
          // else inheriting colour picks it up.
          ...(textColor ? { color: textColor } : {}),
        }}
      >
        {/* Ratio spacer: a zero-WIDTH float whose padding-top is a percentage of
            the panel's width (percentage padding always resolves against width,
            which is why this works where `aspect-ratio` would not — on a
            zero-width box that computes to zero height).
            Floating it keeps the content in normal flow at the top, so the panel
            settles at max(ratio height, content height) — a floor, not a cap. */}
        {bgAspectPadding && (
          <div
            aria-hidden
            className="float-left w-0"
            style={{ paddingTop: bgAspectPadding }}
          />
        )}
        {/* NOT cleared: the content must sit ALONGSIDE the spacer (which is
            zero-width, so nothing is displaced), letting the panel resolve to
            max(ratio, content). Clearing it would stack the two and double the
            height. The parent's overflow-hidden makes the float count toward the
            panel's height. */}
        <div className="relative" style={blockPaddingStyle}>
          {title && (
            // The default gray/zinc classes are dropped when the API sets a
            // text_color — a Tailwind colour class beats the inherited `color`
            // from the panel, so the configured colour would never show up.
            <h2
              className={`text-xl sm:text-3xl font-extrabold leading-[1.1] mt-0 mb-4 ${
                textColor ? "" : "text-gray-900 dark:text-zinc-100"
              }`}
              style={textColor ? { color: textColor } : undefined}
            >
              {title}
            </h2>
          )}
          {/* horizontal/circular → swiper; grid → CSS grid. Same shape on mobile + desktop. */}
          {isRow ? (
          <>
            {/* Mobile: autoplay swiper */}
            <div className="sm:hidden">
              <Swiper
                key={dir}
                modules={[Autoplay]}
                slidesPerView={4.2}
                spaceBetween={gap}
                loop={brands.length > 4}
                autoplay={{ delay: 2000, disableOnInteraction: false, pauseOnMouseEnter: true }}
              >
                {brands.map((brand) => (
                  <SwiperSlide key={brand.id}>
                    {renderChip(brand, { inSlide: true })}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
            {/* Desktop: mouse-draggable free-mode swiper */}
            <div className="hidden sm:block">
              <Swiper
                key={dir}
                modules={[FreeMode]}
                freeMode={true}
                slidesPerView="auto"
                spaceBetween={gap}
                grabCursor={true}
                className="!pb-1 [&_.swiper-slide]:!w-[72px] sm:[&_.swiper-slide]:!w-20"
              >
                {brands.map((brand) => (
                  <SwiperSlide key={brand.id}>
                    {renderChip(brand, { inSlide: true })}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </>
          ) : (
            <div
              className="grid items-start"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: `${gap}px`,
              }}
            >
              {brands.map((brand) => renderChip(brand))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default React.memo(BrandSection);
