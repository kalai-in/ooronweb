// import { ActionTypes } from "../action-type";
import { createSlice } from "@reduxjs/toolkit";
import { logoutAuth } from "./userSlice";

// Guest carts are kept per channel so that items added in "quick" never leak into
// "ecommerce" and vice-versa. The canonical store is `guestCartByChannel` /
// `guestCartTotalByChannel`; the flat `guestCart` / `guestCartTotal` fields are a
// mirror of the ACTIVE channel's bucket so the ~150 existing consumers keep working
// unchanged. `activeChannel` decides which bucket the reducers mutate + mirror.
export const GUEST_CHANNELS = ["quick", "ecommerce"];
const DEFAULT_CHANNEL = "quick";

const normalizeChannel = (channel) =>
  GUEST_CHANNELS.includes(channel) ? channel : DEFAULT_CHANNEL;

const initialState = {
  status: "loading",
  cart: null,
  checkout: null,
  promo_code: null,
  is_wallet_checked: 0,
  cartProducts: [],
  cartSubTotal: 0,
  currency: "",
  // Per-channel guest carts + currency (canonical). Currency is per-channel because
  // quick (e.g. ₹) and ecommerce (e.g. $) can differ; sharing one field made the badge
  // flip to the other channel's symbol whenever any cart API for it resolved.
  activeChannel: DEFAULT_CHANNEL,
  guestCartByChannel: { quick: [], ecommerce: [] },
  guestCartTotalByChannel: { quick: 0, ecommerce: 0 },
  currencyByChannel: { quick: "", ecommerce: "" },
  // Mirror of the active channel's bucket — what existing components read/write against.
  guestCart: [],
  isGuest: true,
  guestCartTotal: 0,
  self_pickup_mode: 0,
  doorstep_delivery_mode: 0,
  // Decimal precision from the /cart response. Settings no longer carry it, and the
  // remove/add responses omit it — persisting it here keeps prices showing their
  // fraction (150.00) after a mutation instead of collapsing to 150.
  decimal_point: 0,
  // Prescription files for medical products (product_type 5), keyed by
  // String(variantId) -> File. NON-serializable: blacklisted from redux-persist
  // (rootReducer cartPersistConfig) so it lives in-memory only across nav.
  prescriptions: {},
};

// Keep the flat mirror in sync with the active channel's bucket. Call after any
// mutation to a bucket or after switching the active channel.
const syncMirror = (state) => {
  const ch = normalizeChannel(state.activeChannel);
  state.guestCart = state.guestCartByChannel[ch] ?? [];
  state.guestCartTotal = state.guestCartTotalByChannel[ch] ?? 0;
  if (state.currencyByChannel) {
    state.currency = state.currencyByChannel[ch] ?? "";
  }
};

// Migration/guard: older persisted state had no per-channel buckets. Seed them from
// the legacy flat fields so existing guest carts aren't lost on first load after deploy.
const ensureBuckets = (state) => {
  if (!state.guestCartByChannel) {
    state.guestCartByChannel = {
      quick: Array.isArray(state.guestCart) ? state.guestCart : [],
      ecommerce: [],
    };
  }
  if (!state.guestCartTotalByChannel) {
    state.guestCartTotalByChannel = {
      quick: typeof state.guestCartTotal === "number" ? state.guestCartTotal : 0,
      ecommerce: 0,
    };
  }
  if (!state.currencyByChannel) {
    state.currencyByChannel = {
      quick: typeof state.currency === "string" ? state.currency : "",
      ecommerce: "",
    };
  }
  if (!state.activeChannel) state.activeChannel = DEFAULT_CHANNEL;
};

