import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    status: 'loading',
    countrySetting: null,
    countrySettingFetchedTime: new Date(),
};

export const countrySettingReducer = createSlice({
    name: "countrySetting",
    initialState,
    reducers: {
        setCountrySetting: (state, action) => {
            state.status = "fulfill";
            state.countrySetting = action.payload.data;
            state.countrySettingFetchedTime = new Date();
        },
    },
});

export const { setCountrySetting } = countrySettingReducer.actions;
export default countrySettingReducer.reducer;
