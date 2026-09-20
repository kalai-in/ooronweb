import { store } from "@/redux/store";
import { t } from "@/utils/translation";
import {
  logoutAuth,
  setJWTToken,
  setCurrentUser,
  setAuthType,
} from "@/redux/slices/userSlice";
import {
  clearCartPromo,
  setCart,
  setCartProducts,
  setCartSubTotal,
  setIsGuest,
} from "@/redux/slices/cartSlice";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import {
  isUserDeactivated,
  isDeactivatedUser,
} from "@/utils/isUserDeactivated";

// The detectors live in a store-free module so axiosMiddleware can use them
// without a circular import; re-exported here so UI code has a single entry point.
export { isUserDeactivated, isDeactivatedUser };

// Message shown for a deactivated account. Prefers the translated key so the copy
// stays localized, and falls back to the server's own text if the key is missing.
export const deactivatedMessage = (res?: { message?: string } | null): string => {
  const translated = t("user_deactivated");
  if (translated && translated !== "user_deactivated") return translated;
  return res?.message || "Your account has been deactivated.";
};

// Wipes every trace of the session from the store. Mirrors LogoutModal's
// clearLocalSession, minus the navigation — callers decide where to send the user.
export const clearLocalSession = (): void => {
  store.dispatch(clearAllFilter());
  store.dispatch(logoutAuth());
  store.dispatch(setJWTToken({ data: "" }));
  store.dispatch(setCurrentUser({ data: null }));
  store.dispatch(setAuthType({ data: "" }));
  store.dispatch(setCart({ data: [] }));
  store.dispatch(setCartProducts({ data: [] }));
  store.dispatch(setCartSubTotal({ data: 0 }));
  store.dispatch(clearCartPromo());
  store.dispatch(setIsGuest({ data: true }));
};
