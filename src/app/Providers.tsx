"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/redux/store";
// import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./getQueryClient";
import AppContent from "./AppContent";
import AppErrorBoundary from "./AppErrorBoundary";

export default function Providers({
  children,
  langCodes,
}: {
  children: React.ReactNode;
  langCodes?: string[];
}) {
  // useState (not a module constant) so the server builds one client per
  // request — see getQueryClient. In the browser this resolves to the same
  // memoized instance on every render, so the cache survives route changes.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        {/* Function-child form, NOT `loading={null}`. PersistGate only
              bootstraps in componentDidMount, which never runs during
              renderToString — so the loading-prop form returns null on the
              server and nothing below it ever server-renders. The function
              form always renders children, passing the flag down, which lets
              SEO pages emit real HTML. Never pass `loading` alongside this;
              redux-persist warns and ignores it. */}
        {/* Theme toggle UI is commented out in Header.jsx — forcedTheme
              pins the app to light regardless of system preference or any
              theme value left in localStorage from before the toggle was
              removed, so it can't silently render dark for returning users. */}
        <PersistGate persistor={persistor}>
          {(bootstrapped: boolean) => (
            // ThemeProvider removed (next-themes) — it injects a no-flash
            // <script> that React dev logs a "script tag while rendering"
            // warning for. App is forced light-only with no toggle, so the
            // provider added nothing but that warning. useTheme() consumers
            // (Layout, Loader, StoreClosed) were updated to a literal
            // "light" in place of resolvedTheme. Re-add
            // attribute="class" defaultTheme="light" forcedTheme="light"
            // enableSystem={false} if a toggle ever comes back.
            // <ThemeProvider ...>
            
              /* useSearchParams() (Header, via Layout) needs a Suspense
                  boundary above it for Next's static-prerendering — that
                  boundary is scoped to just <Header /> in Layout.tsx now,
                  not here. Wrapping the whole app in one Suspense used to
                  mean a CSR-bailout on Header's useSearchParams() blanked
                  out {children} too — including real SEO content like
                  product price/description — which is exactly what
                  happened in production (dgst=BAILOUT_TO_CLIENT_SIDE_RENDERING
                  on product pages, 2026-08-25). Scoping the boundary to
                  Header alone means a Header bailout can't take the rest
                  of the page down with it. */
              <AppErrorBoundary>
                <AppContent bootstrapped={bootstrapped} langCodes={langCodes}>
                  {children}
                </AppContent>
              </AppErrorBoundary>
            // </ThemeProvider>
          )}
        </PersistGate>
      </Provider>
    </QueryClientProvider>
  );
}
