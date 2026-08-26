import React from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useDir from "@/hooks/useDir";

const TextSection = ({ block }) => {
  const language = useSelector((state) => state.Language.selectedLanguage);
  const dir = useDir();
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();
  const config = block?.config || {};
  const { text_align, text_color, background_color, section_title, section_subtitle } = config;

  // Redirect lives on the block ROOT (not config), same shape as the image
  // sections. Only the title is clickable — the subtitle is a paragraph wall.
  const clickable =
    !!section_title &&
    ((block?.redirect_type === "url" && block?.redirect_url) ||
      (block?.redirect_type !== "url" &&
        block?.redirect_type !== "none" &&
        block?.redirect_slug));

  const handleClick = () => {
    if (block?.redirect_type === "url" && block?.redirect_url) {
      window.open(block.redirect_url, "_blank");
    } else if (block?.redirect_type === "product" && block?.redirect_slug) {
      router.push(zoneHref(`/product/${block.redirect_slug}`));
    } else if (block?.redirect_type === "category" && block?.redirect_id) {
      router.push({
        pathname: zoneHref("/products"),
        query: buildQueryPatch({ category_id: block.redirect_id.toString() }),
      });
    }
  };

  if (!section_title && !section_subtitle) return null;

  // block_padding: a number → that padding inside the block; null/unset → none.
  const blockPadding = Number.isFinite(Number(config?.block_padding))
    ? Number(config.block_padding)
    : 0;
  // A 10px left/right gutter is always present so the text never touches the
  // block edge. It's a BASE, not a fallback: anything the backend sends stacks
  // on top of it (block_padding 20 → 20px vertical, 30px horizontal). Same rule
  // as the product slider.
  const BASE_INLINE_PADDING = 10;
  const blockPaddingStyle = {
    paddingTop: blockPadding,
    paddingBottom: blockPadding,
    paddingLeft: BASE_INLINE_PADDING + blockPadding,
    paddingRight: BASE_INLINE_PADDING + blockPadding,
  };

  // Map admin physical alignment to logical alignment so it flips with dir.
  // left -> start, right -> end; center/justify pass through.
  const logicalAlign =
    text_align === "left"
      ? "start"
      : text_align === "right"
        ? "end"
        : text_align || "start";

  return (
    <section
      dir={dir}
      className="py-3 md:py-5"
      style={background_color ? { backgroundColor: background_color } : undefined}
    >
      <div
        style={{
          ...blockPaddingStyle,
          textAlign: logicalAlign,
          color: text_color || undefined,
        }}
      >
        {section_title && (
          <h2
            className={`text-xl sm:text-3xl font-extrabold leading-[29px] m-0 ${
              clickable ? "cursor-pointer hover:underline" : ""
            }`}
            style={{ color: text_color || undefined }}
            onClick={clickable ? handleClick : undefined}
            role={clickable ? "link" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClick();
                    }
                  }
                : undefined
            }
          >
            {section_title}
          </h2>
        )}
        {section_subtitle && (
          <p className="mt-1" style={{ color: text_color || undefined }}>
            {section_subtitle}
          </p>
        )}
      </div>
    </section>
  );
};

export default React.memo(TextSection);
