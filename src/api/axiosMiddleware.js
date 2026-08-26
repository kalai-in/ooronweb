import axios from "axios";
import { store } from "@/redux/store";
import { logoutAuth, setJWTToken, setCurrentUser } from "@/redux/slices/userSlice";
import { clearCartPromo, setCart, setCartProducts, setCartSubTotal, setIsGuest } from "@/redux/slices/cartSlice";
import { isUserDeactivated } from "@/utils/isUserDeactivated";
import { parseZonePath } from "@/utils/zoneUrl";

const access_key = "903361";

const url = process.env.NEXT_PUBLIC_API_URL;
const subUrl = process.env.NEXT_PUBLIC_API_SUBURL;
const api = axios.create({
  baseURL: `${url}${subUrl}/`,
});

const getStoredToken = async () => {
  const state = store.getState();
  return state?.User?.jwtToken;
};

const getStoredLanguage = async () => {
  const state = store.getState();
  return state?.Language?.selectedLanguage;
};

const getStoredChannel = async () => {
  const state = store.getState();
  const mode = state?.ShopMode?.mode;
  // Backend wants "quick"/"ecommerce"; shop mode uses "quick"/"allShop".
  return mode === "allShop" ? "ecommerce" : mode;
};

// Shared identity headers, exported for non-axios callers (e.g. pusher auth in
// chatWs). includeChannel:false skips the shop channel header.
export const buildApiHeaders = ({ includeChannel = true } = {}) => {
  const state = store.getState();
  const headers = { "x-access-key": access_key };
  const token = state?.User?.jwtToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  const lang = state?.Language?.selectedLanguage?.code;
  if (lang) headers["Content-Language"] = lang;
  if (includeChannel) {
    const mode = state?.ShopMode?.mode;
    const channel = mode === "allShop" ? "ecommerce" : mode;
    if (channel) headers.channel = channel;
  }
  return headers;
};

// TEMPORARY duplicate-API debug logger (NEXT_PUBLIC_DEBUG_API="true").
// Flags same URL+params firing within 1500ms as DUPLICATE.
// REMOVE this block (and .__debugStart below) once investigation is done.
const __debugApi = process.env.NEXT_PUBLIC_DEBUG_API === "true";
const __recentCalls = new Map(); // key -> last timestamp
const __DUP_WINDOW_MS = 1500;

const __callerComponent = () => {
  // First app component frame in the stack, skipping axios/this file.
  const lines = (new Error("stack-capture").stack || "").split("\n").slice(1);
  for (const line of lines) {
    if (/axiosMiddleware|node_modules|apiRoutes/.test(line)) continue;
    const m = /\/src\/(.+?\.jsx?)/.exec(line) || /at (\w+)/.exec(line);
    if (m) return m[1];
  }
  return "unknown";
};

const __reasonHint = () => {
  const stack = new Error("stack-capture").stack || "";
  if (/useEffect|commitHook|invokePassiveEffect/.test(stack)) return "useEffect";
  if (/routeChange|changeState|Router/.test(stack)) return "route-change";
  if (/dispatch|redux/.test(stack)) return "redux-dispatch";
  if (/onClick|handle/.test(stack)) return "user-event";
  return "render/other";
};

const __logApiCall = (config) => {
  if (!__debugApi || typeof window === "undefined") return;
  const key = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
  const now = performance.now();
  const prev = __recentCalls.get(key);
  const isDup = prev != null && now - prev < __DUP_WINDOW_MS;
  __recentCalls.set(key, now);
  config.__debugStart = now;

  const row = {
    "API Name": config.url,
    Component: __callerComponent(),
    "Trigger Reason": __reasonHint(),
    Timestamp: new Date().toISOString(),
  };
  if (isDup) {
    console.warn(
      `🔁 DUPLICATE API (within ${Math.round(now - prev)}ms) →`,
      config.url,
    );
  }
  console.table([row]);
};

api.interceptors.request.use(
  async (config) => {
    try {
      __logApiCall(config);
      const authToken = await getStoredToken();
      const language = await getStoredLanguage();
      const channel = await getStoredChannel();
      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      config.headers["Content-Type"] = "multipart/form-data";
      config.headers["x-access-key"] = access_key;
      config.headers["Content-Language"] = language?.code;
      // skipChannel: header-driven location change resolves zone without a channel.
      if (channel && !config.skipChannel) {
        config.headers["channel"] = channel;
      }
      return config;
    } catch (error) {
      console.error("Error in token retrival", error);
      throw error;
    }
  },
  (error) => {
    console.error("Error in inceptor", error);
    throw error;
  }
);

// Wipes the persisted session — used by the 401 and deactivated-account handlers.
const clearSession = () => {
  store.dispatch(logoutAuth());
  store.dispatch(setJWTToken({ data: "" }));
  store.dispatch(setCurrentUser({ data: null }));
  store.dispatch(setIsGuest({ data: true }));
  store.dispatch(setCart({ data: [] }));
  store.dispatch(setCartProducts({ data: [] }));
  store.dispatch(setCartSubTotal({ data: 0 }));
  store.dispatch(clearCartPromo());
};

// Handles a session that's gone invalid mid-use — admin deactivation
// (status:1 + USER_DEACTIVATED, never reaches the error branch) or the
// revoked token that follows (bare 401). Logs out globally and reloads.
// Login-TIME deactivation is handled by the Login modal itself, not here.
// Idempotent: several requests may be in flight; first 401 wins.
let sessionTeardownStarted = false;
const handleDeadSession = () => {
  // Skip if there's no session to tear down, or if this is a login-attempt
  // deactivation (no token yet) — that belongs to the Login modal.
  if (!store.getState()?.User?.jwtToken) return;
  if (sessionTeardownStarted) return;
  sessionTeardownStarted = true;
  clearSession();
  if (typeof window !== "undefined") {
    // Full reload to a clean logged-out page, keeping the zone prefix.
    const { zone } = parseZonePath(window.location.pathname);
    window.location.href = zone ? `/${zone}` : "/";
  }
};

api.interceptors.response.use(
  (response) => {
    try {
      if (isUserDeactivated(response?.data)) {
        handleDeadSession();
      }
      return response;
    } catch (error) {
      console.error("Error while fetching data", error);
      throw error;
    }
  },
  (error) => {
    const status = error?.response?.status;
    // A revoked token (what a deactivated account gets on its next call) comes
    // back as a bare 401 with no USER_DEACTIVATED marker — tear the session
    // down anyway. Some deployments return the deactivation as 403.
    if (status === 401 || isUserDeactivated(error?.response?.data)) {
      handleDeadSession();
    }
    // 401 is expected/handled here; console.error would surface it as an
    // unhandled Runtime AxiosError in the Next.js dev overlay.
    if (status !== 401) {
      console.error("Error while fetching data", error);
    }
    throw error;
  }
);

export default api;
