"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/utils/gtag";

/**
 * App Router replacement for _app.js's routeChangeComplete handler. There is
 * no "navigation started" event to mirror routeChangeStart — see
 * useAppNavigate.ts for how the visible loader is driven instead. This only
 * covers the completion side: firing a GA pageview once the URL has actually
 * changed, the same job routeChangeComplete did.
 */
export default function NavigationEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The initial load's page_view is already fired by the GA init script's
  // onReady (see AppContent) — skip this effect's first run so it only
  // reports actual client-side route changes, not the first paint too.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname || "/";
    pageview(url);
  }, [pathname, searchParams]);

  return null;
}
