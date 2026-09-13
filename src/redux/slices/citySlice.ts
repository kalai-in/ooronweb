import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CityState {
    status: "loading" | "fulfill";
    city: any | null;
}

const initialState: CityState = {
    status: "loading",
    city: null,
};
export const locationReducer = createSlice({
    name: "city",
    initialState,
    reducers: {
        setCity: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            const next = action.payload.data;
            // Skip the reference swap when the city is genuinely unchanged —
            // every effect keyed on city.latitude/longitude (home_layout, cart,
            // categories) re-fires on ANY new city object, even one carrying
            // identical coordinates (e.g. a redundant fetchCity re-run).
            //
            // Coordinates alone are NOT a sufficient identity check: a city with
            // one zone record per channel (bhuj-quick / bhuj-ecommerce) has two
            // zones sharing a single polygon centroid, so a channel switch
            // arrives with identical lat/lng but a DIFFERENT slug. Skipping on
            // coords alone dropped that slug write, which left Header's
            // fetchCity zoneMismatch guard (it compares the URL zone against
            // city.slug) permanently true — it re-dispatched this action
            // forever, three network calls per pass, and the Header never left
            // "Loading...". Compare slug too so a same-coordinate zone change
            // still commits.
            if (
                state.city &&
                next &&
                state.city.latitude === next.latitude &&
                state.city.longitude === next.longitude &&
                (state.city.slug ?? null) === (next.slug ?? null)
            ) {
                return;
            }
            state.city = next;
        }
    }
});

export const { setCity } = locationReducer.actions;
export default locationReducer.reducer;