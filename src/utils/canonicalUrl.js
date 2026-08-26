import { DEFAULT_LANGUAGE } from "@/utils/languageRoutes";

// Builds the canonical/hreflang URLs for a localized, zone-prefixed page.
//
// Segment order mirrors the URL and the middleware: /{lang?}/{zone?}/{path}.
// The default language is never prefixed, so its canonical omits the lang
// segment — /bhuj-quick/products, not /en/bhuj-quick/products.
//
// `defaultCode` is ALWAYS passed in by the caller, sourced from the languages
// API (`is_default: 1`). It is never assumed: an admin can make any language the
// default, and hardcoding "en" would then prefix the real default and strip the
// prefix from a non-default one — silently wrong canonicals and hreflang.
// DEFAULT_LANGUAGE is only a last-resort fallback for when the API is unreachable.

// Strip any trailing slash so the joined URL can never become "https://host//path".
// The env value is set per-deploy and has shipped both with and without the slash;
// normalizing here keeps every canonical/hreflang correct regardless.
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

/**
 * Relative localized path for one (lang, zone, path) combination — the single
 * place that knows the segment order (/{lang?}/{zone?}/{path}) and that the
 * default language is never prefixed. Both canonicalUrl (absolute, for SEO) and
 * useZoneHref (relative, for links) build on this so they can never disagree.
 *
 *   buildLocalizedPath({ lang:"ur", zone:"bhuj-quick", path:"/products", defaultCode:"en" })
 *     -> /ur/bhuj-quick/products
 *   buildLocalizedPath({ lang:"en", zone:"bhuj-quick", path:"/products", defaultCode:"en" })
 *     -> /bhuj-quick/products          (default language omitted)
 *   buildLocalizedPath({ lang:"en", path:"/products", defaultCode:"ur" })
 *     -> /en/products                  (ur is default, so en IS prefixed)
 */
export const buildLocalizedPath = ({
  lang,
  zone,
  path = "/",
  defaultCode,
} = {}) => {
  const def = defaultCode || DEFAULT_LANGUAGE;
  const segments = [];
  if (lang && lang !== def) segments.push(lang);
  if (zone) segments.push(zone);

  const cleanPath = path === "/" ? "" : path.replace(/^\//, "");
  if (cleanPath) segments.push(cleanPath);

  return segments.length ? `/${segments.join("/")}` : "/";
};

/**
 * Absolute URL for one (lang, zone, path) combination.
 * `path` is the un-prefixed route ("/", "/products", "/product/x").
 */
export const canonicalUrl = ({ lang, zone, path = "/", defaultCode } = {}) => {
  const localized = buildLocalizedPath({ lang, zone, path, defaultCode });
  return `${BASE}${localized === "/" ? "" : localized}`;
};

/**
 * hreflang alternates for a page — one entry per language, plus x-default
 * (which points at the default language's unprefixed URL). Feeds MetaData's
 * `alternates` so Google reads the localized variants as translations rather
 * than duplicates.
 *
 * `codes` and `defaultCode` both come from the languages API.
 */
export const hreflangAlternates = ({
  zone,
  path = "/",
  codes = [],
  defaultCode,
} = {}) => {
  const def = defaultCode || DEFAULT_LANGUAGE;
  // Dedupe, and keep the default present even if the list is momentarily empty.
  const all = [...new Set([def, ...codes])];
  const alternates = all.map((lang) => ({
    hrefLang: lang,
    href: canonicalUrl({ lang, zone, path, defaultCode: def }),
  }));
  alternates.push({
    hrefLang: "x-default",
    href: canonicalUrl({ lang: def, zone, path, defaultCode: def }),
  });
  return alternates;
};
