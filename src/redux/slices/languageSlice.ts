import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LanguageState {
    selectedLanguage: any | null;
    availableLanguages: any | null;
    // Language codes for URL parsing (["en","ur","fr"]). Seeded from SSR
    // pageProps on the first paint so the client can parse /ur/... immediately,
    // BEFORE Layout fetches the full availableLanguages objects. Without this,
    // the language segment reads as a zone on initial load (double-prefix bug).
    languageCodes: string[] | null;
}

const initialState: LanguageState = {
    selectedLanguage: null,
    availableLanguages: null,
    languageCodes: null,
}

export const languageReducer = createSlice({
    name: "language",
    initialState,
    reducers: {
        setSelectedLanguage: (state, action: PayloadAction<{ data: any }>) => {
            state.selectedLanguage = action.payload.data
        },
        setAvailableLanguages: (state, action: PayloadAction<{ data: any }>) => {
            state.availableLanguages = action.payload.data
        },
        setLanguageCodes: (state, action: PayloadAction<string[]>) => {
            state.languageCodes = action.payload
        }
    }
})

export const { setAvailableLanguages, setSelectedLanguage, setLanguageCodes } = languageReducer.actions
export default languageReducer.reducer