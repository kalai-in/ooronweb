import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ShopState {
    status: "loading" | "fulfill";
    shop: any | null;
    isRefetch: number;
}

const initialState: ShopState = {
    status: "loading",
    shop: null,
    isRefetch: 0
};

export const shopReducer = createSlice({
    name: "shop",
    initialState,
    reducers: {
        setShop: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            state.shop = action.payload.data;
        },
        setIsRefetch:(state) => {
            state.isRefetch += 1;
        }
    }

});
export const { setShop,setIsRefetch } = shopReducer.actions;
export default shopReducer.reducer;