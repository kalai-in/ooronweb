"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toCssRadius, pickDeviceImage, pickDeviceNumber, toCssAspectRatio } from "@/utils/helperFunction";
import { resolveIdCsvToSlugCsv } from "@/utils/categorySlugResolver";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

interface GridBannerSectionProps {
  block: any;
  // Outer panel radius (section-level border_radius_corners), distinct from
  // block.config.tile_radius which shapes each individual tile.
  borderRadius?: string | number;
  device?: string;
  priority?: boolean;
  // Resolves the full category tree on demand, for resolving a "category"
  // redirect's numeric id to the slug the products page's filter sidebar
  // needs (see handleClick). A function, not the raw tree data, because the
  // tree may still be mid-fetch when a fast click races its background load —
  // awaiting this gets the same (possibly still-in-flight) query instead of
  // racing it with a stale/empty snapshot.
  resolveCategoryTree?: () => Promise<any[]>;
}

// `priority` promotes only the first tile — the rest stay lazy (only one LCP element).
const GridBannerSection = ({
  block,
  borderRadius,
  device = "web",
  priority = false,
  resolveCategoryTree,
}: GridBannerSectionProps) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();

  const config = block?.config || {};
  const items = (block?.items || []).filter(
    (item: any) => pickDeviceImage(item?.images, device, item?.image_url)
  );

  const gridGap = pickDeviceNumber(config?.grid_gap, device, 0);
  // grid_layout_type alone decides grid-vs-strip; grid_rows only sets strip row count.
  const scrolls = ["scroll", "horizontal"].includes(
    String(config?.grid_layout_type || "").toLowerCase()
  );
  const rows = Math.max(1, pickDeviceNumber(config?.grid_rows, device, 1));
  const configColumns = Math.max(
    1,
    pickDeviceNumber(config?.grid_columns, device, 0) ||
      pickDeviceNumber(config?.columns, device, 0) ||
      2
  );
  // Column count is fixed regardless of item count — fewer items just end the row short.
  const columns = configColumns;
  // tile radius from block config (per-image corner). Section border_radius is the
  // outer panel radius, applied on the HomeLayout wrapper — not the tiles.
  const tileRadius = toCssRadius(config?.tile_radius);
  // Fixed tile height from config; null/0 → natural image height (auto).
  // Tile shape from the API's `image_aspect` ("3:1", or a per-device
  // {app,tablet,web} object — pick before parsing). Null when unset/malformed —
  // the tile then sizes to the image's own proportions (object-contain), exactly
  // as it did when `image_height` was absent.
  const imageAspectRaw =
    config?.image_aspect && typeof config.image_aspect === "object"
      ? pickDeviceImage(config.image_aspect, device)
      : config?.image_aspect;
  const aspectRatio = toCssAspectRatio(imageAspectRaw) ?? null;

  // variant gates title/background/color adornments; ignored fields may still be set from a prior variant.
  const variant = config?.variant;
  const isDefault = !variant || variant === "default";
  const isColorVariant = variant === "with_color";

  // Every variant except "default" shows the title when one is configured.
  const title = isDefault ? null : config?.section_title || null;

  // Background IMAGE: only for the image-backed variant. background_image_url
  // is either a plain URL (legacy rows) or a per-device object ({app,tablet,web},
  // current backend shape) — pick accordingly.
  const bgImageUrl =
    config?.background_image_url && typeof config.background_image_url === "object"
      ? pickDeviceImage(config.background_image_url, device)
      : config?.background_image_url;
  const hasBg =
    !isDefault && variant !== "with_title" && variant !== "with_color"
      ? !!bgImageUrl
      : false;

  // Background COLOR: only for "with_color". null-safe — the API sends explicit
  // nulls on the other variants.
  const backgroundColor = isColorVariant ? config?.background_color || null : null;
  // Text colour applies to any variant that paints its own backdrop: on
  // "with_background" the title sits ON the artwork, where the default heading
  // colour can be unreadable. Still ignored on "default".
  const textColor = isDefault ? null : config?.text_color || null;

  // block_padding: a number → that padding inside the panel; null/unset → none.
  const blockPadding = Number.isFinite(Number(config?.block_padding))
    ? Number(config.block_padding)
    : 0;
  const blockPaddingStyle = {
    paddingTop: blockPadding,
    paddingBottom: blockPadding,
    paddingLeft: blockPadding,
    paddingRight: blockPadding,
  };

  // bg_image_aspect shapes the background only (image_aspect shapes tiles) — sets a min height, not fixed.
  const bgAspectPadding = (() => {
    if (!hasBg) return undefined;
    const bgAspectRaw =
      config?.bg_image_aspect && typeof config.bg_image_aspect === "object"
        ? pickDeviceImage(config.bg_image_aspect, device)
        : config?.bg_image_aspect;
    const ratio = toCssAspectRatio(bgAspectRaw);
    if (!ratio) return undefined;
    const [w, h] = ratio.split("/").map((n: string) => Number(n.trim()));
    if (!w || !h) return undefined;
    return `${(h / w) * 100}%`;
  })();

  // Native scrollbar is hidden, so drag-to-scroll is wired up by hand for desktop.
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Ref, not state: these change on every pointermove and must not re-render.
  const dragRef = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: 0,
    pointerId: undefined as number | undefined,
  });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: React.PointerEvent) => {
    // Primary button only for mouse; touch/pen report button 0 too.
    if (event.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    // Touch is left to the browser's own momentum scrolling (touch-pan-x below).
    // Driving it from JS as well double-scrolls and kills the fling.
    if (event.pointerType === "touch") return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: 0,
      pointerId: event.pointerId,
    };
    setDragging(true);
    // Capture immediately — without it, native image drag hijacks the gesture a few pixels in.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag.active || !el) return;
    // Stops text/image selection from taking over once the drag is underway.
    event.preventDefault();
    const delta = event.clientX - drag.startX;
    drag.moved = Math.max(drag.moved, Math.abs(delta));
    // Drag left → content travels left, so scrollLeft grows: subtract the delta.
    el.scrollLeft = drag.startScroll - delta;
  };

  const endDrag = (event?: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (drag.pointerId != null) {
      event?.currentTarget?.releasePointerCapture?.(drag.pointerId);
    }
    setDragging(false);
  };

  // Swallow the click if the pointer moved — otherwise a drag-end fires the tile's redirect.
  const onClickCapture = (event: React.MouseEvent) => {
    if (dragRef.current.moved > 5) {
      event.preventDefault();
      event.stopPropagation();
    }
    dragRef.current.moved = 0;
  };

  const handleClick = async (item: any) => {
    if (item?.redirect_type === "url" && item?.redirect_url) {
      window.open(item.redirect_url, "_blank");
    } else if (item?.redirect_type === "product" && item?.redirect_slug) {
      router.push(zoneHref(`/product/${item.redirect_slug}`));
    } else if (item?.redirect_type === "category" && item?.redirect_id) {
      // The URL's category param is a SLUG (see ProductFilter.tsx), not the
      // numeric id the home_layout payload gives us — resolve it first.
      // Awaited (not read from a prop snapshot) so a fast click right after
      // page load still gets the real tree instead of racing its fetch.
      const tree = (await resolveCategoryTree?.()) || [];
      const slug =
        resolveIdCsvToSlugCsv(tree, item.redirect_id.toString()) ||
        item.redirect_id.toString();
      const qs = new URLSearchParams(
        buildQueryPatch({ category_id: slug }),
      ).toString();
      const dest = zoneHref("/products");
      router.push(qs ? `${dest}?${qs}` : dest);
    } else if (item?.redirect_type === "brand" && item?.redirect_id) {
      const qs = new URLSearchParams(
        buildQueryPatch({ brand_ids: [Number.parseInt(item.redirect_id, 10)] }),
      ).toString();
      const dest = zoneHref("/products");
      router.push(qs ? `${dest}?${qs}` : dest);
    }
  };

  if (items.length === 0) return null;

  // Shared chrome for both layouts (scrolling strip and wrapping grid): the
  // variant's background image / colour, the optional title, and block_padding.
  // Written once so the two branches can never drift apart.
  //
  // A plain function, NOT a component: declaring a component inside the render
  // body gives it a new type on every render, so React would unmount and rebuild
  // the subtree — losing the strip's scroll position each time.
  const renderPanel = (children: React.ReactNode) => (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius,
        ...(hasBg
          ? {
              backgroundImage: `url(${bgImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
        // Set on the panel so the title and anything else inheriting colour
        // picks it up.
        ...(textColor ? { color: textColor } : {}),
      }}
    >
      {/* Ratio spacer: a zero-WIDTH float whose padding-top is a percentage of
          the panel's width (percentage padding always resolves against width,
          which is why this works where `aspect-ratio` would not — on a
          zero-width box that computes to zero height). Floating it keeps the
          tiles in normal flow at the top, so the panel settles at
          max(ratio height, content height) — a floor, not a cap. */}
      {bgAspectPadding && (
        <div
          aria-hidden
          className="float-left w-0"
          style={{ paddingTop: bgAspectPadding }}
        />
      )}
      {/* NOT cleared: the content must sit ALONGSIDE the zero-width spacer, so
          the panel resolves to max(ratio, content) instead of stacking them. */}
      <div className="relative" style={blockPaddingStyle}>
        {title && (
          <h2
            className={`text-xl sm:text-3xl font-extrabold leading-[1.1] m-0 mb-3 ${
              textColor ? "" : "text-gray-900 dark:text-zinc-100"
            }`}
            style={textColor ? { color: textColor } : undefined}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );

  const renderTile = (item: any, index: number) => {
    const src = pickDeviceImage(item?.images, device, item?.image_url);
    const clickable =
      (item?.redirect_type === "url" && item?.redirect_url) ||
      (item?.redirect_type === "product" && item?.redirect_slug) ||
      (item?.redirect_type === "category" && item?.redirect_id) ||
      (item?.redirect_type === "brand" && item?.redirect_id);
    return (
      <button
        key={index}
        type="button"
        disabled={!clickable}
        className={`relative w-full overflow-hidden border-0 bg-transparent p-0 text-left disabled:cursor-default ${
          scrolls ? "snap-start" : ""
        } ${clickable ? "cursor-pointer" : ""}`}
        style={{ borderRadius: tileRadius, ...(aspectRatio ? { aspectRatio } : {}) }}
        onClick={() => handleClick(item)}
      >
        <Image
          src={src}
          alt="Grid banner image"
          // Disable native image drag — it hijacks drag-to-scroll.
          draggable={false}
          onDragStart={(event: React.DragEvent) => event.preventDefault()}
          priority={priority && index === 0}
          className={`w-full ${aspectRatio ? "h-full object-cover" : "h-auto object-contain"}`}
          width={1920}
          height={1920}
          sizes={`(max-width: 768px) ${Math.round(100 / columns)}vw, ${Math.round(1280 / columns)}px`}
          quality={75}
        />
      </button>
    );
  };

  // Scrolling strip: lay the tiles out in a fixed number of rows and let the
  // row scroll sideways. `grid-flow-col` fills top-to-bottom then moves to the
  // next column, so with rows=2 items 1-2 stack in column one — the wrap order
  // the row cap implies. Columns are sized to a fraction of the container so
  // exactly `columns` tiles are visible and the next one is reached by scrolling.
  // The native scrollbar is hidden (a raw bar under the banners read as
  // unfinished) and there are no nav arrows: the strip is swipe-only on touch and
  // click-drag on desktop, matching the product slider. The grab cursor is the
  // affordance that the hidden bar would otherwise have provided.
  if (scrolls) {
    return (
      <section>
        {renderPanel(
        <div className="relative">
          <div
            ref={scrollerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            // No onPointerLeave: pointer capture keeps the drag alive past the
            // strip's edge, and ending it there made a fast drag stop short.
            //
            // snap-mandatory is dropped on the dragging path: it fights a manual
            // scrollLeft write, snapping the strip back mid-gesture.
            className={`grid grid-flow-col overflow-x-auto overscroll-x-contain touch-pan-x select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{
              gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
              gridAutoColumns: `calc((100% - ${(columns - 1) * gridGap}px) / ${columns})`,
              gap: gridGap,
            }}
          >
            {items.map(renderTile)}
          </div>
        </div>
        )}
      </section>
    );
  }

  return (
    <section>
      {renderPanel(
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: gridGap,
          }}
        >
          {items.map(renderTile)}
        </div>
      )}
    </section>
  );
};

export default React.memo(GridBannerSection);
