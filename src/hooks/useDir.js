import { useSelector } from "react-redux";
import useIsHydrated from "./useIsHydrated";

/**
 * Hydration-safe text direction ("RTL" / "LTR") for the active language.
 *
 * The selected language lives in redux-persist, so it is `null` during SSR and
 * on the very first client render, then populated once persist rehydrates. Any
 * `dir={language?.type}` read straight from the store therefore flips
 * undefined→"LTR"/"RTL" between the server HTML and the first client paint, and
 * React discards the whole subtree (hydration error #418). This pattern is
 * repeated on ~16 section/wrapper elements across the app, so it is centralised
 * here.
 *
 * Returns `undefined` until hydrated — matching the server's `dir={undefined}`
 * exactly — then the real direction on the next render. `undefined` renders no
 * `dir` attribute, so LTR (the server default) is preserved on first paint.
 *
 * Usage: `const dir = useDir();` then `<section dir={dir}>`.
 */
const useDir = () => {
  const type = useSelector(
    (state) => state.Language?.selectedLanguage?.type,
  );
  const hydrated = useIsHydrated();
  return hydrated ? type : undefined;
};

export default useDir;
