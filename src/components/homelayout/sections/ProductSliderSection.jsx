import React from "react";
import { IoArrowForward } from "react-icons/io5";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import HomeVerticleProductCard from "../../productcards/HomeVerticleProductCard";
import HomeListViewCard from "../../productcards/HomeListViewCard";
import useT from "@/hooks/useT";
import useIsRtl from "@/hooks/useIsRtl";
import {
  clearAllFilter,
  setBlockSource,
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import * as api from "@/api/apiRoutes";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useDir from "@/hooks/useDir";
import { toCssAspectRatio } from "@/utils/helperFunction";

const ProductSliderSection = ({ block, borderRadius }) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const rtl = useIsRtl();
  const tr = useT();
  const dispatch = useDispatch();
  const router = useRouter();
  const dir = useDir();
  // The categories lookup in handleSeeAll is location-scoped (the API requires
  // coords for the category fetch), so read them as primitives — selecting the
  // City slice object would re-render this block on every unrelated City change.
  const cityLat = useSelector((state) => state.City.city?.latitude);
  const cityLng = useSelector((state) => state.City.city?.longitude);

  const config = block?.config || {};
  const products = block?.products || [];

  // Home-layout "See All": the block tells us how it sourced its products.
  // "manual" → forward the explicit id CSV (config.manual_product_ids). Other
  // id-carrying sources keep their id at the *block* level:
  // category → block.category_id, brand → block.brand_id. Forward that as
  // source_id; id-less sources (most_favorite, …) forward only the data_source.
  const dataSource = config?.data_source ?? block?.data_source ?? "";
  // "View More" button shows only when preview images exist (non-empty array).
  // null/undefined/[] → optional chaining yields falsy length → hidden.
  // Empty/absent array → no button at all. Falsy length covers null, undefined and [].
  // Only real image strings count, so an array of ""/null never renders an empty bar.
  const viewMorePreviewImages = (
    config?.viewMorePreviewImages ??
    block?.viewMorePreviewImages ??
    []
  ).filter(Boolean);
  const hasViewMore = viewMorePreviewImages.length > 0;
  // Overlapping avatar stack caps at 3 — more than that and the pill crowds the label.
  const previewThumbs = viewMorePreviewImages.slice(0, 3);
  const manualProductIds =
    config?.manual_product_ids ?? block?.manual_product_ids ?? "";
  // Pick the first value that carries a real id, normalised to the CSV string
  // the backend expects. Two things this has to survive:
  //   - `??` is not enough: it only falls through on null/undefined, while the
  //     payload marks "no ids of this kind" with "" or [], so a plain ?? chain
  //     stopped at an empty value and never reached the populated field.
  //   - the id arrives as a number, a CSV string, or an array depending on the
  //     source, so anything non-empty is coerced to a string here.
  const firstId = (...values) => {
    const hit = values.find(
      (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
    if (hit == null) return "";
    return Array.isArray(hit)
      ? hit.filter((x) => x != null && x !== "").join(",")
      : String(hit);
  };

  // Which id a block carries is decided by its data_source, not by whichever
  // field happens to be populated.
  //
  // The live payload names the category field `category_id` (SINGULAR, at block
  // level — verified against home_layout). The plural `category_ids` / config
  // variants are kept as fallbacks for older payload shapes; reading only those
  // is why See All sent data_source=category with no category_id at all.
  const sourceId =
    dataSource === "category"
      ? firstId(
          block?.category_id,
          block?.category_ids,
          config?.category_id,
          config?.category_ids,
        )
      : dataSource === "brand"
        ? firstId(
            block?.brand_id,
            block?.brand_ids,
            config?.brand_id,
            config?.brand_ids,
          )
        : firstId(
            block?.brand_id,
            block?.brand_ids,
            block?.category_id,
            block?.category_ids,
            config?.brand_id,
            config?.brand_ids,
            config?.category_id,
            config?.category_ids,
          );

  const handleSeeAll = async () => {
    // Reset stale filters first, then seed this block's source.
    dispatch(clearAllFilter({}));
    dispatch(
      setBlockSource({
        data_source: dataSource,
        manual_product_ids: manualProductIds,
        source_id: sourceId,
      }),
    );
    // category_id (URL-owned) collected here, applied on the single push below.
    let categoryIdPatch = null;

    // A category block must land on /products in the SAME state as clicking a
    // category chip, or a parent category shows only its own products and none
    // from its children. ProductsList keys that whole flow on `category_slug`
    // (it fetches the category's `cat_active_childs` and rewrites category_id to
    // the CSV of the leaf descendants — see its one-shot resolution effect), so
    // seeding only data_source/source_id leaves children out.
    //
    // The block carries just `category_id`, no slug or name, so look the
    // category up to recover them. Awaited before navigating so the products
    // page mounts with the flow already seeded rather than filtering twice.
    if (dataSource === "category" && sourceId) {
      try {
        const res = await api.getCategories({
          latitude: cityLat,
          longitude: cityLng,
        });
        const rows = Array.isArray(res?.data) ? res.data : [];
        // `id` is ignored by this endpoint (it returns the whole list), so match
        // client-side. Only the first id matters: a CSV here would come from a
        // multi-category block, which has no single category flow to enter.
        const wantedId = String(sourceId).split(",")[0].trim();
        const match = rows.find((c) => String(c?.id) === wantedId);
        if (match?.slug) {
          dispatch(setListingSource({ data: "category" }));
          dispatch(setCategorySlug({ data: match.slug }));
          dispatch(
            setCategoryBreadcrumb({
              data: [
                {
                  id: match.id,
                  name: match?.translations?.name || match?.name,
                  slug: match.slug,
                },
              ],
            }),
          );
          categoryIdPatch = match.id;
        }
      } catch (error) {
        // Non-fatal: fall through to the plain data_source/source_id listing,
        // which still shows the category's own products.
        console.log("See All category resolve failed", error?.message);
      }
    }

    router.push({
      pathname: zoneHref("/products"),
      query: categoryIdPatch
        ? buildQueryPatch({ category_id: categoryIdPatch })
        : {},
    });
  };

  if (products.length === 0) return null;

  const layout = String(block?.layout || "horizontal");
  const isGrid = layout.startsWith("grid");
  const isList = layout === "list";
  const gap = Number(config?.product_grid_gap) || 0;
  // Grid column count: prefer config.grid_columns, fall back to legacy "grid_<n>" suffix.
  // Cap at product count so fewer products than columns still fill the row (no empty slots).
  const gridCols =
    parseInt(config?.grid_columns, 10) ||
    parseInt(layout.split("_")[1], 10) ||
    0;
  // `variant` decides which adornments the block shows:
  //   "with_title"      → title only, no background
  //   "with_background" → title + background image
  //   "with_color"      → title + background_color + text_color (no image)
  //   "default"/unset   → plain block: NO title, NO background, NO colors.
  //     The admin may still have those fields filled from a previous variant, so
  //     they are ignored by variant rather than by emptiness.
  const variant = config?.variant;
  const isDefault = !variant || variant === "default";
  const isColorVariant = variant === "with_color";

  // Every variant except "default" shows the title when one is configured.
  const showTitle = isDefault ? false : !!config?.section_title;
  const title = showTitle ? config?.section_title : null;

  // Background IMAGE: only for the image-backed variant.
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
  // heading can be unreadable. Still ignored on "default" (no adornments at all).
  const textColor = isDefault ? null : config?.text_color || null;

  // home_layout products come in two shapes: sparse (empty name/variants/image_url) and
  // full (real variants + nested images). Adapt both to the shape the cards expect so
  // they show a title, image, price and no "undefined undefined" variant pill.
  // `images` is `[{ image_url }]`; older payloads sent `[string]`.
  const firstImage = (p) => {
    const img = p?.images?.[0];
    return (
      p?.image_url || (typeof img === "string" ? img : img?.image_url) || ""
    );
  };

  // Real variants miss the card-only fields (measurement/unit/status/is_unlimited_stock).
  // Backfill them so the variant pill and stock/availability checks work.
  const adaptVariant = (v, p) => ({
    ...v,
    price: v?.price ?? p?.price ?? p?.min_price ?? 0,
    discounted_price: v?.discounted_price ?? 0,
    stock: v?.stock ?? 0,
    is_unlimited_stock: v?.is_unlimited_stock ?? p?.is_unlimited_stock ?? 0,
    status: v?.status ?? 1,
    measurement: v?.measurement ?? v?.attributes_text ?? "",
    unit: v?.unit ?? { short_code: "" },
  });

  const adaptProduct = (p) => {
    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;
    return {
      ...p,
      name: p?.name || p?.short_description || "",
      image_url: firstImage(p),
      // cart add-flows gate on total_allowed_quantity; home payload omits it.
      total_allowed_quantity: p?.total_allowed_quantity ?? p?.stock ?? 999,
      average_rating: p?.average_rating ?? p?.rating ?? 0,
      variants: hasVariants
        ? p.variants.map((v) => adaptVariant(v, p))
        : [
            {
              id: p?.variant_id ?? p?.id,
              price: p?.price ?? p?.min_price ?? 0,
              discounted_price: p?.discounted_price ?? 0,
              stock: p?.stock ?? 0,
              is_unlimited_stock: 1, // keep selectable on home (sparse data has no real stock)
              status: 1,
              measurement: "",
              unit: { short_code: "" },
            },
          ],
    };
  };

  // API-driven card corner radius (0 = square). Applied via an overflow-hidden wrapper
  // so it overrides each card's own rounded-* classes.
  const cardRadius = config?.product_card_radius;
  // block_padding: a number → that padding on all sides; null/unset → none.
  const blockPadding = Number.isFinite(Number(config?.block_padding))
    ? Number(config.block_padding)
    : null;
  const hasPadding = blockPadding != null;
  // A 10px left/right gutter, but ONLY on the horizontal slider — there the track
  // runs past the block edge, so without it the first card sits flush against it.
  // It's a BASE, not a fallback: block_padding stacks on top (block_padding 5 →
  // 15px horizontal).
  //
  // The grid and list layouts do NOT take the base: their cards are laid out
  // inside the block already, and the extra gutter only narrowed them. They get
  // whatever block_padding the backend sent, and nothing when that is unset.
  //
  // The SAME resolved value feeds the title and the products below it — the two
  // must sit on one edge, so any change here has to reach both paths (the
  // padding-based one and the slider's slidesOffset*).
  const BASE_INLINE_PADDING = isGrid || isList ? 0 : 10;
  const inlinePadding = BASE_INLINE_PADDING + (hasPadding ? blockPadding : 0);
  // Vertical padding only. The horizontal gutter is applied per-child instead of
  // on this wrapper so the horizontal slider can opt OUT of it — see
  // sliderBleedStyle.
  const blockPaddingStyle = {
    paddingTop: hasPadding ? blockPadding : 0,
    paddingBottom: hasPadding ? blockPadding : 0,
  };
  // Everything that is NOT the horizontal slider (title, grid, list, View More)
  // sits inside the gutter.
  const inlinePaddingStyle = {
    paddingLeft: inlinePadding,
    paddingRight: inlinePadding,
  };
  // NOTE: the horizontal slider gets NO wrapper padding and NO negative margin.
  // Both were ways of shifting the whole track, and either one lands the first
  // card on a different edge than the title above it. Its gutter is applied
  // INSIDE Swiper's clipper via slidesOffsetBefore/After — same inlinePadding
  // value, so the two stay aligned — while the track still spans the full block,
  // letting the partially visible card be cut by the block edge, not by padding.

  // image_aspect ("3:1") shapes the BACKGROUND artwork, matching how the banner /
  // grid / title-image sections read the same key.
  //
  // It sets a MINIMUM height, not a fixed one: this panel's height is driven by
  // its content (title + product cards), and pinning it to a ratio would crop the
  // cards on a narrow viewport. So the ratio is the floor — the artwork gets its
  // full shape — and the panel grows past it when the content needs more room.
  //
  // Expressed as a padding-top percentage (H/W) rather than `aspect-ratio`,
  // because the spacer below is zero-width: see the comment there.
  const bgAspectPadding = (() => {
    if (!hasBg) return undefined;
    const ratio = toCssAspectRatio(config?.image_aspect);
    if (!ratio) return undefined;
    const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
    if (!w || !h) return undefined;
    return `${(h / w) * 100}%`;
  })();

  const cardWrap = (product) => (
    <div className="h-full">
      <HomeVerticleProductCard
        product={adaptProduct(product)}
        radius={cardRadius}
      />
    </div>
  );

  // Full-featured horizontal card for the "list" layout (offer, rating, variants, Add).
  const listRow = (product) => (
    <HomeListViewCard
      key={product.id}
      product={adaptProduct(product)}
      radius={cardRadius}
    />
  );

  return (
    <section>
      {/* Full-bleed slider panel — spans the full screen width (no .container
            gutters). With a configured background_image_url it shows the artwork. */}
      <div
        className={`relative overflow-hidden ${borderRadius != null ? "" : "rounded-3xl"}`}
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
        <div className="relative" style={blockPaddingStyle} dir={dir}>
          {/* Header — only when a title is set (and nav arrows for horizontal sliders).
              No title (e.g. paired with a TextSection) → skip to avoid an empty header gap. */}
          {title && (
            <div
              className="flex justify-between items-center gap-3 mb-3"
              style={inlinePaddingStyle}
            >
              {title ? (
                // The default gray/zinc classes are dropped when the API sets a
                // text_color — a Tailwind colour class beats the inherited
                // `color` from the panel, so the configured colour would never
                // show up on the heading.
                <h2
                  className={`text-xl sm:text-3xl font-extrabold leading-[1.1] m-0 ${
                    textColor ? "" : "text-gray-900 dark:text-zinc-100"
                  }`}
                  style={textColor ? { color: textColor } : undefined}
                >
                  {title}
                </h2>
              ) : (
                <span />
              )}
            </div>
          )}

          {isGrid ? (
            <div
              className={`grid mt-2 ${
                gridCols
                  ? ""
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              }`}
              style={{
                ...inlinePaddingStyle,
                // grid_columns is device-specific (backend returns 3/5/10 for app/tablet/web),
                // so apply it at every width. Unset → responsive default that widens with viewport.
                gap: `${gap}px`,
                ...(gridCols
                  ? {
                      gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                    }
                  : {}),
              }}
            >
              {products.map((product) => (
                <React.Fragment key={product.id}>
                  {gridCols === 1 ? (
                    <div className="w-full max-w-[220px]">
                      {cardWrap(product)}
                    </div>
                  ) : (
                    cardWrap(product)
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : isList ? (
            <div
              className="mt-2 grid grid-cols-1 sm:grid-cols-2 items-stretch"
              style={{ ...inlinePaddingStyle, gap: `${gap}px` }}
            >
              {products.map((product) => (
                <div key={product.id} className="h-full">
                  {listRow(product)}
                </div>
              ))}
            </div>
          ) : (
            <div className={`relative ${title ? "mt-6" : "mt-2"}`}>
              {/* No nav arrows: the track is drag/swipe only, on desktop as well
                  as touch. The grab cursor below is the only affordance. */}
              <Swiper
                key={rtl}
                // `dir` is set here as well as on the block wrapper: Swiper reads
                // it off its OWN container to decide slide order and which edge
                // the offsets below apply to, so inheriting it is not enough.
                dir={dir}
                slidesPerView={1.6}
                spaceBetween={gap}
                // The gutter, applied INSIDE the clipper — see the note next to
                // inlinePaddingStyle. Keeps the first card on the same edge as the
                // title, and gives the last card the same room at the track's end.
                slidesOffsetBefore={inlinePadding}
                slidesOffsetAfter={inlinePadding}
                observer={true}
                observeParents={true}
                // Mouse drag on desktop — without this the track only responds to
                // touch, leaving desktop with no way to scroll now the arrows are
                // gone. `grabCursor` swaps the pointer to grab/grabbing.
                grabCursor={true}
                simulateTouch={true}
                className="brand-swiper [&_.swiper-wrapper]:items-stretch"
                breakpoints={{
                  1536: { slidesPerView: 6, spaceBetween: gap },
                  1280: { slidesPerView: 6, spaceBetween: gap },
                  1024: { slidesPerView: 4, spaceBetween: gap },
                  768: { slidesPerView: 3, spaceBetween: gap },
                  640: { slidesPerView: 2.5, spaceBetween: gap },
                  480: { slidesPerView: 2.2, spaceBetween: gap },
                  0: { slidesPerView: 1.6, spaceBetween: gap },
                }}
              >
                {products.map((product) => (
                  <SwiperSlide key={product.id} className="!h-auto">
                    {cardWrap(product)}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}

          {/* "View More" bar — sits BELOW the cards, spanning the block, in every
              layout (grid / list / horizontal). Rendered only when the API sent
              preview images: an empty or absent viewMorePreviewImages means this
              block has nothing more to show, so no button at all. */}
          {hasViewMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={handleSeeAll}
                // Compact pill: thumbnail stack on the start edge, label, filled
                // circular arrow on the end edge. The arrow is the only saturated
                // element — it carries the CTA weight while the surface stays light.
                // Deliberately NOT full-width: stretched across the block the
                // reference's proportions fall apart into a thin empty bar.
                className="inline-flex items-center gap-3 rounded-full bg-white dark:bg-zinc-900 p-1.5 pe-1.5 shadow-[0_3px_14px_rgba(0,0,0,0.16)]"
              >
                {/* Circular product thumbnails, overlapped into a stack. The thick
                    white ring is what separates the circles where they overlap.
                    object-contain (not cover) keeps the WHOLE product in frame —
                    cover would crop the edges off packaged goods and apparel. */}
                <span className="flex items-center flex-shrink-0">
                  {previewThumbs.map((src, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="h-9 w-9 rounded-full object-contain bg-gray-50 dark:bg-zinc-800 p-0.5 ring-[3px] ring-white dark:ring-zinc-900"
                      style={{
                        // Overlap on the logical start edge so the stack still
                        // reads correctly under RTL (the row flips with `dir`).
                        ...(index === 0 ? {} : { marginInlineStart: "-12px" }),
                        // Leftmost circle paints on top, so the stack reads
                        // front-to-back like a fanned deck.
                        zIndex: previewThumbs.length - index,
                      }}
                    />
                  ))}
                </span>

                {/* Sized to its text — no flex-1, which would stretch the pill and
                    shove the arrow out to the far edge. */}
                <span className="px-1 text-[15px] font-bold tracking-tight primaryColor whitespace-nowrap">
                  {tr("view_more")}
                </span>

                {/* Filled circular arrow — the palette's primary colour, so it
                    re-tints per white-label build instead of being hardcoded. */}
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  <IoArrowForward size={17} className="rtl:rotate-180" />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default React.memo(ProductSliderSection);
