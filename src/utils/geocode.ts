// Provider-aware geocoding facade.
//
// Picks Google Maps Geocoder or OSM/Nominatim based on the backend
// `map_provider` setting, exposing ONE shape for both directions so callers
// (NewAddressModal, Location, LiveTracking) never branch on the provider.
//
// Forward  : free-text address -> { lat, lng }
// Reverse  : lat/lng           -> { address, landmark, area, city, state,
//                                   country, pincode, lat, lng, formatted_address }
//
// Google path requires the Maps JS SDK (window.google.maps) to be loaded; OSM
// path needs no key and works on any domain.

import { MAP_PROVIDERS } from "@/components/maps/types";
import {
  reverseGeocode as osmReverse,
  forwardGeocode as osmForward,
} from "@/utils/osmGeocode";
import { getGeocoding } from "@/api/apiRoutes";

const hasGoogleGeocoder = (): boolean =>
  typeof window !== "undefined" && !!(window as any).google?.maps?.Geocoder;

// Google's address_components[] entries; shape kept loose (third-party SDK JSON).
type GoogleAddressComponent = {
  types?: string[];
  long_name?: string;
  [key: string]: any;
};

type FlatAddress = {
  address: string;
  landmark: string;
  area: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

// Flatten a Google `address_components[]` array into the same flat shape the
// OSM helper returns, so the address form fills identically under either
// provider.
const mapGoogleComponents = (
  components: GoogleAddressComponent[] = [],
): FlatAddress => {
  const get = (type: string): string =>
    components.find((c) => c.types?.includes(type))?.long_name || "";

  const route = get("route");
  const sublocality =
    get("sublocality") ||
    get("sublocality_level_1") ||
    get("neighborhood");
  const premise = get("premise") || get("street_number");

  return {
    address: route || premise || sublocality || "",
    landmark: get("neighborhood") || sublocality || "",
    area:
      sublocality ||
      get("administrative_area_level_3") ||
      get("administrative_area_level_2") ||
      "",
    city:
      get("locality") ||
      get("administrative_area_level_2") ||
      get("postal_town") ||
      "",
    state: get("administrative_area_level_1") || "",
    country: get("country") || "",
    pincode: get("postal_code") || "",
  };
};

// --- Google implementations (require SDK loaded) ---------------------------

const googleReverse = (
  lat: number,
  lng: number,
): Promise<FlatAddress & { formatted_address: string; lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        reject(new Error(`Google reverse failed: ${status}`));
        return;
      }
      const top = results[0];
      resolve({
        ...mapGoogleComponents(top.address_components),
        formatted_address: top.formatted_address || "",
        lat,
        lng,
      });
    });
  });

const googleForward = (query: string): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        reject(new Error(`Google forward failed: ${status}`));
        return;
      }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });

// --- Backend implementation (maps_geocoding) -------------------------------

// Reverse-geocode via the backend. Server returns Google-shaped results
// (results[0].address_components) under any configured provider, so reuse the
// Google component flattener. Returns null on miss so callers can fall back.
const backendReverse = async (
  lat: number,
  lng: number,
): Promise<(FlatAddress & { formatted_address: string; lat: number; lng: number }) | null> => {
  const res: any = await getGeocoding({ latitude: lat, longitude: lng });
  const top = res?.data?.results?.[0];
  if (res?.status != 1 || !top) return null;
  return {
    ...mapGoogleComponents(top.address_components),
    formatted_address: top.formatted_address || "",
    lat,
    lng,
  };
};

// --- Public facade ---------------------------------------------------------

// Normalize the OSM reverse result to also carry a `formatted_address` so both
// providers expose the same fields.
const normalizeOsmReverse = async (lat: number, lng: number): Promise<any> => {
  const r: any = await osmReverse(lat, lng);
  if (!r) return null;
  const formatted = [r.address, r.area, r.city, r.state, r.country]
    .filter(Boolean)
    .join(", ");
  return { ...r, formatted_address: formatted };
};

/**
 * Reverse geocode using the active provider.
 */
export const reverseGeocode = async (
  lat: number,
  lng: number,
  provider: "google" | "osm",
): Promise<any> => {
  // Prefer the backend maps_geocoding endpoint — no SDK / domain constraints
  // and it honours the server-side map provider. Fall back to the client paths
  // (Google SDK / OSM) only if the backend errors or returns nothing.
  try {
    const fromBackend = await backendReverse(lat, lng);
    if (fromBackend) return fromBackend;
  } catch (error) {
    console.warn("Backend reverse geocode failed, falling back:", error?.message);
  }
  if (provider === MAP_PROVIDERS.GOOGLE && hasGoogleGeocoder()) {
    return googleReverse(lat, lng);
  }
  // OSM fallback also covers "google selected but SDK not ready yet".
  return normalizeOsmReverse(lat, lng);
};

/**
 * Forward geocode using the active provider.
 */
export const forwardGeocode = (
  query: string,
  provider: "google" | "osm",
): Promise<{ lat: number; lng: number } | null> => {
  if (provider === MAP_PROVIDERS.GOOGLE && hasGoogleGeocoder()) {
    return googleForward(query);
  }
  return osmForward(query);
};
