// Helpers for tinting Lottie animations with the app's brand primary color.
// Lottie stores colors as [r,g,b] (and sometimes [r,g,b,a]) in 0–1 floats.

// "#470097" / "#409" / "rgb(...)" → [r,g,b] in 0–1 floats.
export const toLottieRgb = (raw) => {
  if (!raw) return null;
  const c = raw.trim();
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split("").map((h) => h + h).join("");
    if (hex.length !== 6) return null;
    const n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((v) => parseFloat(v));
    return [r / 255, g / 255, b / 255];
  }
  return null;
};

// Read the live --primary-color CSS var (set from the settings API, theme-aware).
// Client-only — returns null on the server.
export const getPrimaryLottieRgb = () => {
  if (typeof window === "undefined") return null;
  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary-color")
    .trim();
  return toLottieRgb(primary);
};

const isBlack = (c) => c?.[0] <= 0.05 && c?.[1] <= 0.05 && c?.[2] <= 0.05;
const isWhite = (c) => c?.[0] >= 0.95 && c?.[1] >= 0.95 && c?.[2] >= 0.95;
// Near-greyscale: r/g/b all within a small spread of each other. Covers pure
// black/white plus outline and shading tones (#212121, #E8E8E8) that carry the
// drawing's structure and must survive a recolor.
const isNeutral = (c) => {
  if (!Array.isArray(c) || c.length < 3) return false;
  const [r, g, b] = c;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 0.08;
};

/**
 * Deep-clone a Lottie animation and repaint stroke/fill colors with `rgb`.
 *
 * mode:
 *   "black" (default) — only pure-black colors become brand (keeps white accents).
 *   "all"             — every non-white color becomes brand (white accents kept).
 *   "accent"          — every SATURATED color becomes brand; neutrals (black,
 *                       white, greys) are left alone. Use for artwork whose
 *                       accent is a baked-in hue rather than black — "black"
 *                       mode would no-op on it and "all" would flatten the
 *                       outlines and shading into one solid brand blob.
 */
export const recolorAnimation = (data, rgb, mode = "black") => {
  if (!rgb || !data) return data;
  const shouldPaint = (c) =>
    mode === "accent"
      ? !isNeutral(c)
      : mode === "all"
        ? !isWhite(c)
        : isBlack(c);

  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if ((node.ty === "st" || node.ty === "fl") && Array.isArray(node.c?.k)) {
        if (shouldPaint(node.c.k)) {
          const a = node.c.k[3];
          node.c.k = a != null ? [...rgb, a] : [...rgb];
        }
      }
      Object.values(node).forEach(walk);
    }
  };

  const clone = JSON.parse(JSON.stringify(data));
  walk(clone.layers);
  return clone;
};
