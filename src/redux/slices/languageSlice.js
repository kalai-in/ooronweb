import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    selectedLanguage: null,
    availableLanguages: null,
    // Language codes for URL parsing (["en","ur","fr"]). Seeded from SSR
    // pageProps on the first paint so the client can parse /ur/... immediately,
    // BEFORE Layout fetches the full availableLanguages objects. Without this,
    // the language segment reads as a zone on initial load (double-prefix bug).
    languageCodes: null,
}

export const languageReducer = createSlice({
    name: "language",
    initialState,
    reducers: {
        setSelectedLanguage: (state, action) => {
            state.selectedLanguage = action.payload.data
        },
        setAvailableLanguages: (state, action) => {
            state.availableLanguages = action.payload.data
        },
        setLanguageCodes: (state, action) => {
            state.languageCodes = action.payload
        }
    }
})

export const { setAvailableLanguages, setSelectedLanguage, setLanguageCodes } = languageReducer.actions
export default languageReducer.reducer