export const cartReducer = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCart: (state, action) => {
      state.status = "fulfill";
      state.cart = action.payload.data;
    },
    setCartCheckout: (state, action) => {
      state.status = "fulfill";
      state.checkout = action.payload.data;
    },
    setCartPromo: (state, action) => {
      state.status = "fulfill";
      state.promo_code = action.payload.data;
    },
    clearCartPromo: (state) => {
      // state.cart.promo_code = [];
      state.promo_code = null;
    },
    setWallet: (state, action) => {
      state.status = "fulfill";
      state.is_wallet_checked = action.payload.data;
    },
    setCartProducts: (state, action) => {
      state.cartProducts = action.payload.data;
    },
    setCartSubTotal: (state, action) => {
      state.cartSubTotal = action.payload.data;
    },
    setCartCurrency: (state, action) => {
      ensureBuckets(state);
      // Write the channel the response was fetched FOR (payload.channel), not whatever is
      // active now — a late ecommerce response must not overwrite quick's symbol, and vice
      // versa. Falls back to the active channel when no channel is supplied.
      const ch = normalizeChannel(action.payload?.channel ?? state.activeChannel);
      // Ignore empty/falsy currency so an empty-cart response can't blank a known symbol.
      if (action.payload.data) {
        state.currencyByChannel[ch] = action.payload.data;
      }
      syncMirror(state);
    },
    // Persist decimal precision from a /cart response. Ignore null/undefined so the
    // remove/add responses (which omit decimal_point) can't blank a known value.
    setCartDecimal: (state, action) => {
      if (action.payload?.data != null && action.payload?.data !== "") {
        state.decimal_point = action.payload.data;
      }
    },
    setIsGuest: (state, action) => {
      state.isGuest = action.payload.data;
    },
    // Switch which channel's guest cart is active and re-point the flat mirror.
    // Dispatch this whenever the shop channel changes (quick <-> ecommerce).
    setGuestChannel: (state, action) => {
      ensureBuckets(state);
      state.activeChannel = normalizeChannel(action.payload?.channel);
      syncMirror(state);
    },
    addtoGuestCart: (state, action) => {
      ensureBuckets(state);
      const ch = normalizeChannel(state.activeChannel);
      state.guestCartByChannel[ch] = action.payload.data ?? [];
      syncMirror(state);
    },
    setGuestCartTotal: (state, action) => {
      ensureBuckets(state);
      const ch = normalizeChannel(state.activeChannel);
      state.guestCartTotalByChannel[ch] = action.payload.data ?? 0;
      syncMirror(state);
    },
    addGuestCartTotal: (state, action) => {
      ensureBuckets(state);
      const ch = normalizeChannel(state.activeChannel);
      state.guestCartTotalByChannel[ch] =
        (state.guestCartTotalByChannel[ch] ?? 0) + action.payload.data;
      syncMirror(state);
    },
    subGuestCartTotal: (state, action) => {
      ensureBuckets(state);
      const ch = normalizeChannel(state.activeChannel);
      state.guestCartTotalByChannel[ch] =
        (state.guestCartTotalByChannel[ch] ?? 0) - action.payload.data;
      syncMirror(state);
    },
    // Clear only the active channel's guest cart.
    clearActiveGuestCart: (state) => {
      ensureBuckets(state);
      const ch = normalizeChannel(state.activeChannel);
      state.guestCartByChannel[ch] = [];
      state.guestCartTotalByChannel[ch] = 0;
      syncMirror(state);
    },
    // Clear every channel's guest cart (used after login/register merges all channels).
    clearAllGuestCarts: (state) => {
      ensureBuckets(state);
      GUEST_CHANNELS.forEach((ch) => {
        state.guestCartByChannel[ch] = [];
        state.guestCartTotalByChannel[ch] = 0;
      });
      syncMirror(state);
    },
    setSelfPickupMode: (state, action) => {
      state.self_pickup_mode = action.payload.data;
    },
    setDoorStepDeliveryMode: (state, action) => {
      state.doorstep_delivery_mode = action.payload.data;
    },
    // Prescription upload map (medical products). variantId coerced to string so
    // lookups from either variant_id or product_variant_id match consistently.
    setPrescription: (state, action) => {
      const { variantId, file } = action.payload;
      // Guard: persisted state predating this field rehydrates without it.
      if (!state.prescriptions) state.prescriptions = {};
      state.prescriptions[String(variantId)] = file;
    },
    removePrescription: (state, action) => {
      if (!state.prescriptions) return;
      delete state.prescriptions[String(action.payload.variantId)];
    },
    clearPrescriptions: (state) => {
      state.prescriptions = {};
    },
  },
  extraReducers: (builder) => {
    // any logout (manual or 401 interceptor) resets cart back to guest
    builder.addCase(logoutAuth, (state) => {
      state.isGuest = true;
      state.prescriptions = {};
    });
  },
});

export const {
  setCart,
  setCartCheckout,
  setCartPromo,
  clearCartPromo,
  setWallet,
  setCartProducts,
  setCartSubTotal,
  setCartCurrency,
  setCartDecimal,
  setIsGuest,
  setGuestChannel,
  addtoGuestCart,
  setTotalCartValue,
  setGuestCartTotal,
  addGuestCartTotal,
  subGuestCartTotal,
  clearActiveGuestCart,
  clearAllGuestCarts,
  setSelfPickupMode,
  setDoorStepDeliveryMode,
  setPrescription,
  removePrescription,
  clearPrescriptions,
} = cartReducer.actions;
export default cartReducer.reducer;
