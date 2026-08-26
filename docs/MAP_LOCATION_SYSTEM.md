# Map & Location System — Architecture Docs

Complete flow of maps and location-picking in this project.

---

## 1. Two map providers, one switch

The app supports **Google Maps** AND **OpenStreetMap (OSM/Leaflet)**. Which one renders is decided by a **backend setting**, not by code.

- Setting field: `state.Setting.setting.map_provider` (or nested `web_settings.map_provider`)
- Values: `"google"` or `"osm"`
- Default when missing: `"google"` (`DEFAULT_MAP_PROVIDER`)

Switching provider = change the API setting. No redeploy, no code change.

### Key files

| File | Role |
|------|------|
| `src/components/maps/types.js` | Enum `MAP_PROVIDERS` (`google`/`osm`), `isSupportedProvider()`, `DEFAULT_MAP_PROVIDER` |
| `src/hooks/useMapProvider.js` | Reads provider from Redux `state.Setting.setting`. Returns `{ provider, rawProvider, isLoading, isSupported }` |
| `src/components/maps/MapWrapper.jsx` | **Entry point.** Picks Google or OSM at runtime. Validates coords, shows loader/error |
| `src/components/maps/GoogleMapComponent.jsx` | Google impl of common map interface |
| `src/components/maps/OpenStreetMapComponent.jsx` | OSM/Leaflet impl of same interface |
| `src/components/maps/MapLoader.jsx` | Shared loading spinner |
| `src/components/maps/MapError.jsx` | Shared error fallback UI |
| `src/components/maps/index.js` | Barrel export |

### MapWrapper decision flow

```
<MapWrapper latitude lng ... />
        │
        ├─ provider prop given?  ── yes ─► use it (override, for tests)
        │                           no
        ├─ useMapProvider()  ─► reads state.Setting.setting.map_provider
        │
        ├─ settings still loading? ─► <MapLoader/>
        ├─ coords invalid?         ─► <MapError "coordinates unavailable"/>
        ├─ provider unsupported?   ─► <MapError "map unavailable"/>
        │
        ├─ provider === "google"   ─► <GoogleMapComponent .../>
        └─ provider === "osm"      ─► <OpenStreetMapComponent .../>
```

Both impls loaded via `next/dynamic({ ssr: false })` — Google loader + Leaflet both touch `window`, must not run on server.

### Common map props (shared interface)

`MapComponentProps` (see `types.js`):
`latitude, longitude, zoom, markers[], showCenterMarker, height, className, draggableMarker, onMarkerDragEnd, onMapClick, onReady`

---

## 2. Config & environment

### `src/utils/mapConfig.js`
```js
export const MAP_CONFIG = {
  id: "google-map-script",
  googleMapsApiKey: process.env.NEXT_PUBLIC_MAP_API,
  libraries: ["places"],
};
```

### `src/utils/mapColor.js`
`darkThemeStyles` — Google Maps dark-theme style array. Used by GoogleMapComponent + Location.jsx.

### Env vars (`.env`)
```
NEXT_PUBLIC_MAP_API=<google maps api key>        # Google JS SDK + Places + Geocoder
NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=in              # PhoneInput default country
NEXT_PUBLIC_COUNTRY_DIAL_CODE=+91
```

Google key also injected in `src/pages/_document.js:32` (`maps.googleapis.com/maps/api/js`).

> ⚠️ **Live-deploy gotcha:** Google key lives only in local `.env`. If the host (Vercel) doesn't have `NEXT_PUBLIC_MAP_API` set, Google Maps fails with *"This page didn't load Google Maps correctly."* OSM needs no key → works anywhere. Fix Google by adding the env var to the host AND allowing the deploy domain in Google Cloud Console key restrictions.

---

## 3. Geocoding

Two directions, two providers.

| Direction | Google | OSM |
|-----------|--------|-----|
| Reverse (lat/lng → address) | `new google.maps.Geocoder()` inline | `reverseGeocode()` in `src/utils/osmGeocode.js` |
| Forward (text → lat/lng) | `geocoder.geocode({address})` inline | `forwardGeocode()` in `src/utils/osmGeocode.js` |
| Places search | `getPlacesDetails({placeId})` API + Places lib | — |

### `src/utils/osmGeocode.js` (OSM, no API key)
- Base: `https://nominatim.openstreetmap.org`
- `reverseGeocode(lat, lng)` → `{ address, landmark, area, city, state, country, pincode, lat, lng }`
- `forwardGeocode(query)` → `{ lat, lng }`
- `mapNominatimAddress()` maps Nominatim fields → flat form shape.

**Nominatim field mapping (why fields fill or stay blank):**
- `address` ← `road / pedestrian / residential / neighbourhood / quarter / suburb / hamlet / village / display_name[0]`
- `landmark` ← `neighbourhood / residential / suburb / quarter / hamlet`
- `area` ← `suburb / city_district / county / state_district / village`
- `city` ← `city / town / municipality / village / county`
- `state` ← `state`, `country` ← `country`, `pincode` ← `postcode`

> Nominatim usage policy: light traffic, descriptive Referer (browser sends it). Avoid rapid bursts (rate-limited).

---

## 4. Geolocation (browser GPS)

`navigator.geolocation.getCurrentPosition()` with options `{ enableHighAccuracy: true, timeout: 8000-10000, maximumAge: 0 }`.

