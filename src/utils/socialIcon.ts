/**
 * How to render one `social_media` entry from the settings API.
 *
 * The API mixes TWO shapes in the same array, and `icon_url` is always present
 * for both — which makes it look usable everywhere until you fetch it:
 *
 *   1. Icon-font entries — `icon: "fab fa-facebook"`, and `icon_url` is that
 *      class name pasted onto the storage path
 *      ("/storage/fab fa-facebook"). That URL RESOLVES (200) but serves
 *      text/html, not an image, so rendering it gives a broken <img>.
 *   2. Uploaded-image entries — `icon: "social_media/flag.webp"`, and
 *      `icon_url` is a real file ("/storage/social_media/flag.webp",
 *      200 image/webp).
 *
 * So the entry's own `icon` field is the discriminator, not the presence of
 * `icon_url`: anything that looks like a CSS class list is a font glyph;
 * anything with a file extension is an upload.
 */

// "fab fa-facebook", "fa-brands fa-x-twitter" → font glyph.
// "social_media/flag.webp", "a/b/c.png" → uploaded image.
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

// `social` is one `social_media` API row — shape not modeled here.
export const isImageIcon = (social: any): boolean => {
  const icon = String(social?.icon || "").trim();
  if (!icon) return false;
  // An extension is the positive signal. Checking for "fa-" instead would
  // misclassify any upload whose filename happens to contain it.
  return IMAGE_EXT.test(icon);
};

/**
 * The image URL to render, or "" when this entry is a font glyph.
 * Prefers the API's absolute `icon_url`; `icon` alone is a relative storage
 * path with no host, so it is not usable as a src on its own.
 */
export const socialIconUrl = (social: any): string =>
  isImageIcon(social) ? String(social?.icon_url || "").trim() : "";
