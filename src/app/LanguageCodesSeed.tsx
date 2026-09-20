"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setLanguageCodes } from "@/redux/slices/languageSlice";

/**
 * Seeds Redux's language-code list from a page's own SSR-resolved langCodes,
 * so the client can correctly parse a /{lang}/... URL segment on first paint
 * — BEFORE Layout.jsx's live fetchLanguage() call resolves.
 *
 * Why this exists (not just AppContent's own seed effect): the App Router's
 * root layout.tsx is one shared tree with no per-route props channel — unlike
 * the old Pages Router _app.js, which received fresh pageProps.langCodes on
 * every navigation and fed them into AppContent directly. Each migrated page
 * already computes langCodes server-side (same getLanguagesCached() call the
 * old getServerSideProps used); this component is how that value reaches
 * Redux now, rendered by the page itself rather than threaded through
 * layout.tsx/Providers.tsx/AppContent.tsx.
 *
 * Without this, useZoneHref/useLanguages can't tell a language code ("fr")
 * from a zone slug ("bhuj-quick") by shape alone on a /{lang}/{zone}/... URL
 * until the client's own language fetch completes over the network — so
 * every zoneHref()-built link (Header, Footer, breadcrumbs) is wrong for a
 * meaningfully longer window than the old same-tick prop seed gave for free.
 */
export default function LanguageCodesSeed({ codes }: { codes?: string[] | null }) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (Array.isArray(codes) && codes.length) {
      dispatch(setLanguageCodes(codes));
    }
  }, [codes, dispatch]);

  return null;
}