| File | Lines | Use |
|------|-------|-----|
| `NewAddressModal.jsx` | 74–86 | Auto-detect on modal open (fallback → Redux city) |
| `NewAddressModal.jsx` | 296–335 | "Use current location" button |
| `Location.jsx` | 54–59 | Auto-detect on dialog open |
| `Location.jsx` | 115–180 | Detect + detailed permission/timeout error toasts |

Permission denied / timeout → NewAddressModal falls back to Redux `state.City.city.{latitude,longitude}` so map never lands on 0,0 (ocean).

---

## 5. User-facing flows

### A. Pick delivery city (header)  — `src/components/locationmodal/Location.jsx`
Uses **Google Maps** + Places search.

```
Open Location modal
  → useJsApiLoader(MAP_CONFIG)
  → navigator.geolocation.getCurrentPosition()
  → show Places search + GoogleMap
  → user searches place OR drags marker
  → api.getZone({ latitude, longitude })   // backend delivery zone
  → dispatch(setCity({ ...zoneData }))      // citySlice
  → close modal; header shows selected city
```

### B. Add / edit delivery address — `src/components/newaddressmodal/NewAddressModal.jsx`
Currently embeds **OSM directly** (own `OSMMap.jsx` + `osmGeocode.js`).

```
Open NewAddressModal
  → geolocation auto-detect (fallback → Redux city)
  → <OSMMap> (Leaflet, dynamic ssr:false) renders draggable marker
  → user drags marker OR clicks "current location"
      → reverseGeocode(lat,lng) via Nominatim
      → fill form: address, landmark, area, city, pincode, state, country
  → user edits / fills name, mobile (PhoneInput), alt mobile
  → submit → api.addAddress / api.updateAddress
      → payload includes latitiude*, longitude
  → fetchAddress() refreshes list, auto-selects new address
```
\* param literally spelled `latitiude` (typo) but backend form field is `latitude`.

### C. Live order tracking — `src/components/profiledashboard/orders/LiveTrackingModal.jsx`
**Google Maps** + `Marker`, `Polyline`, `DirectionsRenderer`. Polls `liveOrderTracking({orderId})` every 5s; draws rider→user path.

---

## 6. Backend payload (lat/lng)

`src/api/apiRoutes.js`:
- `addAddress({..., latitiude, longitude})` → `formData.append("latitude", latitiude)` (line ~563), `longitude` (~564)
- `updateAddress(...)` → same (~609/610)
- Other location-aware: `getZone`, `getShop`, `getHomeLayout`, `getProductByFilter`, `getPlacesDetails`, `liveOrderTracking`.

---

## 7. Redux state

### citySlice (`src/redux/slices/citySlice.js`)
`state.City.city` = selected delivery city/zone:
`{ id, name, state, formatted_address, latitude, longitude, delivery_charge_method, fixed_charge, per_km_charge, max_deliverable_distance, zone_id, channel, ... }`
Set by `setCity()` (dispatched in Location.jsx).

### addressSlice (`src/redux/slices/addressSlice.js`)
- `setAllAddresses()` — user's saved addresses (each holds lat/lng)
- `setSelectedAddress()` — active checkout address
- `setSelectedAddresForEdit()` — address being edited (drives NewAddressModal edit mode)

### settingSlice
`state.Setting.setting.map_provider` — drives `useMapProvider`.

---

## 8. ⚠️ Known inconsistency (cleanup opportunity)

The project has TWO parallel map setups:

1. **Shared system** — `MapWrapper` + `useMapProvider` + `GoogleMapComponent`/`OpenStreetMapComponent`. Provider-agnostic, settings-driven, SSR-safe, has loader/error fallbacks. **This is the intended abstraction.**

2. **NewAddressModal's own OSM** — standalone `OSMMap.jsx` + `osmGeocode.js`, hardcoded to OSM, bypasses `MapWrapper` and the `map_provider` setting.

`Location.jsx` and `LiveTrackingModal.jsx` use Google **directly** too (not via MapWrapper).

**Recommendation:** migrate `NewAddressModal` (and ideally Location/LiveTracking) to `<MapWrapper>` so the `map_provider` setting controls every map uniformly, and geocoding gets a shared provider-aware helper. Until then, NewAddressModal is always OSM regardless of the backend setting.

---

## 9. File quick-reference

```
src/
├─ components/
│  ├─ maps/
│  │  ├─ MapWrapper.jsx            ← provider switch (USE THIS)
│  │  ├─ GoogleMapComponent.jsx
│  │  ├─ OpenStreetMapComponent.jsx
│  │  ├─ MapLoader.jsx  MapError.jsx  types.js  index.js
│  ├─ newaddressmodal/
│  │  ├─ NewAddressModal.jsx       ← add/edit address (embeds OSM directly)
│  │  └─ OSMMap.jsx                ← standalone Leaflet map
│  ├─ locationmodal/Location.jsx   ← city picker (Google direct)
│  └─ profiledashboard/orders/LiveTrackingModal.jsx  ← order tracking (Google direct)
├─ hooks/useMapProvider.js
├─ utils/
│  ├─ mapConfig.js   mapColor.js
│  └─ osmGeocode.js                ← Nominatim reverse/forward geocode
├─ redux/slices/citySlice.js  addressSlice.js  settingSlice.js
└─ api/apiRoutes.js               ← addAddress/updateAddress (lat/lng payload)
```
