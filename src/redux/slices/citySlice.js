import { createSlice } from "@reduxjs/toolkit";
const initialState = {
    status: "loading",
    city: null,
};
export const locationReducer = createSlice({
    name: "city",
    initialState,
    reducers: {
        setCity: (state, action) => {
            state.status = "fulfill";
            const next = action.payload.data;
            // Skip the reference swap when lat/lng are unchanged — every
            // effect keyed on city.latitude/longitude (home_layout, cart,
            // categories) re-fires on ANY new city object, even one carrying
            // identical coordinates (e.g. a redundant fetchCity re-run).
            if (
                state.city &&
                next &&
                state.city.latitude === next.latitude &&
                state.city.longitude === next.longitude
            ) {
                return;
            }
            state.city = next;
        }
    }
});

export const { setCity } = locationReducer.actions;
export default locationReducer.reducer;