import { useEffect, useState, useRef } from "react";
import "@/styles/globals.css";
import { Provider, useSelector, useDispatch } from "react-redux";
import {
  setSelectedLanguage,
  setLanguageCodes,
} from "@/redux/slices/languageSlice";
import * as api from "@/api/apiRoutes";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/redux/store";
import "react-toastify/dist/ReactToastify.css";
import Loader from "@/components/loader/Loader";
import Layout from "@/components/layout/Layout";
import AppInstallBottomSheet from "@/components/app-install-bottom-sheet/AppInstallBottomSheet";
import { useRouter } from "next/router";
import Script from "next/script";
import { ThemeProvider } from "next-themes";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GA_MEASUREMENT_ID, pageview } from "@/utils/gtag";
import useLanguages from "@/hooks/useLanguages";
import useCookieConsent from "@/hooks/useCookieConsent";
import { markTranslationsHydrated } from "@/utils/translation";

import { Instrument_Sans } from "next/font/google";

// Variable font: one file covering the whole wght axis, rather than four static
// cuts. Instrument Sans tops out at 700 where Nunito went to 900, and the markup
// still has ~50 font-extrabold/font-black (800/900) usages — those clamp to 700
// instead of pulling a separate file per weight.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-family",
  display: "swap",
});

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

// A module-level QueryClient is a singleton shared by EVERY SSR render in the
// Node process, which breaks server rendering in two ways:
//
//   1. One visitor's cached home_layout is served into another visitor's HTML —
//      wrong city, wrong zone, wrong catalogue.
//   2. Layout.jsx runs queryClient.fetchQuery on the "home-layout" key from a
//      client effect. While that fetch is in flight it lives on the shared
//      cache, so a concurrent SSR render reads isFetching === true and swaps
//      the real sections for a skeleton — stripping every product name, price
//      and link out of the crawler's HTML.
//
// So: a fresh client per request on the server, and one client for the tab's
// lifetime in the browser (cache must survive client-side route changes).
let browserQueryClient;
const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
};

