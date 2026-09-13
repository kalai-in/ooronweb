import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ThemeState {
    status: "loading" | "fulfill";
    theme: string;
}

const initialState: ThemeState = {
    status: 'loading',
    theme: "light"
}

export const themeSlice = createSlice({
    name: "Theme",
    initialState,
    reducers: {
        setLocalTheme: (state, action: PayloadAction<{ data: string }>) => {
            state.status = "fulfill";
            state.theme = action.payload.data
        }
    }
})

export const { setLocalTheme } = themeSlice.actions
export default themeSlice.reducer;