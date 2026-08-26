import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import {
  parseLangPath as parseLangPathBase,
  DEFAULT_LANGUAGE,
} from "@/utils/languageRoutes";

/**
 * Client-side language info, sourced from Redux (populated at runtime from the
 * languages API — never hardcoded, so admins adding a language Just Works).
 *
 * Returns:
 *   codes        Set<string> of all language codes
 *   defaultCode  the is_default code
 *   prefixCodes  non-default codes (the ones that appear as URL segments)
 *   parseLangPath(path)  bound to this code set
 */
const useLanguages = () => {
  const router = useRouter();
  const available = useSelector(
    (state) => state?.Language?.availableLanguages,
  );
  // Seeded from SSR pageProps on first paint — available before Layout fetches
  // the full objects, so /ur/... parses correctly on initial load.
  const seededCodes = useSelector((state) => state?.Language?.languageCodes);
  // The language middleware parsed out of THIS url. Pages without a gSSP (cart,
  // profile, order-detail…) never receive langCodes, so on their first paint the
  // code set would be empty — and the language segment would then parse as a
  // ZONE ("pt" isn't reserved and matches the slug shape), rewriting /pt/cart to
  // /bhuj-quick/cart, which 404s. This param is present on every rewritten URL,
  // so it guarantees the current language is always recognised.
  const routeLangParam = router?.query?.lang;

  return useMemo(() => {
    const rows = Array.isArray(available) ? available : [];
    const codes = new Set();
    let defaultCode = DEFAULT_LANGUAGE;
    for (const r of rows) {
      if (!r?.code) continue;
      codes.add(r.code);
      if (r.is_default == 1) defaultCode = r.code;
    }
    // Merge seeded codes (present before availableLanguages loads).
    if (Array.isArray(seededCodes)) {
      for (const c of seededCodes) if (c) codes.add(c);
    }
    // The URL's own language always counts, even on gSSP-less pages.
    if (routeLangParam) codes.add(routeLangParam);
    // Always know the default even before either list loads.
    codes.add(defaultCode);

    const prefixCodes = [...codes].filter((c) => c !== defaultCode);
    const langInfo = { codes, defaultCode };

    return {
      codes,
      defaultCode,
      prefixCodes,
      parseLangPath: (path) => parseLangPathBase(path, langInfo),
    };
  }, [available, seededCodes, routeLangParam]);
};

export default useLanguages;
