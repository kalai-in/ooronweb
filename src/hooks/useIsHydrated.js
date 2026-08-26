import { useEffect, useState } from "react";

/**
 * True once the client has mounted, false during SSR and on the first client
 * render.
 *
 * redux-persist rehydrates from localStorage in an effect, so any UI branching
 * on persisted state (settings, cart, user, city) renders empty on the server
 * and populated on the client — the two disagree and React discards the server
 * tree (hydration error #418). PersistGate's function-child form in _app.js is
 * deliberate (it lets SEO pages emit real HTML instead of null), so the guard
 * belongs at the point of use rather than at the gate.
 *
 * Gate only the branches whose *presence* differs — an element that always
 * renders and merely changes text/count is fine to leave alone; React patches
 * those on the second render without a mismatch.
 *
 * Same shape as useHydratedMediaQuery: first render matches the server, the
 * real value lands on the second.
 */
const useIsHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return hydrated;
};

export default useIsHydrated;
