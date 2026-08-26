import { combineReducers } from 'redux';
import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import ShopReducer from "@/redux/slices/shopSlice"
import SettingReducer from "@/redux/slices/settingSlice"
import UserReducer from "@/redux/slices/userSlice"
import ProductFilterReducer from "@/redux/slices/productFilterSlice"
import CityReducer from "@/redux/slices/citySlice"
import ThemeReducer from "@/redux/slices/themeSlice"
import CartReducer from "@/redux/slices/cartSlice"
import AddressReducer from "@/redux/slices/addressSlice"
import FavoriteReducer from "@/redux/slices/FavoriteSlice"
import CheckoutReducer from "@/redux/slices/checkoutSlice"
import LanguageReducer from "@/redux/slices/languageSlice"
import ShopModeReducer from "@/redux/slices/shopModeSlice"
import CountrySettingReducer from "@/redux/slices/countrySettingSlice"
import LocationModalReducer from "@/redux/slices/locationModalSlice"

// The root persist config in store.js would otherwise restore showLocation=true
// and reopen the modal on every reload. Persist the location choices only.
const locationModalPersistConfig = {
    key: 'LocationModal',
    storage,
    whitelist: ['selectedCountry', 'selectedZone'],
};

// prescriptions holds File objects (non-serializable) — keep them out of storage
// so redux-persist doesn't rehydrate them as {}. They live in-memory only.
const cartPersistConfig = {
    key: 'Cart',
    storage,
    blacklist: ['prescriptions'],
};

export const rootReducer = combineReducers({
    Cart: persistReducer(cartPersistConfig, CartReducer),
    City: CityReducer,
    Shop: ShopReducer,
    Setting: SettingReducer,
    User: UserReducer,
    ProductFilter: ProductFilterReducer,
    Theme: ThemeReducer,
    Addresses: AddressReducer,
    Favorite: FavoriteReducer,
    Checkout: CheckoutReducer,
    Language: LanguageReducer,
    ShopMode: ShopModeReducer,
    CountrySetting: CountrySettingReducer,
    LocationModal: persistReducer(locationModalPersistConfig, LocationModalReducer),
})

