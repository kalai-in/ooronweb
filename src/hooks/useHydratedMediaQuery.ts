import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";

/**
 * useMediaQuery that is hydration-safe.
 *
 * react-responsive has no matchMedia on the server, so it returns false there.
 * On a desktop client it returns true immediately — so the server and the first
 * client render disagree, React throws away the server tree and re-renders
 * (error #418). Harmless for SEO (crawlers don't hydrate) but a real cost for
 * users, and it defeats the point of server-rendering the page.
 *
 * Returning `false` until mounted makes the first client render match the
 * server's exactly; the real value lands on the second render. Callers must
 * therefore treat `false` as "narrow / no hover" — which is the safe default
 * everywhere this is used (plain image over hover-zoom, no bottom sheet).
 */
const useHydratedMediaQuery = (query: string): boolean => {
  const matches = useMediaQuery({ query });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // intentional: flips mounted flag exactly once after mount, see doc
    // comment above — the real matches value only lands on the 2nd render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return mounted && matches;
};

export default useHydratedMediaQuery;
