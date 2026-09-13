import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LayoutTheme {
    background_color: any;
    background_theme: any;
    background_image_url: any;
    text_color: any;
    header_icon_url: any;
}

interface ShopModeState {
    mode: string;
    layoutMode: string | null;
    availableModes: string | null;
    requested: string;
    zoneId: any | null;
    zoneSlug: any | null;
    quickLabel: any | null;
    ecommerceLabel: any | null;
    defaultApplied: boolean;
    layoutTheme: LayoutTheme | null;
    searchSuggestions: any[];
    deliveryTime: any | null;
    deliveryDistance: any | null;
    storeClosed: boolean;
    selectedCategoryId: any | null;
}

const initialState: ShopModeState = {
    mode: "quick", // "quick" | "allShop" — current active channel
    layoutMode: null, // "both" | "quick" | "allShop" — from home_layout `channel.layout_mode` (picks/forces default channel)
    availableModes: null, // "both" | "quick" | "allShop" — from home_layout `available_modes` (gates toggle visibility)
    requested: "quick", // default channel requested by backend
    zoneId: null,
    zoneSlug: null, // zone's URL slug — from home_layout `zone_slug`. Changes with the
    // channel where a city has separate quick/ecommerce zones (Bhuj), stays put where it
    // doesn't (Ahmedabad). Drives the zone segment in the URL on mode switch.
    quickLabel: null, // toggle label for quick channel — from home_layout `channel_label_quick`
    ecommerceLabel: null, // toggle label for ecommerce channel — from home_layout `channel_label_ecommerce`
    defaultApplied: false, // true once the backend-requested default has been set; persists across remounts
    layoutTheme: null, // background_color/theme/image/text_color/header_icon_url from home_layout API
    // Product names from home_layout `search_suggestions`, cycled through the
    // search box placeholder. Zone- and channel-specific, so they change with
    // the location/mode just like the rest of the home_layout payload.
    searchSuggestions: [],
    deliveryTime: null, // ready-made label from home_layout `time_to_deliver` (e.g. "22 mins")
    deliveryDistance: null, // ready-made label from home_layout `distance` (e.g. "5.99 km")
    // home_layout `store_closed` (1 = closed). Distinct from the status:0 response
    // that replaces the whole page with <StoreClosed>: here the catalogue still
    // renders and stays browsable, only the buy path is blocked (add to cart,
    // place order). Zone- and channel-specific, so it is refreshed alongside the
    // rest of the payload on every mode/city change.
    storeClosed: false,
    // Category tab the user picked on the home page. Persisted (the whole store
    // is) so a refresh keeps the tab open instead of snapping back to the first
    // one — the shop mode already survived a refresh, and the tab reading
    // differently was jarring.
    //
    // null = no explicit pick: the home_layout request omits category_id and the
    // backend answers with its first tab. Cleared on every mode switch, since a
    // tab id from one channel means nothing in the other.
    selectedCategoryId: null,
};

export const shopModeReducer = createSlice({
    name: "shopMode",
    initialState,
    reducers: {
        setShopMode: (state, action: PayloadAction<{ mode: string }>) => {
            const next = action.payload.mode;
            // Each channel has its own tab list, so carrying the previous
            // channel's tab id across would request a category that does not
            // exist there. Cleared here rather than in the component so it can
            // never be missed by a caller.
            if (next !== state.mode) {
                state.selectedCategoryId = null;
            }
            state.mode = next;
        },
        setSelectedCategoryId: (state, action: PayloadAction<any>) => {
            state.selectedCategoryId = action.payload ?? null;
        },
        // Store channel config returned by the home_layout API
        setChannel: (state, action: PayloadAction<{
            layout_mode?: string;
            available_modes?: string;
            requested?: string;
            zone_id?: any;
            zone_slug?: any;
            search_suggestions?: any[];
            channel_label_quick?: any;
            channel_label_ecommerce?: any;
        } | undefined>) => {
            const { layout_mode, available_modes, requested, zone_id, zone_slug, search_suggestions, channel_label_quick, channel_label_ecommerce } = action.payload || {};
            // API speaks "ecommerce" for the all-shop channel; the UI uses "allShop".
            // Normalize on the way in so every consumer (toggle, force-default effect,
            // transforms) compares against the internal vocab. "both" passes through.
            const norm = (v?: string | null) => (v === "ecommerce" ? "allShop" : v);
            const nextLayoutMode = norm(layout_mode) ?? null;
            // Reset defaultApplied when the layout changes so the new default gets applied
            // once. Compare normalized vs normalized — raw "ecommerce" vs stored "allShop"
            // would never match and would re-seed (snap back) on every refetch.
            if (nextLayoutMode !== state.layoutMode) {
                state.defaultApplied = false;
            }
            state.layoutMode = nextLayoutMode;
            state.availableModes = norm(available_modes) ?? null;
            state.requested = norm(requested) ?? "quick";
            state.zoneId = zone_id ?? null;
            state.zoneSlug = zone_slug ?? null;
            state.searchSuggestions = Array.isArray(search_suggestions)
              ? search_suggestions.filter(Boolean)
              : [];
            state.quickLabel = channel_label_quick ?? null;
            state.ecommerceLabel = channel_label_ecommerce ?? null;
        },
        setDefaultApplied: (state) => {
            state.defaultApplied = true;
        },
        setLayoutTheme: (state, action: PayloadAction<Partial<LayoutTheme> | undefined>) => {
            const { background_color, background_theme, background_image_url, text_color, header_icon_url } = action.payload || {};
            state.layoutTheme = { background_color, background_theme, background_image_url, text_color, header_icon_url };
        },
        setDeliveryTime: (state, action: PayloadAction<any>) => {
            state.deliveryTime = action.payload ?? null;
        },
        setDeliveryDistance: (state, action: PayloadAction<any>) => {
            state.deliveryDistance = action.payload ?? null;
        },
        setStoreClosed: (state, action: PayloadAction<any>) => {
            state.storeClosed = Number(action.payload) === 1;
        },
    },
});

export const { setShopMode, setChannel, setDefaultApplied, setLayoutTheme, setDeliveryTime, setDeliveryDistance, setStoreClosed, setSelectedCategoryId } = shopModeReducer.actions;
export default shopModeReducer.reducer;
