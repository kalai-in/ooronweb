import { useCallback } from "react";
import { useRouter } from "next/router";
import useLanguages from "@/hooks/useLanguages";
import { buildLocalizedPath } from "@/utils/canonicalUrl";

/**
 * Navigates to the current page under a different language, keeping the zone and
 * route intact. Called by the language switcher AFTER it updates Redux, so the
 * URL and Redux move together in one user action — no effect-driven race.
 *
 *   on /bhuj-quick/products, switch to Urdu -> /ur/bhuj-quick/products
 *   on /ur/bhuj-quick,       switch to English -> /bhuj-quick   (default: no prefix)
 *
 * Reads asPath (not router.query) for the same reason as the other zone hooks:
 * middleware-injected params don't survive the first client-side replace.
 */
const useLanguageSwitch = () => {
  const router = useRouter();
  const { parseLangPath, defaultCode } = useLanguages();

  return useCallback(
    (code) => {
      if (!code) return;
      const currentPath = router.asPath.split("?")[0];
      // Strip the existing language segment; everything after it (zone + route)
      // is preserved verbatim.
      const { rest } = parseLangPath(currentPath);
      const restPath = `/${rest.join("/")}`;

      // buildLocalizedPath omits the default language and keeps the zone segment
      // (already inside restPath), so pass zone: null — we're not re-deriving it.
      const nextPath = buildLocalizedPath({
        lang: code,
        zone: null,
        path: restPath,
        defaultCode,
      });

      const { zone: _z, lang: _l, slug: _s, ...publicQuery } = router.query;
      router.push({ pathname: nextPath, query: publicQuery }, undefined, {
        shallow: false,
      });
    },
    [router, parseLangPath, defaultCode],
  );
};

export default useLanguageSwitch;
