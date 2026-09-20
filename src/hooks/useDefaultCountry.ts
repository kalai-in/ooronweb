import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import { setDefaultCountry } from "@/redux/slices/locationModalSlice";

/**
 * Resolves the backend's is_default country on startup and stores it, which in
 * turn drives the zone fetch already living in Location.jsx (keyed on
 * selectedCountry.id — so this adds no second zones call).
 *
 * No-ops when a country is already chosen: selectedCountry is persisted, so a
 * returning user's pick must never be overwritten by the default.
 *
 * Deliberately does NOT pick a zone. The backend exposes no default zone, and
 * inventing one would silently show a user the wrong city's catalogue — the
 * modal asks instead.
 *
 * Returns `resolving`: true from mount until either a stored/default country
 * lands or the fetch fails. Callers that render UI gated on selectedCountry
 * (the country chip, the zone list) need this — without it, the very first
 * paint after a fresh page load renders with selectedCountry still null
 * (the fetch hasn't resolved yet) and nothing ever prompts a re-check once it
 * does resolve except the render this hook itself causes.
 */
const useDefaultCountry = (): { resolving: boolean } => {
  const dispatch = useDispatch();
  const selectedCountry = useSelector(
    (state: any) => state?.LocationModal?.selectedCountry,
  );
  const [resolving, setResolving] = useState(!selectedCountry?.id);
  // Guards against StrictMode's double-invoke and any remount racing a second
  // fetch. A ref, not module scope: module state would leak across requests
  // under SSR.
  const requested = useRef(false);

  useEffect(() => {
    if (selectedCountry?.id) {
      // intentional: syncs `resolving` from redux's selectedCountry, which
      // rehydrates asynchronously (redux-persist) — not known at render time.
      // See doc comment above for why this can't be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolving(false);
      return;
    }
    if (requested.current) return;
    requested.current = true;

    // No `active`/cleanup-cancellation flag: requested.current (a ref)
    // already survives StrictMode's dev-only phantom mount→cleanup→remount
    // cycle and prevents a duplicate fetch, so there's nothing left for an
    // `active` flag to guard against except the real fetch's own result —
    // and dropping that on a genuine unmount is harmless (a dispatch to an
    // unmounted component's store is a normal, safe no-op in Redux, not a
    // React state update). Gating the dispatch/setResolving on `active`
    // previously meant the ONE real in-flight fetch (started before
    // StrictMode's phantom cleanup ran) silently discarded its own result.
    api
      .getCountriesWithDefault()
      .then((res: any) => {
        const countries = res?.data || [];
        // Loose == : the API sends is_default as 1 (number) or "1" (string).
        const fallback = countries.find((c: any) => c?.is_default == 1);
        if (fallback) dispatch(setDefaultCountry(fallback));
      })
      .catch((err: any) => {
        console.log("Default country fetch failed:", err?.message);
        requested.current = false;
      })
      .finally(() => {
        setResolving(false);
      });
  }, [selectedCountry?.id, dispatch]);

  return { resolving };
};

export default useDefaultCountry;
