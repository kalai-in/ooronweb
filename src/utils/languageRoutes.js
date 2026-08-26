// Language URL helpers. Language codes are NOT hardcoded here — admins add
// languages at runtime, so the code set is passed in by the caller:
//   - server/middleware: from the languages API (languageEdge / languageResolver)
//   - client: from Redux state.Language.availableLanguages (see useLanguages)
//
// The DEFAULT language is never a URL segment. /bhuj-quick, not /en/bhuj-quick —
// prefixing the default would create two URLs for one page and split ranking.

export const DEFAULT_LANGUAGE = "en";

/**
 * Is this segment a non-default language prefix? Needs the live code set.
 *   isLanguagePrefix("ur", { codes, defaultCode }) -> true
 *   isLanguagePrefix("en", ...) -> false   (default is never a segment)
 */
export const isLanguagePrefix = (segment, { codes, defaultCode } = {}) => {
  if (!segment || !codes) return false;
  const def = defaultCode || DEFAULT_LANGUAGE;
  return segment !== def && codes.has(segment);
};

/**
 * Split a pathname into its language prefix (if any) and the rest. The code set
 * must be supplied so unknown/default first segments don't parse as languages.
 *   parseLangPath("/ur/bhuj-quick", { codes }) -> { lang:"ur", rest:["bhuj-quick"] }
 *   parseLangPath("/bhuj-quick", { codes })    -> { lang:null, rest:["bhuj-quick"] }
 */
export const parseLangPath = (pathname = "", langInfo = {}) => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 1 && isLanguagePrefix(segments[0], langInfo)) {
    return { lang: segments[0], rest: segments.slice(1) };
  }
  return { lang: null, rest: segments };
};
