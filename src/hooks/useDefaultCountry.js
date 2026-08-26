import { useEffect, useRef } from "react";
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
 */
const useDefaultCountry = () => {
  const dispatch = useDispatch();
  const selectedCountry = useSelector(
    (state) => state?.LocationModal?.selectedCountry,
  );
  // Guards against StrictMode's double-invoke and any remount racing a second
  // fetch. A ref, not module scope: module state would leak across requests
  // under SSR.
  const requested = useRef(false);

  useEffect(() => {
    if (selectedCountry?.id || requested.current) return;
    requested.current = true;

    let active = true;
    api
      .getCountriesWithDefault()
      .then((res) => {
        if (!active) return;
        const countries = res?.data || [];
        // Loose == : the API sends is_default as 1 (number) or "1" (string).
        const fallback = countries.find((c) => c?.is_default == 1);
        if (fallback) dispatch(setDefaultCountry(fallback));
      })
      .catch((err) => {
        console.log("Default country fetch failed:", err?.message);
        requested.current = false;
      });

    return () => {
      active = false;
    };
  }, [selectedCountry?.id, dispatch]);
};

export default useDefaultCountry;
