
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
    status: "loading" | "fulfill";
    user: any | null;
    fcm_token: string | null;
    authId: string;
    jwtToken: string;
    authType: string | null;
}

const initialState: UserState = {
    status: "loading",
    user: null,
    fcm_token: "",
    authId: "",
    jwtToken: "",
    authType: ""
};

export const userReducer = createSlice({
    name: "user",
    initialState,
    reducers: {
        setCurrentUser: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            state.user = action.payload.data;
        },
        setAuthType: (state, action: PayloadAction<{ data: string }>) => {
            state.status = "fulfill";
            state.authType = action.payload.data;
        },
        logoutAuth: (state) => {
            state.status = "loading";
            state.user = null;
            state.fcm_token = null;
            state.authId = "";
            state.jwtToken = "";
            state.authType = null;
        },
        deductUserBalance: (state, action: PayloadAction<{ data: number | string }>) => {
            if (state.user) {
                // Coerce to Number: the API sends balance as a STRING, so a bare
                // -=/+= would string-concat ("347.98" + 500 -> "347.98500") and
                // the wallet UI (.toFixed) then breaks until a reload refetches a
                // real number. Normalise both sides to keep balance numeric.
                state.user.balance =
                    Number(state.user.balance || 0) - Number(action.payload.data || 0);
            }
        },
        addUserBalance: (state, action: PayloadAction<{ data: number | string }>) => {
            if (state.user) {
                state.user.balance =
                    Number(state.user.balance || 0) + Number(action.payload.data || 0);
            }
        },
        setFcmToken: (state, action: PayloadAction<{ data: string }>) => {
            state.fcm_token = action.payload.data;
        },
        setAuthId: (state, action: PayloadAction<{ data: string }>) => {
            state.authId = action.payload.data;
        },
        setJWTToken: (state, action: PayloadAction<{ data: string }>) => {
            state.jwtToken = action.payload.data;
        }
    }
});

export const { setCurrentUser, logoutAuth, deductUserBalance, addUserBalance, setFcmToken, setAuthId, setJWTToken, setAuthType } = userReducer.actions;
export default userReducer.reducer;