import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FavoriteState {
    status: "loading" | "fulfill";
    favorite: any | null;
    favouritelength: number;
    favouriteProductIds: any[];
}

const initialState: FavoriteState = {
    status: 'loading', //fulfill
    favorite: null,
    favouritelength: 0,
    favouriteProductIds: []
};

export const favoriteReducer = createSlice({
    name: "wishlist",
    initialState,
    reducers: {
        setFavorites: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill"
            state.favorite = action.payload.data
        },
        setFavoriteLength: (state, action: PayloadAction<{ data: number }>) => {
            state.status = "fulfill"
            state.favouritelength = action.payload.data
        },
        setFavoriteProductIds: (state, action: PayloadAction<{ data: any[] }>) => {
            state.status = "fulfill"
            state.favouriteProductIds = action.payload.data
        }
    }
})

export const { setFavoriteLength, setFavoriteProductIds, setFavorites } = favoriteReducer.actions
export default favoriteReducer.reducer