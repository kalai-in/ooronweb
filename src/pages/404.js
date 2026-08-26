import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import pageNotFound from "@/assets/not_found_images/404.svg";
import { t } from "@/utils/translation";
import Link from "next/link";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import { RESERVED_ROUTES } from "@/utils/reservedRoutes";
import { DEFAULT_LANGUAGE } from "@/utils/languageRoutes";

// t() reads the redux-persist store; on some server runtimes that read can throw
// during 404 SSR, which would bubble up and make Next serve its built-in _error
// page instead of this custom 404. Wrap it so a failed lookup degrades to a
// plain English label rather than crashing the page.
const safeT = (key, fallback) => {
  try {
    const val = t(key);
    return val && val !== key ? val : fallback;
  } catch {
    return fallback;
  }
};

const Custom404 = () => {
  const router = useRouter();
  // t() reads the redux-persist store, which is EMPTY on the server + first
  // client paint and only fills after rehydration — so t() returns the English
  // fallback on the server but the user's language (e.g. German) after mount,
  // and the two don't match: a hydration error. Gate the localized text behind
  // a mounted flag: render the plain English fallback for SSR + first paint
  // (matches the server), then swap to t() once mounted. See t-hydration-hazard.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const label = (key, fallback) => (mounted ? safeT(key, fallback) : fallback);
  // Build the Home href from the URL directly — NOT via useZoneHref. 404 is a
  // static page with no gSSP, so it never receives the middleware's ?lang/?zone
  // query, and the redux language list may not be loaded yet — so useZoneHref
  // can't recognise the language segment and drops the prefix.
  //
  // We keep only the leading LANGUAGE segment. The ZONE is deliberately dropped:
  // a common way to land on this 404 is a bad zone slug (/bhuj-quick13), and the
  // zone shape-check can't tell a bad slug from a good one — so preserving it
  // would rebuild the very URL that 404'd, trapping the user in a loop with no
  // way to reach home. Home therefore always points at the zone-less URL, from
  // which the app re-resolves the visitor's real zone.
  const buildHomeHref = () => {
    try {
      const path = (router?.asPath || "/").split(/[?#]/)[0];
      const segs = path.split("/").filter(Boolean);
      // Language: 2–5 lowercase letters, not the default language, and not a
      // reserved top-level route (so "cart"/"blog" aren't mistaken for a locale).
      if (
        segs[0] &&
        /^[a-z]{2,5}$/.test(segs[0]) &&
        segs[0] !== DEFAULT_LANGUAGE &&
        !RESERVED_ROUTES.has(segs[0])
      ) {
        return `/${segs[0]}`;
      }
      return "/";
    } catch {
      // Never let Home-href building throw during 404 render — a throw here
      // would bubble up and make Next serve its built-in _error page instead
      // of this custom 404. Degrade to the plain home link.
      return "/";
    }
  };
  return (
    <section className="min-h-screen w-full flex items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center justify-center gap-6 text-center max-w-2xl w-full">
        <ThemedSvg
          src={pageNotFound}
          alt="Page Not found image"
          className="w-full max-w-xl"
        />
        <h1 className="text-3xl md:text-4xl font-bold">
          404 {label("page_not_found", "Page Not Found")}
        </h1>
        <p className="text-lg md:text-xl text-gray-500">
          {label(
            "page_not_found_description",
            "The page you are looking for could not be found.",
          )}
        </p>
        <Link
          href={buildHomeHref()}
          className="primaryBackColor text-white font-semibold text-base px-6 py-2.5 rounded-md mt-2"
        >
          {label("home", "Home")}
        </Link>
      </div>
    </section>
  );
};

export default Custom404;
