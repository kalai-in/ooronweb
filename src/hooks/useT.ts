import { useCallback } from "react";
import enTranslation from "@/utils/en.json";
import { t } from "@/utils/translation";
import useIsHydrated from "./useIsHydrated";

/**
 * Hydration-safe translation.
 *
 * The plain `t()` reads the persisted selected language from the redux store.
 * The server has no persisted state, so it always renders the `en.json`
 * fallback; a client whose persisted language is non-English (e.g. Urdu) renders
 * the localized string on the first paint. Server text != client text on every
 * server-rendered `t()` node → React discards the tree (hydration error #418).
 *
 * This hook returns a `t`-shaped function that yields the English string until
 * the client has hydrated — matching the server's HTML exactly — then delegates
 * to the real `t()` on the next render (the component re-renders because
 * `useIsHydrated` flips). Use it in any component that is SERVER-RENDERED (home
 * sections, product page, header/footer). Purely client-only / portalled UI
 * (drawers, modals opened on interaction) can keep using `t()` directly.
 *
 * Usage:
 *   const tr = useT();
 *   ...
 *   {tr("see_all")}
 */
const useT = (): ((label: string) => string) => {
  const hydrated = useIsHydrated();
  return useCallback(
    (label: string) =>
      hydrated ? t(label) : (enTranslation as Record<string, string>)[label],
    [hydrated],
  );
};

export default useT;
