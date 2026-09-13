import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CountrySettingState {
    status: "loading" | "fulfill";
    countrySetting: any | null;
    countrySettingFetchedTime: Date;
}

const initialState: CountrySettingState = {
    status: 'loading',
    countrySetting: null,
    countrySettingFetchedTime: new Date(),
};

export const countrySettingReducer = createSlice({
    name: "countrySetting",
    initialState,
    reducers: {
        setCountrySetting: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            state.countrySetting = action.payload.data;
            state.countrySettingFetchedTime = new Date();
        },
    },
});

export const { setCountrySetting } = countrySettingReducer.actions;
export default countrySettingReducer.reducer;
