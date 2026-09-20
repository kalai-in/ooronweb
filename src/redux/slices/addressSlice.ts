import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AddressState {
    selectedEditAddress: any[];
    allAddresses: any[];
    selectedAddress: any[];
}

const initialState: AddressState = {
    selectedEditAddress: [],
    allAddresses: [],
    selectedAddress: []
}

export const addressReducer = createSlice({
    name: "address",
    initialState,
    reducers: {
        setSelectedAddresForEdit: (state, action: PayloadAction<{ data: any[] }>) => {
            state.selectedEditAddress = action.payload.data
        },
        setAllAddresses: (state, action: PayloadAction<{ data: any[] }>) => {
            state.allAddresses = action.payload.data
        },
        setSelectedAddress: (state, action: PayloadAction<{ data: any[] }>) => {

            state.selectedAddress = action.payload.data
        }
    }
})

export const { setAllAddresses, setSelectedAddresForEdit, setSelectedAddress } = addressReducer.actions

export default addressReducer.reducer