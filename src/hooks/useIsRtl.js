import { useSelector } from "react-redux";
import useIsHydrated from "./useIsHydrated";

/**
 * Hydration-safe RTL flag for the active language.
 *
 * The non-hook `isRtl()` in @/lib/utils reads the persisted language straight
 * from the store, so it returns `false` during SSR / the first client render and
 * `true` on a later render once persist rehydrates for an RTL user. Any rendered
 * className / key / structural prop derived from it therefore flips between the
 * server HTML and the first client paint, discarding the subtree (hydration
 * error #418).
 *
 * Returns `false` until hydrated — matching the server (which is always LTR) —
 * then the real value on the next render. Drop-in replacement for
 * `const rtl = isRtl();` → `const rtl = useIsRtl();` at any site whose result
 * affects rendered output.
 */
const useIsRtl = () => {
  const type = useSelector(
    (state) => state.Language?.selectedLanguage?.type,
  );
  const hydrated = useIsHydrated();
  return hydrated && type === "RTL";
};

export default useIsRtl;
