import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  currentStep: 1,
  address: null,
  selectedPaymentMethod: null,
  isWalletChecked: false,
  usedWalletBalance: 0,
  orderNote: "",
  checkoutTotal: 0,
  phonepecheckoutdetails: "",
  orderType: "doorstep",
};

export const checkoutReducer = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload.data;
    },
    setAddress: (state, action) => {
      state.address = action.payload.data;
    },
    setPaymentMethod: (state, action) => {
      state.selectedPaymentMethod = action.payload.data;
    },
    setWalletChecked: (state, action) => {
      state.isWalletChecked = action.payload.data;
    },
    setUserWalletBalance: (state, action) => {
      state.usedWalletBalance = action.payload.data;
    },
    setOrderNote: (state, action) => {
      state.orderNote = action.payload.data;
    },
    setCheckoutTotal: (state, action) => {
      state.checkoutTotal = action.payload.data;
    },
    setPhonePeCheckoutDetails: (state, action) => {
      state.phonepecheckoutdetails = action.payload;
    },
    setOrderType: (state, action) => {
      state.orderType = action.payload.data;
    },
    clearCheckout: (state) => {
      const phonepecheckoutdetails = state.phonepecheckoutdetails;
      Object.assign(state, {
        currentStep: 1,
        address: null,
        selectedPaymentMethod: null,
        isWalletChecked: false,
        usedWalletBalance: 0,
        orderNote: "",
        checkoutTotal: 0,
        orderType: "doorstep",
        phonepecheckoutdetails, // preserve the existing value
      });
    },
    clearPhonePeCheckoutDetails: (state) => {
      state.phonepecheckoutdetails = null;
    },
  },
});

export const {
  setAddress,
  setPaymentMethod,
  setCurrentStep,
  setWalletChecked,
  setOrderNote,
  clearCheckout,
  clearPhonePeCheckoutDetails,
  setCheckoutTotal,
  setUserWalletBalance,
  setPhonePeCheckoutDetails,
  setOrderType,
} = checkoutReducer.actions;

export default checkoutReducer.reducer;
