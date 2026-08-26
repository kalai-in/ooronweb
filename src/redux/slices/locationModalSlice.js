import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Transient: blacklisted from redux-persist in store.js so a reload never
  // reopens the modal.
  showLocation: false,
  // Country picked in the footer, or the API's is_default on first load.
  // Drives which zones the modal offers.
  selectedCountry: null,
  // Whole zone object as the API returned it: { id, name, slug }. The slug is
  // used verbatim in URLs — never construct one from the name, since the two
  // don't correspond ("Bhuj (Quick)" -> "bhuj-quick").
  selectedZone: null,
};

export const locationModalReducer = createSlice({
  name: "locationModal",
  initialState,
  reducers: {
    openLocationModal: (state) => {
      state.showLocation = true;
    },
    closeLocationModal: (state) => {
      state.showLocation = false;
    },
    setShowLocation: (state, action) => {
      state.showLocation = action.payload;
    },
    // Footer country change: remember the country and open the modal so the
    // user picks a zone inside it.
    setSelectedCountry: (state, action) => {
      state.selectedCountry = action.payload;
      state.showLocation = true;
    },
    // Startup default-country resolution. Separate from setSelectedCountry
    // because that one opens the modal — correct for a deliberate footer
    // change, wrong for booting with the backend's is_default country.
    setDefaultCountry: (state, action) => {
      state.selectedCountry = action.payload;
    },
    // Store the zone object verbatim from the API.
    setSelectedZone: (state, action) => {
      state.selectedZone = action.payload;
    },
  },
});

export const {
  openLocationModal,
  closeLocationModal,
  setShowLocation,
  setSelectedCountry,
  setDefaultCountry,
  setSelectedZone,
} = locationModalReducer.actions;
export default locationModalReducer.reducer;
