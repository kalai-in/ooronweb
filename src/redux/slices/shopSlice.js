import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    status: "loading",
    shop: null,
    isRefetch: 0
};

export const shopReducer = createSlice({
    name: "shop",
    initialState,
    reducers: {
        setShop: (state, action) => {
            state.status = "fulfill";
            state.shop = action.payload.data;
        },
        setIsRefetch:(state,action) => {
            state.isRefetch += 1;
        }
    }

});
export const { setShop,setIsRefetch } = shopReducer.actions;
export default shopReducer.reducer;