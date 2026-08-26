import { CONSENT_DECLINED, readConsent } from "@/utils/cookieConsent";

// Google Analytics 4 helpers.
//
// The gtag.js snippet in _app.js only fires a page_view for the initial HTML
// load. Next.js client-side navigations never reload the document, so every
// route change after the first has to be reported by hand — hence pageview().

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Analytics is optional: without an ID configured, every helper is a no-op so
// local/preview builds don't send data or throw.
//
// The consent check is a second line of defence. _app.js already refuses to
// mount the tag without consent, so `window.gtag` normally won't exist — but a
// visitor who accepts and then declines keeps the loaded tag for the rest of
// the session, and unmounting a <Script> does not unload it. Checking here
// stops events at the source.
export const isGaEnabled = () =>
  !!GA_MEASUREMENT_ID &&
  typeof window !== "undefined" &&
  !!window.gtag &&
  readConsent() !== CONSENT_DECLINED;

// Sent as an explicit event rather than a repeat gtag("config", ...): once the
// tag is initialised with send_page_view:false, further config calls update
// settings without emitting a page_view, so nothing would be reported.
export const pageview = (url) => {
  if (!isGaEnabled()) return;
  window.gtag("event", "page_view", {
    page_path: url,
    page_location: window.location.href,
    page_title: document.title,
  });
};

// Generic event helper: gtag("event", name, params).
export const event = (name, params = {}) => {
  if (!isGaEnabled()) return;
  window.gtag("event", name, params);
};

