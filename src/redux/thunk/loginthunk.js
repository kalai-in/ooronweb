import { setJWTToken } from "../slices/userSlice";
import { setIsGuest } from "../slices/cartSlice";

export const setTokenThunk = (token) => async (dispatch) => {

    try {
        await dispatch(setJWTToken({ data: token }));
        // keep cart auth flag in sync with the token (single source of truth)
        dispatch(setIsGuest({ data: false }));
        return true;
    } catch (error) {
        console.error("Error setting token:", error);
        return false;
    }
}
