import { QueryClient } from "@tanstack/react-query";

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
let browserQueryClient: QueryClient | undefined;
export const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
};