function AppContent({ Component, pageProps, bootstrapped }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { parseLangPath, defaultCode } = useLanguages();
  const [loading, setLoading] = useState(false);
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
    forceTick((n) => n + 1);
  }, [bootstrapped]);

  // Seed language codes from SSR pageProps into Redux on first paint, so the
  // client can parse /ur/... URLs before Layout fetches the full language list.
  // Without this, the language segment reads as a zone on initial load.
  useEffect(() => {
    if (Array.isArray(pageProps?.langCodes) && pageProps.langCodes.length) {
      dispatch(setLanguageCodes(pageProps.langCodes));
    }
  }, [pageProps?.langCodes, dispatch]);
  const selectedLanguage = useSelector(
    (state) => state.Language.selectedLanguage,
  );
  const availableLanguages = useSelector(
    (state) => state.Language.availableLanguages,
  );

  useEffect(() => {
    // Shallow route changes (e.g. filter/query updates on the same page) only
    // rewrite the URL — no page data refetch happens, so the full-screen
    // loader must not show or it flashes over an otherwise-static page.
    const handleStart = (url, { shallow } = {}) => {
      if (shallow) return;
      setLoading(true);
    };
    const handleComplete = () => setLoading(false);
    // Client-side navigations don't reload the document, so GA never sees them
    // on its own — report each completed route change as a page view.
    const handleRouteDone = (url) => {
      handleComplete();
      pageview(url);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleRouteDone);
    router.events.on("routeChangeError", handleComplete);

    // Cleanup event listeners
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleRouteDone);
      router.events.off("routeChangeError", handleComplete);
    };
  }, [router]);

  // Language lives in the URL path (/ur/...), not ?lang=. The URL is the source
  // of truth — a visitor landing on /ur/... must SEE Urdu, so the URL wins and
  // Redux follows it. The reverse (Redux -> URL) is handled separately, only
  // when the user actively picks a language from the switcher.
  //
  // A) URL -> Redux: the URL names a language different from Redux's — adopt it.
  useEffect(() => {
    if (!router.isReady) return;
    const { lang: urlLang } = parseLangPath(router.asPath.split("?")[0]);
    // No language segment means "the default" — and which language IS default
    // comes from the API (is_default), not a constant. An admin can switch it.
    const urlCode = urlLang || defaultCode;
    const reduxCode = selectedLanguage?.code;
    if (!reduxCode || urlCode === reduxCode) return;

    const match = availableLanguages?.find((l) => l?.code === urlCode);
    if (!match?.id) return;

    // Refetch the language BY ID rather than storing the list entry: the list
    // call (system_languages?system_type=3) omits `json_data`, and t() reads
    // its labels straight from selectedLanguage.json_data. Storing the list
    // entry leaves json_data undefined, so every UI label silently falls back
    // to en.json — the page shows Urdu products under English buttons.
    let active = true;
    api
      .getSystemLanguages({ id: match.id, isDefault: 0, systemType: 3 })
      .then((res) => {
        if (!active || res?.status != 1 || !res?.data) return;
        dispatch(setSelectedLanguage({ data: res.data }));
        if (res.data?.type) {
          document.documentElement.dir = res.data.type.toLowerCase();
        }
      })
      .catch((err) => console.log("URL language adopt failed:", err?.message));
    return () => {
      active = false;
    };
  }, [
    router.isReady,
    router.asPath,
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

  const setting = useSelector((state) => state.Setting?.setting);

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
      {/* Google Analytics 4. Skipped entirely when no measurement ID is set, so
          local builds don't report. send_page_view is off because _app tracks
          navigations itself — leaving it on would double-count the first load.
          Gated on cookie consent when the banner is enabled. */}
      {GA_MEASUREMENT_ID && analyticsAllowed && (
        <>
          <Script
            id="ga-lib"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script
            id="ga-init"
            strategy="afterInteractive"
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
          strategy="afterInteractive"
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
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <AppInstallBottomSheet />
    </>
  );
}

export default function App({ Component, pageProps }) {
  // useState (not a module constant) so the server builds one client per
  // request — see getQueryClient. In the browser this resolves to the same
  // memoized instance on every render, so the cache survives route changes.
  const [queryClient] = useState(getQueryClient);

  return (
    <main className={`${instrumentSans.variable} `}>
      {/* GA4 used to mount here. It moved into AppContent because the cookie
          gate needs `web_settings.cookie_consent_enabled` from Redux, and this
          component renders OUTSIDE the Provider. `afterInteractive` behaves the
          same either way. */}
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          {/* Function-child form, NOT `loading={null}`. PersistGate only
                bootstraps in componentDidMount, which never runs during
                renderToString — so the loading-prop form returns null on the
                server and nothing below it ever server-renders. The function
                form always renders children, passing the flag down, which lets
                SEO pages emit real HTML. Never pass `loading` alongside this;
                redux-persist warns and ignores it.

                Note there is also deliberately NO <Suspense> around AppContent.
                SSR-enabled next/dynamic pages (the homepage among them) suspend
                during renderToString, and a boundary at this level catches that
                and writes the FALLBACK into the server HTML. The client then
                resolves the chunk and renders the real tree, so hydration
                compares a div (the Loader) against page content and fails.
                Without a boundary, Next waits for the chunk and server-renders
                the page itself — which the SEO markup here depends on. */}
          {/* Theme toggle UI is commented out in Header.jsx — forcedTheme
                pins the app to light regardless of system preference or any
                theme value left in localStorage from before the toggle was
                removed, so it can't silently render dark for returning users. */}
          <PersistGate persistor={persistor}>
            {(bootstrapped) => (
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                forcedTheme="light"
                enableSystem={false}
              >
                <AppContent
                  Component={Component}
                  pageProps={pageProps}
                  bootstrapped={bootstrapped}
                />
              </ThemeProvider>
            )}
          </PersistGate>
        </Provider>
      </QueryClientProvider>
    </main>
  );
}
