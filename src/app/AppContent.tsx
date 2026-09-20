"use client";

import { Suspense, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setSelectedLanguage,
  setLanguageCodes,
} from "@/redux/slices/languageSlice";
import * as api from "@/api/apiRoutes";
import Loader from "@/components/loader/Loader";
import Layout from "@/components/layout/Layout";
import AppInstallBottomSheet from "@/components/app-install-bottom-sheet/AppInstallBottomSheet";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { GA_MEASUREMENT_ID, pageview } from "@/utils/gtag";
import useLanguages from "@/hooks/useLanguages";
import useCookieConsent from "@/hooks/useCookieConsent";
import { markTranslationsHydrated } from "@/utils/translation";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import NavigationEvents from "./NavigationEvents";

export default function AppContent({
  children,
  bootstrapped,
  langCodes,
}: {
  children: React.ReactNode;
  bootstrapped: boolean;
  langCodes?: string[];
}) {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { parseLangPath, defaultCode } = useLanguages();
  // Navigation-in-flight signal (see useAppNavigate.ts) replaces the old
  // router.events routeChangeStart/Complete pair — the closest App Router
  // equivalent, covering real navigations (both <Link> and router.push())
  // without a separate "shallow" carve-out: a searchParams-only update on the
  // same route segment doesn't start a new transition, so the loader doesn't
  // flash over an otherwise-static page, matching the old shallow-skip.
  const { isPending: loading } = useAppNavigate();
  // One-shot re-render bump, fired once redux-persist has rehydrated.
  const [, forceTick] = useState(0);

  // Until redux-persist rehydrates, the store has no user language and t()
  // returns English — matching the server HTML, so hydration is clean. Once
  // PersistGate reports `bootstrapped`, the store holds the real language:
  // unpin t() (markTranslationsHydrated) and bump state so THIS whole subtree
  // re-renders and every raw t() call re-evaluates against the real language.
  // Structural top-down re-render — raw t() callers need no redux subscription.
  useEffect(() => {
    if (!bootstrapped) return;
    markTranslationsHydrated();
    // intentional: bumps a re-render exactly once after redux-persist reports
    // bootstrapped, so every raw t() call downstream re-evaluates against the
    // real language — see doc comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    forceTick((n) => n + 1);
  }, [bootstrapped]);

  // Seed language codes from SSR pageProps into Redux on first paint, so the
  // client can parse /ur/... URLs before Layout fetches the full language list.
  // Without this, the language segment reads as a zone on initial load.
  useEffect(() => {
    if (Array.isArray(langCodes) && langCodes.length) {
      dispatch(setLanguageCodes(langCodes));
    }
  }, [langCodes, dispatch]);
  const selectedLanguage = useSelector(
    (state: any) => state.Language.selectedLanguage,
  );
  const availableLanguages = useSelector(
    (state: any) => state.Language.availableLanguages,
  );

  // Client-side navigations don't reload the document, so GA never sees them
  // on its own — NavigationEvents reports each completed route change as a
  // page view (the routeChangeComplete-equivalent half of the old effect).

  // Language lives in the URL path (/ur/...), not ?lang=. The URL is the source
  // of truth — a visitor landing on /ur/... must SEE Urdu, so the URL wins and
  // Redux follows it. The reverse (Redux -> URL) is handled separately, only
  // when the user actively picks a language from the switcher.
  //
  // A) URL -> Redux: the URL names a language different from Redux's — adopt it.
  useEffect(() => {
    const { lang: urlLang } = parseLangPath(pathname || "/");
    // No language segment means "the default" — and which language IS default
    // comes from the API (is_default), not a constant. An admin can switch it.
    const urlCode = urlLang || defaultCode;
    const reduxCode = selectedLanguage?.code;
    if (!reduxCode || urlCode === reduxCode) return;

    const match = availableLanguages?.find((l: any) => l?.code === urlCode);
    if (!match?.id) return;

    // The manual switcher (Header.tsx handleLanguageChange) dispatches the
    // new language THEN pushes the matching URL — router.push() doesn't
    // update `pathname` synchronously, so this effect can re-run with the
    // OLD pathname still in scope right after that dispatch, see urlCode
    // (stale, e.g. default) != reduxCode (just-set Hindi), and adopt the
    // stale URL's language right back — a visible flash back to the old
    // language before the pending navigation lands and this effect corrects
    // it again. Deferring one tick lets `pathname` catch up first so this
    // only fires for a REAL external mismatch (typed/shared URL), not our
    // own in-flight navigation.
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      // Refetch the language BY ID rather than storing the list entry: the
      // list call (system_languages?system_type=3) omits `json_data`, and
      // t() reads its labels straight from selectedLanguage.json_data.
      // Storing the list entry leaves json_data undefined, so every UI label
      // silently falls back to en.json — the page shows Urdu products under
      // English buttons.
      api
        .getSystemLanguages({ id: match.id, isDefault: 0, systemType: 3 })
        .then((res: any) => {
          if (!active || res?.status != 1 || !res?.data) return;
          dispatch(setSelectedLanguage({ data: res.data }));
          if (res.data?.type) {
            document.documentElement.dir = res.data.type.toLowerCase();
          }
        })
        .catch((err: any) => console.log("URL language adopt failed:", err?.message));
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    pathname,
    availableLanguages,
    selectedLanguage?.code,
    dispatch,
    parseLangPath,
    defaultCode,
  ]);

  // The reverse direction (user switches language -> update the URL) is NOT an
  // effect here. It lives in the language switcher (Header.handleLanguageChange),
  // which navigates to the localized path directly. Keeping it there — instead
  // of reacting to Redux changes — avoids a race where Layout's initial `en`
  // seed would strip a /ur URL before (A) could adopt it.

  const setting = useSelector((state: any) => state.Setting?.setting);

  // The admin exposes Clarity under DIFFERENT key names depending on the build:
  // `*_web` (this is the web storefront) or `*_customer`, either at the top level
  // or nested under web_settings. Read `_web` FIRST — it is the one that names
  // this surface — then fall back through the rest. Reading only `_customer`
  // meant a backend that sends `clarity_status_web: "1"` left Clarity silently
  // off, because the key it checked simply did not exist in the response.
  const clarityStatus =
    setting?.clarity_status_web ??
    setting?.web_settings?.clarity_status_web ??
    setting?.clarity_status_customer ??
    setting?.web_settings?.clarity_status_customer ??
    setting?.clarity_status ??
    setting?.web_settings?.clarity_status;

  // Pair the id with the status: both must come from the same generation of key
  // names, or a `_web` status could enable a `_customer` project id.
  const clarityProjectId = String(
    setting?.clarity_project_id_web ??
      setting?.web_settings?.clarity_project_id_web ??
      setting?.clarity_project_id_customer ??
      setting?.web_settings?.clarity_project_id_customer ??
      setting?.clarity_project_id ??
      setting?.web_settings?.clarity_project_id ??
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ??
      "",
  ).trim();

  // 1 is enabled, 0 is disabled
  const isClarityEnabled =
    (String(clarityStatus) === "1" || clarityStatus === true) &&
    Boolean(clarityProjectId);

  // Cookie gate. Clarity is session-replay + analytics, so it only runs once the
  // visitor has actually accepted.
  //
  // The gate applies ONLY when the merchant enabled the consent banner: with the
  // banner off there is no way to ever give consent, so gating unconditionally
  // would silently disable analytics for every client that hasn't turned the
  // feature on. Banner on  -> accepted required. Banner off -> previous
  // behaviour, unchanged.
  const consentRequired =
    String(setting?.web_settings?.cookie_consent_enabled ?? "") === "1";
  const { accepted: cookiesAccepted } = useCookieConsent();
  const analyticsAllowed = !consentRequired || cookiesAccepted;

  return (
    <>
      {/* Renders null — needs a Suspense boundary only because it reads
          useSearchParams() (Next's static-prerendering requirement), not
          because it has any fallback UI to show. */}
      <Suspense fallback={null}>
        <NavigationEvents />
      </Suspense>
      {/* Google Analytics 4. Skipped entirely when no measurement ID is set, so
          local builds don't report. send_page_view is off because navigation
          is tracked by hand (NavigationEvents) — leaving it on would
          double-count the first load. Gated on cookie consent when the banner
          is enabled. */}
      {GA_MEASUREMENT_ID && analyticsAllowed && (
        <>
          <Script
            id="ga-lib"
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script
            id="ga-init"
            strategy="lazyOnload"
            // gtag only exists once this script runs, so the first page view is
            // reported here rather than on mount, where it would be dropped.
            onReady={() =>
              pageview(window.location.pathname + window.location.search)
            }
          >
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });`}
          </Script>
        </>
      )}
      {/* Microsoft Clarity — session replay & analytics. Only enabled when
          clarity_status_customer is 1, the project ID is non-empty, and (when
          the consent banner is on) the visitor accepted cookies. */}
      {isClarityEnabled && clarityProjectId && analyticsAllowed && (
        <Script
          id="ms-clarity"
          key={clarityProjectId}
          strategy="lazyOnload"
        >
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityProjectId}");`}
        </Script>
      )}
      {loading && <Loader screen="full" />}
      {/* Wrapped once here (not per-page) so Header/Footer and their queries
          persist across client-side navigation instead of unmounting and
          remounting — and refetching everything — on every route change. */}
      <Layout>{children}</Layout>
      <AppInstallBottomSheet />
    </>
  );
}
