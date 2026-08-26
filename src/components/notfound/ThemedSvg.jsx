import React, { useEffect, useRef, useState } from "react";

// Accent hexes baked into the illustration art, mapped to shades of the live
// theme colour. Most empty-state art highlights with a single blue; the location
// art is multi-tone (base / shadow / two tints), so each tone maps to a
// color-mix of --primary-color and keeps its depth at any brand colour.
// Grays are neutral scaffolding and are left untouched.
const ACCENT_MAP = [
  [/#2A55E5/gi, "var(--primary-color)"],
  [/#fc7832/gi, "var(--primary-color)"],
  // Store-closed banner art (bag-heart / sparkle). Same blue family as the
  // store-close Lottie: a base blue, a lighter tint for the highlight, and two
  // very pale fills for the bag body — each mapped so the art keeps its depth.
  [/#0277fa/gi, "var(--primary-color)"],
  [
    /#3f9aff/gi,
    "color-mix(in srgb, var(--primary-color) 65%, white)",
  ],
  [
    /#e3edf9/gi,
    "color-mix(in srgb, var(--primary-color) 18%, white)",
  ],
  [
    /#f8fbff/gi,
    "color-mix(in srgb, var(--primary-color) 6%, white)",
  ],
  [
    /#ac3e04/gi,
    "color-mix(in srgb, var(--primary-color) 70%, black)",
  ],
  [
    /#f0d3c4/gi,
    "color-mix(in srgb, var(--primary-color) 25%, white)",
  ],
  [
    /#f8ebe4/gi,
    "color-mix(in srgb, var(--primary-color) 10%, white)",
  ],
];

/**
 * Inlines an SVG (fetched from its static URL) and repaints the baked accent
 * colour with the live theme `--primary-color` CSS var, so empty-state art
 * follows the API-driven brand colour instead of a hard-coded blue.
 *
 * Falls back to a plain <img> until the markup loads (SSR + first paint), so
 * there's never a blank gap.
 *
 * @param {string|object} src   imported svg (URL string, or { src })
 * @param {string} [className]
 * @param {string} [alt]
 */
const ThemedSvg = ({ src, className = "", alt = "" }) => {
  const url = typeof src === "string" ? src : src?.src;
  const [markup, setMarkup] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((raw) => {
        if (!alive) return;
        // Swap each baked accent for its theme-derived shade; strip any fixed
        // width/height so the wrapper's CSS classes control sizing.
        const themed = ACCENT_MAP
          .reduce((svg, [hex, shade]) => svg.replace(hex, shade), raw)
          .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/gi, "<svg$1")
          // Drop Figma's "background blur" export. It ships as a <foreignObject>
          // holding a div with `backdrop-filter`, which Figma renders as a soft
          // effect but a browser paints as a literal frosted RECTANGLE sitting
          // over the artwork — a visible pale square behind the icon.
          .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
        setMarkup(themed);
      })
      .catch(() => alive && setMarkup(null));
    return () => {
      alive = false;
    };
  }, [url]);

  if (markup) {
    return (
      <span
        ref={ref}
        role="img"
        aria-label={alt}
        className={`block mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-h-full ${className}`}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }

  // Fallback before the inline markup is ready (keeps original baked colours).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
};

export default ThemedSvg;
