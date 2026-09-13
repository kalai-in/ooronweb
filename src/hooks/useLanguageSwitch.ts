import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
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
 * Reads the current pathname (not searchParams) for the same reason as the
 * other zone hooks: middleware-injected params don't survive the first
 * client-side navigation.
 *
 * The query string is only needed inside the returned callback (fires on a
 * user click, never during render), so it reads window.location.search
 * there instead of calling useSearchParams() — that hook forces every
 * caller of this one (Header, unconditionally on every page) to sit under a
 * Suspense boundary for static prerendering, which was the actual cause of
 * a CSR bailout blanking out real SSR page content in production
 * (BAILOUT_TO_CLIENT_SIDE_RENDERING, 2026-08-25).
 */
const useLanguageSwitch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { parseLangPath, defaultCode } = useLanguages();

  return useCallback(
    (code: string) => {
      if (!code) return;
      const currentPath = pathname || "/";
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

      const publicQuery = new URLSearchParams(window.location.search);
      publicQuery.delete("zone");
      publicQuery.delete("lang");
      publicQuery.delete("slug");
      const qs = publicQuery.toString();
      router.push(qs ? `${nextPath}?${qs}` : nextPath);
    },
    [router, pathname, parseLangPath, defaultCode],
  );
};

export default useLanguageSwitch;
