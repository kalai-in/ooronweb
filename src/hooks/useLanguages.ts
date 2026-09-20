import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";
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
  // [lang] is a real route param now, resolved by Next's router before this
  // component ever renders — always present, no shape-guessing needed. The
  // old ?lang= query-param carrier this replaced existed specifically for
  // gSSP-less pages (cart, profile, order-detail…) whose code set could be
  // empty on first paint — structurally impossible now, since Next itself
  // provides params.lang synchronously on every render. useSearchParams()
  // was kept as a "defensive" fallback for that dead case, but it forces
  // every caller of this hook (AppContent, called unconditionally on every
  // page including Next's own /_not-found static shell) to sit under a
  // Suspense boundary for static prerendering — the exact requirement that
  // let a CSR bailout blank out real SSR page content in production
  // (BAILOUT_TO_CLIENT_SIDE_RENDERING on product pages, 2026-08-25).
  const params = useParams<{ lang?: string }>();
  const available = useSelector(
    (state: any) => state?.Language?.availableLanguages,
  );
  // Seeded from SSR pageProps on first paint — available before Layout fetches
  // the full objects, so /ur/... parses correctly on initial load.
  const seededCodes = useSelector((state: any) => state?.Language?.languageCodes);
  const routeLangParam = params?.lang;

  return useMemo(() => {
    const rows = Array.isArray(available) ? available : [];
    const codes = new Set<string>();
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
    // The URL's own language always counts, even before availableLanguages loads.
    if (routeLangParam) codes.add(routeLangParam);
    // Always know the default even before either list loads.
    codes.add(defaultCode);

    const prefixCodes = [...codes].filter((c) => c !== defaultCode);
    const langInfo = { codes, defaultCode };

    return {
      codes,
      defaultCode,
      prefixCodes,
      parseLangPath: (path: string) => parseLangPathBase(path, langInfo),
    };
  }, [available, seededCodes, routeLangParam]);
};

export default useLanguages;
