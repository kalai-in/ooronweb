import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { sanitizePaymentSetting } from "@/utils/paymentSettings";

interface SettingState {
    status: "loading" | "fulfill";
    setting: any | null;
    payment_setting: any | null;
    settingsFetchedTime: Date;
    paymentSettingsFetchTime: Date;
    isPopupSeen: boolean;
}

const initialState: SettingState = {
    status: 'loading',
    setting: null,
    payment_setting: null,
    settingsFetchedTime: new Date(),
    paymentSettingsFetchTime: new Date(),
    isPopupSeen: false
};
export const settingReducer = createSlice({
    name: "setting",
    initialState,
    reducers: {
        setSetting: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            state.setting = action.payload.data;
            state.settingsFetchedTime = new Date();
        },
        // Whitelisted at the reducer (not the caller) so every dispatch path is
        // covered — this slice is persisted to localStorage, and the raw API
        // payload can carry gateway secret keys. See utils/paymentSettings.js.
        setPaymentSetting: (state, action: PayloadAction<{ data: any }>) => {
            state.status = "fulfill";
            state.payment_setting = sanitizePaymentSetting(action.payload.data);
            state.paymentSettingsFetchTime = new Date();
        },
        setIsPopupSeen: (state, action: PayloadAction<{ data: boolean }>) => {
            state.isPopupSeen = action.payload.data;
        }
    }
});
export const { setSetting, setPaymentSetting, setIsPopupSeen } = settingReducer.actions;
export default settingReducer.reducer;