"use client";
import api from "./axiosMiddleware";
import * as apiEndPoints from "./apiEndpoints";
import { store } from "@/redux/store";
import { t } from "@/utils/translation";

// Authentication API's
export const registerUser = async ({
  name,
  email,
  mobile,
  type,
  fcm,
  country_code,
  country_id,
  password,
  phoneAuthType = false,
  friend_code,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("country_code", country_code);
  if (country_id !== null && country_id !== undefined && country_id !== "") {
    formData.append("country_id", country_id);
  }
  formData.append("type", type);
  formData.append("fcm_token", fcm);
  formData.append("platform", "web");
  if (type == "email" || (type == "phone" && phoneAuthType)) {
    formData.append("password", password);
  }
  if (
    type === "phone" ||
    ((type === "email" || type === "google") && mobile !== null && mobile !== "")
  ) {
    formData.append("mobile", mobile);
  }
  if (type === "email" || type === "google" || (type === "phone" && email)) {
    formData.append("email", email);
  }
  if (friend_code !== null) {
    formData.append("friends_code", friend_code);
  }
  const response = await api.post(apiEndPoints.register, formData);
  return response.data;
};

export const login = async ({
  id,
  fcm,
  type,
  password,
  phoneAuthType,
  country_code,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("id", id);
  formData.append("fcm_token", fcm);
  formData.append("type", type);
  formData.append("platform", "web");
  if (type == "phone") {
    // API requires country_code when type is phone.
    formData.append("country_code", country_code || "");
    formData.append(
      "phone_auth_type",
      phoneAuthType ? "phone_auth_password" : "phone_auth_otp"
    );
  }
  if (type == "email" || (type == "phone" && phoneAuthType)) {
    formData.append("password", password);
  }
  const response = await api.post(apiEndPoints.login, formData);
  return response.data;
};

export const sendSms = async ({ mobile }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("phone", mobile);
  const response = await api.post(apiEndPoints.sendSms, formData);
  return response.data;
};

export const verifyOTP = async ({ mobile, otp, country_code }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("phone", mobile);
  formData.append("otp", otp);
  formData.append("country_code", country_code);
  const response = await api.post(apiEndPoints.verifyContact, formData);
  return response.data;
};

export const verifyEmail = async ({ email, code }: any): Promise<any> => {
  // Body must be FormData: the request interceptor forces
  // Content-Type: multipart/form-data, so a plain object would be sent as a
  // JSON string with no boundary and the backend parser can't read the fields.
  const formData = new FormData();
  formData.append("email", email);
  formData.append("code", code);
  const response = await api.post(apiEndPoints.verifyEmail, formData);
  return response.data;
};

export const forgotPasswordOTP = async ({ email }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("email", email);
  const response = await api.post(apiEndPoints.forgotPasswordOtp, formData);
  return response.data;
};

export const forgotPassword = async ({
  phone,
  otp,
  email,
  password,
  confirmPassword,
  type,
  otpMethod,
}: any): Promise<any> => {
  const formData = new FormData();
  if (
    type == "email" ||
    (type == "phone" && (otpMethod == "twilio" || otpMethod == "firebase"))
  ) {
    // Coerce to "": FormData stringifies whatever it is handed, so appending an
    // undefined otp sent the literal text "undefined" to the backend.
    formData.append("otp", otp ?? "");
  }
  if (type == "email") {
    formData.append("email", email);
  }
  if (type == "phone") {
    formData.append("mobile", phone);
  }
  formData.append("password", password);
  formData.append("password_confirmation", confirmPassword);
  formData.append("type", type);
  if (type == "phone") {
    formData.append("otp_verify_method", otpMethod);
  }
  const response = await api.post(apiEndPoints.forgotPassword, formData);
  return response.data;
};

export const resetPassword = async ({
  password,
  newPassword,
  confirmPassword,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("old_password", password);
  formData.append("new_password", newPassword);
  formData.append("new_password_confirmation", confirmPassword);
  const response = await api.post(apiEndPoints.resetPassword, formData);
  return response.data;
};

export const updateProfile = async ({
  image,
  name,
  email,
  mobileNumber,
  countryCode,
  countryId,
  type,
  latitude,
  longitude,
}: any): Promise<any> => {
  const formData = new FormData();
  if (image) formData.append("profile", image);
  formData.append("name", name);
  formData.append("email", email);
  if (countryId !== null && countryId !== undefined && countryId !== "") {
    formData.append("country_id", countryId);
  }
  if (mobileNumber) {
    formData.append("mobile", mobileNumber);
    if (countryCode) formData.append("country_code", countryCode);
  }
  if (latitude) formData.append("latitude", latitude);
  if (longitude) formData.append("longitude", longitude);
  const response = await api.post(apiEndPoints.editProfile, formData);
  return response.data;
};
export const getUser = async ({ latitude, longitude }: any = {}): Promise<any> => {
  const params: Record<string, any> = {};
  if (latitude) params.latitude = latitude;
  if (longitude) params.longitude = longitude;
  const response = await api.get(apiEndPoints.getUser, { params });
  return response.data;
};
// Send the device's fcm_token so the backend can unregister THIS device from
// push. Without it the server keeps the token registered and the logged-out
// browser still receives notifications for the account. Field names mirror
// login (fcm_token + platform).
export const logout = async ({ fcm }: any = {}): Promise<any> => {
  const formData = new FormData();
  if (fcm) {
    formData.append("fcm_token", fcm);
    formData.append("platform", "web");
  }
  const response = await api.post(`${apiEndPoints.logout}`, formData);
  return response.data;
};
export const deleteUser = async ({ uid = null }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("auth_uid", uid);
  const response = await api.post(apiEndPoints.deleteAccount, formData);
  return response.data;
};

// Location api's
export const getPlaces = async ({ input }: any): Promise<any> => {
  const params = { input: input, source: "web" };

  const response = await api.get(apiEndPoints.getPlaces, { params });
  return response.data;
};

export const getPlacesDetails = async ({ placeId }: any): Promise<any> => {
  const params = { place_id: placeId, source: "web" };
  const response = await api.get(apiEndPoints.getPlacecDetails, { params });
  return response.data;
};

// Backend reverse-geocode (maps_geocoding). Provider-agnostic on the server
// (returns Google-shaped results regardless of the configured map provider).
// Reverse only — needs latitude + longitude.
export const getGeocoding = async ({ latitude, longitude }: any): Promise<any> => {
  const params = { latitude, longitude, source: "web" };
  const response = await api.get(apiEndPoints.getGeocoding, { params });
  return response.data;
};

// General Api's
export const getZone = async ({ latitude, longitude, skipChannel = false }: any): Promise<any> => {
  let params = { latitude: latitude, longitude: longitude };
  // skipChannel: when the call originates from the header location change, the
  // backend must resolve the zone WITHOUT a channel header (mode is decided by
  // the home_layout response, not the current shop channel). Flagged here and
  // honored by the request interceptor in axiosMiddleware.
  const response = await api.get(apiEndPoints.getZone, { params, skipChannel } as any);
  return response.data;
};

// Lists every serviceable zone as {id, name, polygon_boundary[]}. Note the
// backend currently ignores country_id and always returns all zones, and most
// zones come back with an empty polygon_boundary — callers must handle both.
export const getZones = async ({ country_id }: any = {}): Promise<any> => {
  const params = country_id ? { country_id } : {};
  const response = await api.get(apiEndPoints.getZones, { params });
  return response.data;
};

// Regions for a country, used to populate the address form's region_id
// dropdown (billing_region_id reuses the same list).
export const getRegions = async ({ country_id }: any = {}): Promise<any> => {
  const params = country_id ? { country_id } : {};
  const response = await api.get(apiEndPoints.getRegions, { params });
  return response.data;
};

// Countries with their `is_default` flag — the zone picker starts from the
// default country and offers that country's zones. Distinct from getCountries()
// (the shop-by-country listing) and getDialCountries() (phone dial codes),
// which hit the same endpoint for different purposes.
export const getCountriesWithDefault = async (): Promise<any> => {
  const response = await api.get(apiEndPoints.getCountries);
  return response.data;
};

export const getShop = async ({ latitude, longitude }: any): Promise<any> => {
  let params = { latitude: latitude, longitude: longitude };
  const response = await api.get(apiEndPoints.getShop, { params });
  return response.data;
};

// `category_id` is OMITTED when null/empty — the backend then serves the first
// category tab's layout, which is exactly what the UI selects anyway. The old
// "__all__" sentinel asked for a layout no tab corresponds to, so the client had
// to fire a SECOND request once the tab list arrived. Sending nothing gets the
// right content on the first call.
// device is NOT sent — the response already carries every breakpoint's
// values (image_aspect/grid_columns/images as {app,tablet,web} objects per
// block); the client picks one at render time. Sending device here would
// only fragment the cache key across breakpoints for no server-side effect.
export const getHomeLayout = async ({
  latitude,
  longitude,
  category_id = null,
  limit,
  offset,
  device,
}: any): Promise<any> => {
  const params: Record<string, any> = {
    latitude,
    longitude,
  };
  if (category_id != null && category_id !== "") {
    params.category_id = category_id;
  }
  if (limit != null) {
    params.limit = limit;
  }
  if (offset != null) {
    params.offset = offset;
  }
  if (device != null && device !== "") {
    params.device = device;
  }
  const response = await api.get(apiEndPoints.homeLayout, { params });
  return response.data;
};

export const getCategories = async ({
  slug = "",
  id = "",
  limit,
  offset,
  is_own_data,
  latitude,
  longitude,
}: any = {}): Promise<any> => {
  const params = {
    limit,
    offset,
    ...(slug && { slug }),
    ...(id && { id }),
    ...(is_own_data && { is_own_data }),
    // The API requires latitude/longitude for the single-category (slug/id)
    // fetch. Passed through when the caller has a location.
    ...(latitude != null && { latitude }),
    ...(longitude != null && { longitude }),
  };

  const response = await api.get(apiEndPoints.getCategory, { params });
  return response.data;
};

export const getProductByFilter = async ({
  latitude,
  longitude,
  filters = undefined,
  tag_names = "",
  slug = "",
  is_similar_product_id = "",
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  if (tag_names !== "") {
    formData.append("tag_names", tag_names);
  }
  if (slug !== "") {
    formData.append("tag_slug", slug);
  }
  if (is_similar_product_id !== "" && is_similar_product_id != null) {
    formData.append("is_similar_product_id", is_similar_product_id);
  }
  if (filters !== undefined) {
    for (const filter in filters) {
      if (
        (filters[filter] !== null &&
          filters[filter] !== undefined &&
          filters[filter] !== "") ||
        filters[filter]?.length > 0
      ) {
        formData.append(filter, filters[filter]);
      }
      if (filters[filter] === "sizes") {
        formData.append(filter, filters[filter]);
      }
    }
  }
  const response = await api.post(apiEndPoints.getProducts, formData);
  return response.data;
};

// Returns the filter options (brands, price range, attributes/variants)
// available for a given category — used to populate the filter sidebar
// dynamically so only relevant choices show.
export const getProductFilters = async ({
  latitude,
  longitude,
  category_id,
  data_source,
  manual_product_ids,
  source_id,
}: any): Promise<any> => {
  const formData = new FormData();
  if (latitude != null) formData.append("latitude", latitude);
  if (longitude != null) formData.append("longitude", longitude);
  if (category_id != null && category_id !== "") {
    formData.append("category_id", category_id);
  }
  // Home-layout "See All": forward the same source context used to load the
  // product list, so filter options match the displayed products. Always send
  // data_source; "manual" adds the id CSV; "category"/"brand" send source_id
  // under that source's own param name.
  if (data_source != null && data_source !== "") {
    formData.append("data_source", data_source);
    if (
      data_source === "manual" &&
      manual_product_ids != null &&
      manual_product_ids !== ""
    ) {
      formData.append("manual_product_ids", manual_product_ids);
    } else if (source_id != null && source_id !== "") {
      if (data_source === "category") {
        formData.append("category_id", source_id);
      } else if (data_source === "brand") {
        formData.append("brand_ids", source_id);
      }
    }
  }
  const response = await api.post(apiEndPoints.getProductFilters, formData);
  return response.data;
};

export const getBrands = async ({ limit, offset, latitude, longitude }: any): Promise<any> => {
  let params = {
    limit: limit,
    offset: offset,
    latitude: latitude,
    longitude: longitude,
  };
  const response = await api.get(apiEndPoints.getBrands, { params });
  return response.data;
};

export const getSetting = async (): Promise<any> => {
  const params = {
    is_web_setting: 1,
  };
  const response = await api.get(apiEndPoints.getSettings, { params });
  return response.data;
};

export const getCountrySetting = async ({ latitude, longitude }: any = {}): Promise<any> => {
  const params: Record<string, any> = {};
  if (latitude) params.latitude = latitude;
  if (longitude) params.longitude = longitude;
  const response = await api.get(apiEndPoints.getCountrySetting, { params });
  return response.data;
};

export const getDialCountries = async (): Promise<any> => {
  const response = await api.get(apiEndPoints.getCountries);
  return response.data;
};

export const getProductById = async ({ latitude, longitude, slug, id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  if (id !== -1) {
    formData.append("id", id);
  }
  if (slug) {
    formData.append("slug", slug);
  }
  const response = await api.post(apiEndPoints.getProductById, formData);
  return response.data;
};

export const getProductRatings = async ({ id, limit, offset }: any): Promise<any> => {
  const params = {
    product_id: id,
    limit: limit,
    offset: offset,
  };
  const response = await api.get(
    `${apiEndPoints.getProducts}/${apiEndPoints.getProductRatings}`,
    { params }
  );

  return response.data;
};

export const getProductImages = async ({ id, limit, offset }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", id);
  formData.append("limit", limit);
  formData.append("offset", offset);
  const response = await api.post(
    `${apiEndPoints.getProducts}/${apiEndPoints.rating}/${apiEndPoints.imageList}`,
    formData
  );
  return response.data;
};

export const getPaymentSetting = async ({ latitude, longitude }: any = {}): Promise<any> => {
  const response = await api.get(
    `${apiEndPoints.getSettings}/${apiEndPoints.getPaymentMethods}`,
    { params: { latitude, longitude } }
  );
  return response.data;
};

export const getSystemLanguages = async ({ id, isDefault, systemType }: any): Promise<any> => {
  const params = { id: id, is_default: isDefault, system_type: systemType };
  const response = await api.get(apiEndPoints.getSystemLanguage, { params });
  return response.data;
};

export const updateFcmToken = async ({ langaugeId, fcmToken }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("language_id", langaugeId);
  formData.append("fcm_token", fcmToken);
  const response = await api.post(apiEndPoints.updateFcmToken, formData);
  return response.data;
};

// cart apis
export const getCart = async ({
  latitude,
  longitude,
  checkout = 0,
  promocode_id = 0,
  order_type,
  address_id,
}: any): Promise<any> => {
  const params: Record<string, any> = {
    latitude: latitude,
    longitude: longitude,
  };
  if (promocode_id !== 0) {
    params.promocode_id = promocode_id;
  }
  // checkout flag + order_type drive delivery/total calc on the backend. Only
  // the checkout page passes them; forward each ONLY when explicitly provided so
  // ordinary cart fetches (e.g. header) don't send a spurious order_type.
  if (checkout) {
    params.checkout = checkout;
  }
  if (order_type) {
    params.order_type = order_type;
  }
  // Selected delivery address, so delivery charge/tax calc on the backend uses
  // the picked address rather than just raw lat/lng. Only checkout call sites
  // have a selected address to pass.
  if (address_id != null) {
    params.address_id = address_id;
  }
  const response = await api.get(apiEndPoints.getCart, { params });
  return response.data;
};

// Cart cross-sell / upsell recommendations. lat/lng fall back to selected city.
export const getCartRecommendations = async ({
  latitude,
  longitude,
  product_id,
  cross_sell_limit = 10,
  cross_sell_offset = 0,
  upsell_limit = 10,
  upsell_offset = 0,
}: any = {}): Promise<any> => {
  const city = store.getState()?.City?.city;
  const params: Record<string, any> = {
    latitude: latitude ?? city?.latitude,
    longitude: longitude ?? city?.longitude,
    cross_sell_limit,
    cross_sell_offset,
    upsell_limit,
    upsell_offset,
  };
  // Scope recommendations to a specific product (product detail page). The cart
  // checkout call omits it to get cart-wide suggestions.
  if (product_id != null) params.product_id = product_id;
  const response = await api.get(
    `${apiEndPoints.getCart}/${apiEndPoints.cartRecommendations}`,
    { params }
  );
  return response.data;
};

// Merge guest carts at login. Guest carts are per-channel, so this sends BOTH channels'
// items in one call: quick items via quick_*, ecommerce items via ecommerce_*. Pass the
// per-channel id/qty strings; empty channels are simply omitted.
export const addToBulkCart = async ({
  quick_variant_ids,
  quick_quantities,
  ecommerce_variant_ids,
  ecommerce_quantities,
  latitude,
  longitude,
}: any): Promise<any> => {
  const params: Record<string, any> = {};
  if (quick_variant_ids) {
    params.quick_variant_ids = quick_variant_ids;
    params.quick_quantities = quick_quantities;
  }
  if (ecommerce_variant_ids) {
    params.ecommerce_variant_ids = ecommerce_variant_ids;
    params.ecommerce_quantities = ecommerce_quantities;
  }
  if (latitude != null) params.latitude = latitude;
  if (longitude != null) params.longitude = longitude;
  const response = await api.post(
    `${apiEndPoints.getCart}/${apiEndPoints.bulkAddToCart}`,
    null,
    { params }
  );
  return response.data;
};

// `store_closed: 1` from home_layout means the zone/channel is closed: the
// catalogue stays browsable, but nothing may be bought. Enforced here rather than
// in each of the ~8 add-to-cart call sites (four product cards, detail page,
// detail modal, both cart cards) so no path can slip through. The shape matches a
// rejected API response, so every existing caller's `status !== 1` branch already
// surfaces the message as a toast.
const storeClosedResponse = () => ({
  status: 0,
  message: t("store_closed_cannot_order"),
});

const isStoreClosed = () => store.getState()?.ShopMode?.storeClosed === true;

export const addToCart = async ({
  product_id,
  product_variant_id,
  qty,
  latitude,
  longitude,
}: any): Promise<any> => {
  if (isStoreClosed()) return storeClosedResponse();
  const city = store.getState()?.City?.city;
  const lat = latitude ?? city?.latitude;
  const lng = longitude ?? city?.longitude;
  const formData = new FormData();
  formData.append("product_id", product_id);
  formData.append("product_variant_id", product_variant_id);
  formData.append("qty", qty);
  if (lat != null) formData.append("latitude", lat);
  if (lng != null) formData.append("longitude", lng);
  const response = await api.post(
    `${apiEndPoints.getCart}/${apiEndPoints.add}`,
    formData
  );
  return response.data;
};

export const removeFromCart = async ({
  product_id,
  product_variant_id,
  qty,
  isRemoveAll,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", product_id);
  formData.append("product_variant_id", product_variant_id);
  // is_remove_all=1 drops the whole line in one call (used by the card's X button);
  // otherwise decrement by `qty` (default 1 server-side).
  formData.append("is_remove_all", (isRemoveAll ? 1 : 0) as any);
  // Backend decrements by `qty` units per call (e.g. qty=2 drops two). Omit to
  // let the server default to 1.
  if (qty != null) formData.append("qty", qty);
  const response = await api.post(
    `${apiEndPoints.getCart}/${apiEndPoints.remove}`,
    formData
  );
  return response.data;
};

export const deleteCart = async (): Promise<any> => {
  const formData = new FormData();
  formData.append("is_remove_all", 1 as any);
  const response = await api.post(
    `${apiEndPoints.getCart}/${apiEndPoints.remove}`,
    formData
  );
  return response.data;
};

export const getGuestCart = async ({
  latitude,
  longitude,
  variant_ids,
  quantities,
}: any): Promise<any> => {
  const params = {
    latitude: latitude,
    longitude: longitude,
    variant_ids: variant_ids,
    quantities: quantities,
  };
  const response = await api.get(
    `${apiEndPoints.getCart}/${apiEndPoints.getGuestCart}`,
    { params }
  );
  return response.data;
};

// Address Apis
export const getAddress = async (): Promise<any> => {
  const response = await api.get(`${apiEndPoints.getAddress}`);
  return response.data;
};

export const addAddress = async ({
  name,
  mobile,
  country_code = "",
  alternate_country_code = "",
  type,
  address,
  landmark,
  area,
  pincode,
  city,
  state,
  country,
  region_id,
  latitiude,
  longitude,
  is_default = 1,
  alternate_mobile = "",
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("mobile", mobile);
  formData.append("country_code", country_code);
  formData.append("alternate_country_code", alternate_country_code);
  formData.append("type", type);
  formData.append("address", address);
  formData.append("landmark", landmark);
  formData.append("area", area);
  formData.append("pincode", pincode);
  formData.append("city", city);
  formData.append("state", state);
  formData.append("country", country);
  if (region_id != null) formData.append("region_id", region_id);
  formData.append("alternate_mobile", alternate_mobile);
  formData.append("latitude", latitiude);
  formData.append("longitude", longitude);
  formData.append("is_default", (is_default ? 1 : 0) as any);
  const response = await api.post(
    `${apiEndPoints.getAddress}/${apiEndPoints.add}`,
    formData
  );
  return response.data;
};
export const updateAddress = async ({
  id,
  name,
  mobile,
  country_code = "",
  alternate_country_code = "",
  type,
  address,
  landmark,
  area,
  pincode,
  city,
  state,
  country,
  region_id,
  latitiude,
  longitude,
  is_default = 1,
  alternate_mobile = "",
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("id", id);
  formData.append("name", name);
  formData.append("mobile", mobile);
  formData.append("country_code", country_code);
  formData.append("alternate_country_code", alternate_country_code);
  formData.append("type", type);
  formData.append("address", address);
  formData.append("landmark", landmark);
  formData.append("area", area);
  formData.append("pincode", pincode);
  formData.append("city", city);
  formData.append("state", state);
  formData.append("country", country);
  if (region_id != null) formData.append("region_id", region_id);
  formData.append("alternate_mobile", alternate_mobile);
  formData.append("latitude", latitiude);
  formData.append("longitude", longitude);
  formData.append("is_default", (is_default ? 1 : 0) as any);
  const response = await api.post(
    `${apiEndPoints.getAddress}/${apiEndPoints.update}`,
    formData
  );
  return response.data;
};
export const deleteAddress = async ({ id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("id", id);
  const response = await api.post(
    `${apiEndPoints.getAddress}/${apiEndPoints.deleteItem}`,
    formData
  );
  return response.data;
};

// wishlists api
export const getFavorite = async ({ latitude, longitude, limit, offset }: any): Promise<any> => {
  const params = {
    latitude: latitude,
    longitude: longitude,
    limit: limit,
    offset: offset,
  };
  const response = await api.get(apiEndPoints.getFavorite, { params });
  return response.data;
};
export const addToFavorite = async ({ product_id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", product_id);
  const response = await api.post(
    `${apiEndPoints.getFavorite}/${apiEndPoints.add}`,
    formData
  );
  return response.data;
};
export const removeFromFavorite = async ({ product_id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", product_id);
  const response = await api.post(
    `${apiEndPoints.getFavorite}/${apiEndPoints.remove}`,
    formData
  );
  return response.data;
};

// promocode api
export const getPromo = async ({ amount = 0, latitude, longitude }: any): Promise<any> => {
  const params: Record<string, any> = { amount: amount };
  if (latitude != null) params.latitude = latitude;
  if (longitude != null) params.longitude = longitude;
  const response = await api.get(`${apiEndPoints.getPromoCode}`, { params });
  return response.data;
};
export const setPromoCode = async ({ promoCodeName, amount = 0, latitude, longitude }: any): Promise<any> => {
  const params: Record<string, any> = { promo_code: promoCodeName, total: amount };
  if (latitude != null) params.latitude = latitude;
  if (longitude != null) params.longitude = longitude;
  const response = await api.post(
    `${apiEndPoints.getPromoCode}/${apiEndPoints.setPromoCode}`,
    {},
    { params }
  );
  return response.data;
};

// Checkout api
export const placeOrder = async ({
  productVariantId,
  quantity,
  total,
  deliveryCharge,
  finalTotal,
  paymentMethod,
  addressId,
  walletBalance,
  walletUsed,
  orderNote,
  promocodeId = 0,
  status,
  order_type = "doorstep",
  prescriptions = null,
  billingSameAsShipping = true,
  billingName = "",
  billingMobile = "",
  billingCountryCode = "",
  billingAddress = "",
  billingCity = "",
  billingState = "",
  billingPincode = "",
  billingCountry = "",
  billingRegionId,
}: any): Promise<any> => {
  if (isStoreClosed()) return storeClosedResponse();
  let finalPaymentMethod = paymentMethod;
  if (paymentMethod == "wallet") {
    finalPaymentMethod = "Wallet";
  }
  const formData = new FormData();
  formData.append("product_variant_id", productVariantId);
  formData.append("quantity", quantity);
  formData.append("total", total);
  formData.append("delivery_charge", deliveryCharge);
  formData.append("final_total", finalTotal);
  formData.append("payment_method", finalPaymentMethod);
  formData.append("address_id", addressId);
  formData.append("status", status);
  formData.append("order_type", order_type);
  if (walletUsed) {
    formData.append("wallet_used", 1 as any);
    formData.append("wallet_balance", walletBalance);
  }
  if (orderNote !== "" && orderNote !== null && orderNote !== undefined) {
    formData.append("order_note", orderNote);
  }
  if (promocodeId !== 0) {
    formData.append("promocode_id", promocodeId);
  }
  formData.append("billing_same_as_shipping", (billingSameAsShipping ? 1 : 0) as any);
  if (!billingSameAsShipping) {
    formData.append("billing_name", billingName);
    formData.append("billing_mobile", billingMobile);
    formData.append("billing_country_code", billingCountryCode);
    formData.append("billing_address", billingAddress);
    formData.append("billing_city", billingCity);
    formData.append("billing_state", billingState);
    formData.append("billing_pincode", billingPincode);
    formData.append("billing_country", billingCountry);
    if (billingRegionId != null) formData.append("billing_region_id", billingRegionId);
  }
  // Prescription files for medical items: prescription[<variant_id>]=<File>.
  if (prescriptions && typeof prescriptions === "object") {
    Object.entries(prescriptions).forEach(([vid, file]) => {
      if (file instanceof File) {
        formData.append(`prescription[${vid}]`, file);
      }
    });
  }
  const response = await api.post(`${apiEndPoints.placeOrder}`, formData);
  return response.data;
};
export const initiateTrasaction = async ({
  orderId,
  paymentMethod,
  type,
  walletAmount = 0,
  subscriptionPlanId = 0,
  latitude,
  longitude,
}: any): Promise<any> => {
  const formData = new FormData();
  if (orderId) {
    formData.append("order_id", orderId);
  }
  formData.append("payment_method", paymentMethod);
  formData.append("type", type);
  formData.append("request_from", "website");
  // Wallet recharge (and other flows) require a location on the backend. Fall
  // back to the active city's coordinates from the store when not passed in.
  const city = store.getState()?.City?.city;
  const lat = latitude ?? city?.latitude;
  const lng = longitude ?? city?.longitude;
  if (lat != null) formData.append("latitude", lat);
  if (lng != null) formData.append("longitude", lng);
  if (type == "wallet" && walletAmount != 0) {
    formData.append("wallet_amount", walletAmount);
  }
  if (type == "subscription") {
    formData.append("subscription_plan_id", subscriptionPlanId);
  }
  const response = await api.post(
    `${apiEndPoints.initiateTrasaction}`,
    formData
  );
  return response.data;
};
export const addTransaction = async ({
  orderId,
  transactionId,
  paymentMethod,
  type,
  subscriptionPlanId = 0,
  walletAmount = 0,
  latitude,
  longitude,
}: any): Promise<any> => {
  const formData = new FormData();
  if (orderId) {
    formData.append("order_id", orderId);
  }
  if (walletAmount != 0 && type == "wallet") {
    formData.append("wallet_amount", walletAmount);
  }
  // Backend requires geo coords for wallet top-ups (type=wallet).
  if (latitude !== undefined && latitude !== null && latitude !== "") {
    formData.append("latitude", latitude);
  }
  if (longitude !== undefined && longitude !== null && longitude !== "") {
    formData.append("longitude", longitude);
  }
  if (type == "subscription") {
    formData.append(
      "subscription_plan_id",
      subscriptionPlanId
    )
  }
  formData.append("transaction_id", transactionId);
  formData.append("type", type);
  formData.append("payment_method", paymentMethod);
  formData.append("request_from", "website");
  formData.append("device_type", "web");
  formData.append("app_version", "1.0");
  const response = await api.post(`${apiEndPoints.addTransaction}`, formData);
  return response.data;
};
export const deleteOrder = async ({ orderId }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_id", orderId);
  const response = await api.post(`${apiEndPoints.deleteOrder}`, formData);
  return response.data;
};

// Fetch Notifications
export const getNotifications = async ({ limit = 7, offset = 0 }: any): Promise<any> => {
  const params = { limit, offset };
  const response = await api.get(`${apiEndPoints.getNotification}`, { params });
  return response.data;
};

export const getFAQs = async ({ limit = 7, offset = 0 }: any): Promise<any> => {
  const params = { limit, offset };
  const response = await api.get(`${apiEndPoints.getFaq}`, { params });
  return response.data;
};

export const getOrders = async ({
  limit,
  offset,
  orderId,
  type,
  orderType,
  channel,
  startDate,
  endDate,
}: any): Promise<any> => {
  const params: Record<string, any> = { limit: limit, offset: offset, type: type };
  if (orderId) {
    params.order_id = orderId;
  }
  if (orderType != "") {
    params.order_type = orderType;
  }
  if (channel) {
    params.channel = channel;
  }
  if (startDate) {
    params.start_date = startDate;
  }
  if (endDate) {
    params.end_date = endDate;
  }
  const response = await api.get(`${apiEndPoints.getOrders}`, { params });
  return response.data;
};

// ─── E-commerce orders (separate flow from Quick Orders above) ───────────────
// The ecom_orders endpoint returns FLAT per-order-item rows. Each row's `id`
// is its order_item_id. Detail uses the SAME endpoint with order_item_id, which
// returns a single matching row (total:1). Kept fully separate from getOrders so
// the Quick Order flow is never touched.
export const getEcomOrders = async ({
  limit,
  offset,
  type,
  orderType,
  startDate,
  endDate,
}: any): Promise<any> => {
  const params: Record<string, any> = { limit, offset, type };
  if (orderType != null && orderType !== "") {
    params.order_type = orderType;
  }
  if (startDate) {
    params.start_date = startDate;
  }
  if (endDate) {
    params.end_date = endDate;
  }
  const response = await api.get(`${apiEndPoints.ecomOrders}`, { params });
  return response.data;
};

export const getEcomOrderDetail = async ({ orderItemId }: any): Promise<any> => {
  const params = { order_item_id: orderItemId };
  const response = await api.get(`${apiEndPoints.ecomOrders}`, { params });
  return response.data;
};

export const changeOrderStatus = async ({
  orderId,
  orderItemId,
  status,
  reason,
  returnReason,
  addressId,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_id", orderId);
  formData.append("order_item_id", orderItemId);
  formData.append("status", status);
  // Field is "cancellation_reason", NOT "reason". The backend silently ignores a
  // "reason" field — the cancel succeeds but persists cancellation_reason as
  // null, so the order detail shows no reason. Verified against the live API.
  if (reason) {
    formData.append("cancellation_reason", reason);
  }
  if (returnReason) {
    formData.append("return_reason", returnReason);
  }
  // Pickup address for the return (selected in the return modal, same as the
  // checkout delivery-address flow).
  if (addressId) {
    formData.append("address_id", addressId);
  }
  const response = await api.post(
    `${apiEndPoints.updateOrderStatus}`,
    formData
  );
  return response.data;
};

export const reviewProduct = async ({ productId, rating, review, images }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", productId);
  formData.append("rate", rating);
  formData.append("review", review);
  for (let i = 0; i < images?.length; i++) {
    formData.append(`image[${i}]`, images[i]);
  }
  const response = await api.post(
    `${apiEndPoints.getProducts}/${apiEndPoints.rating}/${apiEndPoints.add}`,
    formData
  );
  return response.data;
};

export const getProductRating = async ({ ratingId }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("id", ratingId);
  const response = await api.post(
    `${apiEndPoints.getProducts}/${apiEndPoints.rating}/${apiEndPoints.edit}`,
    formData
  );
  return response.data;
};

export const updateReviewProduct = async ({
  ratingId,
  rating,
  review,
  deleteImages,
  images,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("id", ratingId);
  formData.append("rate", rating);
  formData.append("review", review);
  formData.append("deleteImageIds", `[${deleteImages}]`);
  for (let i = 0; i < images?.length; i++) {
    formData.append(`image[${i}]`, images[i]);
  }
  const response = await api.post(
    `${apiEndPoints.getProducts}/${apiEndPoints.rating}/${apiEndPoints.update}`,
    formData
  );
  return response.data;
};

export const downloadInvoice = async ({ orderId }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_id", orderId);
  const response = await api.post(`${apiEndPoints.getInvoice}`, formData, {
    responseType: "blob",
  });
  return response;
};

// Per-item invoice (ecom orders where each order_item is fulfilled separately).
export const downloadItemInvoice = async ({ orderItemId }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_item_id", orderItemId);
  const response = await api.post(`${apiEndPoints.getItemInvoice}`, formData, {
    responseType: "blob",
  });
  return response;
};

export const getUserTransactions = async ({ limit, offset, type }: any): Promise<any> => {
  const params = { limit: limit, offset: offset, type: type };
  const response = await api.get(`${apiEndPoints.getTransactions}`, { params });
  return response.data;
};

export const liveOrderTracking = async ({ orderId }: any): Promise<any> => {
  const params = {
    order_id: orderId,
  };
  const response = await api.get(`${apiEndPoints.liveTracking}`, { params });
  return response.data;
};

export const getSellers = async ({ limit, offset, latitude, longitude }: any): Promise<any> => {
  const params = {
    limit,
    offset,
    latitude,
    longitude,
  };
  const response = await api.get(`${apiEndPoints.getShopBySellers}`, {
    params,
  });
  return response.data;
};

export const getCountries = async ({ limit, offset, latitude, longitude }: any): Promise<any> => {
  const params = {
    limit,
    offset,
    latitude,
    longitude,
  };
  const response = await api.get(`${apiEndPoints.getShopByCountries}`, {
    params,
  });
  return response.data;
};

export const verifyUserByPhoneNum = async ({ mobile, countryCode, type }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("mobile", mobile);
  formData.append("country_code", countryCode);
  formData.append("type", type);
  const response = await api.post(
    `${apiEndPoints.verifyUserByPhoneNum}`,
    formData
  );
  return response.data;
};

export const getOrderStatusPhonepe = async ({ token, transaction_id }: any): Promise<any> => {
  const params = {
    token: token,
    transaction_id: transaction_id,
  };

  const response = await api.get(apiEndPoints.orderStatusPhonepe, { params });
  return response.data;
};

// Blogs section API's
export const getBlogsCategories = async ({
  offset = 0,
  limit = 10,
  search = "",
}: any): Promise<any> => {
  const params = {
    limit,
    offset,
    ...(search != "" ? { search } : {}),
  };

  const response = await api.get(apiEndPoints.blogCategories, { params });
  return response.data;
};

export const getBlogs = async ({
  offset,
  limit,
  slug,
  categoryId = null,
  tag_id = null,
}: any): Promise<any> => {
  const params = {
    limit,
    offset,
    slug,
    ...(categoryId !== null ? { category_id: categoryId } : null),
    ...(tag_id !== null ? { tag_id: tag_id } : null),
  };
  const response = await api.get(apiEndPoints.blogs, { params });
  return response.data;
};

export const setBlogCount = async ({ blogId }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("blog_id", blogId);
  const response = await api.post(apiEndPoints.blogViewCount, formData);
  return response.data;
};

export const getMostViewedBlogs = async ({ limit = 5 }: any): Promise<any> => {
  const response = await api.get(
    `${apiEndPoints.blogs}/${apiEndPoints.mostViewedBlogs}`
  );
  return response.data;
};

export const getTags = async (): Promise<any> => {
  const response = await api.get(`${apiEndPoints.blogTags}`);
  return response.data;
};

export const addRecentlyViewedProduct = async ({ productId, latitude, longitude }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("product_id", productId);
  if (latitude != null) formData.append("latitude", latitude);
  if (longitude != null) formData.append("longitude", longitude);
  const response = await api.post(
    `${apiEndPoints.getProducts}/${apiEndPoints.addRecentlyViewedProduct}`,
    formData
  );
  return response.data;
};

export const getRecentlyViewedProducts = async ({ productId, latitude, longitude }: any): Promise<any> => {
  const params = {
    product_id: productId,
    ...(latitude != null && { latitude }),
    ...(longitude != null && { longitude }),
  };
  const response = await api.get(
    `${apiEndPoints.getProducts}/${apiEndPoints.recentlyVisited}`,
    { params }
  );
  return response.data;
};

export const getSubscriptionPlans = async (): Promise<any> => {
  const response = await api.get(`${apiEndPoints.subscriptionPlans}`);
  return response.data;
};

export const getUserActivePlan = async (): Promise<any> => {
  const response = await api.get(`${apiEndPoints.userActivePlan}`);
  return response.data;
};

export const getSubscriptionFaqs = async ({ offset, limit }: any): Promise<any> => {
  const params = {
    offset,
    limit,
  };
  const response = await api.get(`${apiEndPoints.subscriptionFaqs}`, { params });
  return response.data;
};

// ── Notification preferences ────────────────────────────────────────────────
// GET → the per-event notification matrix. Each entry carries its own set of
// supported channels, so the UI renders toggles from the response rather than
// assuming a fixed mail/push/sms triple (e.g. chat_message is push-only).
export const getNotificationPreferences = async (): Promise<any> => {
  const response = await api.get(apiEndPoints.notificationPreferences);
  return response.data;
};

// POST → save. This endpoint takes a JSON body, unlike the FormData-based
// endpoints elsewhere in this file, so the multipart Content-Type that the
// request interceptor sets by default has to be overridden here.
export const updateNotificationPreferences = async ({ preferences }: any): Promise<any> => {
  const response = await api.post(
    apiEndPoints.notificationPreferences,
    { preferences },
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
};

// ── Customer chat (support + delivery) ──────────────────────────────────────
// POST /chat/start_admin → creates or returns the admin-support conversation.
export const startAdminChat = async (): Promise<any> => {
  const response = await api.post(apiEndPoints.chatStartAdmin);
  return response.data;
};

// POST /chat/start_order → creates or returns the delivery-boy conversation
// for a given order. Ecom orders also pass order_item_id (the conversation is
// scoped to the specific item line).
export const startOrderChat = async ({ order_id, order_item_id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_id", order_id);
  if (order_item_id != null && order_item_id !== "") {
    formData.append("order_item_id", order_item_id);
  }
  const response = await api.post(apiEndPoints.chatStartOrder, formData);
  return response.data;
};

// POST /chat/start_order_admin → order-level admin/store conversation. Unlike
// the delivery-boy chat this is available for ANY order in ANY status.
export const startOrderAdminChat = async ({ order_id }: any): Promise<any> => {
  const formData = new FormData();
  formData.append("order_id", order_id);
  const response = await api.post(apiEndPoints.chatStartOrderAdmin, formData);
  return response.data;
};

// GET /chat/messages?conversation_id={id} → conversation + its messages.
export const getChatMessages = async ({ conversation_id }: any): Promise<any> => {
  const response = await api.get(apiEndPoints.chatMessages, {
    params: { conversation_id },
  });
  return response.data;
};

// POST /chat/send → send a message (text and/or attachments). Each media kind
// has its own FormData field: images[], audios[], videos[]; anything else
// (pdf, docs…) goes in files[]. Every value is an array of File objects.
export const sendChatMessage = async ({
  conversation_id,
  message,
  images,
  audios,
  videos,
  files,
  latitude,
  longitude,
}: any): Promise<any> => {
  const formData = new FormData();
  formData.append("conversation_id", conversation_id);
  if (message) formData.append("message", message);
  if (latitude != null) formData.append("latitude", latitude);
  if (longitude != null) formData.append("longitude", longitude);
  const appendAll = (field, list) =>
    (list || []).forEach((file) => file && formData.append(field, file));
  appendAll("images[]", images);
  appendAll("audios[]", audios);
  appendAll("videos[]", videos);
  appendAll("files[]", files);
  const response = await api.post(apiEndPoints.chatSend, formData);
  return response.data;
};