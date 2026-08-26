
import { createSlice } from "@reduxjs/toolkit";


const initialState = {
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
        setCurrentUser: (state, action) => {
            state.status = "fulfill";
            state.user = action.payload.data;
        },
        setAuthType: (state, action) => {
            state.status = "fulfill";
            state.authType = action.payload.data;
        },
        logoutAuth: (state, action) => {
            state.status = "loading";
            state.user = null;
            state.fcm_token = null;
            state.authId = "";
            state.jwtToken = "";
            state.authType = null;
        },
        deductUserBalance: (state, action) => {
            if (state.user) {
                // Coerce to Number: the API sends balance as a STRING, so a bare
                // -=/+= would string-concat ("347.98" + 500 -> "347.98500") and
                // the wallet UI (.toFixed) then breaks until a reload refetches a
                // real number. Normalise both sides to keep balance numeric.
                state.user.balance =
                    Number(state.user.balance || 0) - Number(action.payload.data || 0);
            }
        },
        addUserBalance: (state, action) => {
            if (state.user) {
                state.user.balance =
                    Number(state.user.balance || 0) + Number(action.payload.data || 0);
            }
        },
        setFcmToken: (state, action) => {
            state.fcm_token = action.payload.data;
        },
        setAuthId: (state, action) => {
            state.authId = action.payload.data;
        },
        setJWTToken: (state, action) => {
            state.jwtToken = action.payload.data;
        }
    }
});

export const { setCurrentUser, logoutAuth, deductUserBalance, addUserBalance, setFcmToken, setAuthId, setJWTToken, setAuthType } = userReducer.actions;
export default userReducer.reducer;