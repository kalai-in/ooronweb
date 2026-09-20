import enTranslation from "./en.json"
import { store } from "@/redux/store";

// Non-reactive t() reads the persisted language from redux. The server and the
// FIRST client render both have selectedLanguage=null (redux-persist rehydrates
// asynchronously, AFTER first paint), so both emit English. If t() were allowed
// to read the rehydrated language during hydration the two trees would disagree
// (React hydration error #418: server "About Us" vs client "Über uns").
//
// So t() is hard-pinned to English until _app flips this flag — which it does
// only AFTER PersistGate reports `bootstrapped`, in the same pass that
// re-renders the whole tree, so every raw t() call re-evaluates against the real
// language. One central gate makes all raw t() sites hydration-safe without
// touching them. See _app.js (markTranslationsHydrated) + t-hydration-hazard.
let hydrated = false;
export const markTranslationsHydrated = (): void => {
    hydrated = true;
};

const enTranslationMap: Record<string, string> = enTranslation;

export const t = (label: string): string => {
    if (!hydrated) return enTranslationMap[label];
    const state = store.getState() as any;
    const langData = state.Language?.selectedLanguage?.json_data && state.Language?.selectedLanguage?.json_data[label];
    if (langData) {
        return langData;
    } else {
        return enTranslationMap[label];
    }
};
