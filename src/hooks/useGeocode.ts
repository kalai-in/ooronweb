import { useCallback } from "react";
import useMapProvider from "./useMapProvider";
import {
  reverseGeocode as reverseGeocodeImpl,
  forwardGeocode as forwardGeocodeImpl,
} from "@/utils/geocode";

// Supported map providers, mirroring components/maps/types.js's MapProvider typedef.
type MapProvider = "google" | "osm";

/**
 * Provider-bound geocoding. Reads the active `map_provider` once and returns
 * reverse/forward fns that route to Google or OSM automatically, so callers
 * never branch on the provider.
 */
export default function useGeocode(): {
  provider: MapProvider | null;
  reverseGeocode: (lat: number, lng: number) => Promise<any>;
  forwardGeocode: (query: string) => Promise<{ lat: number; lng: number } | null>;
} {
  const { provider } = useMapProvider();

  // geocode.ts's provider param isn't typed to accept null, but passing null
  // through unchanged preserves existing behavior: neither implementation
  // special-cases it, so it just falls through to the OSM branch (same as
  // "osm") exactly as it did before this file was typed.
  const reverseGeocode = useCallback(
    (lat: number, lng: number) =>
      reverseGeocodeImpl(lat, lng, provider as "google" | "osm"),
    [provider]
  );

  const forwardGeocode = useCallback(
    (query: string) => forwardGeocodeImpl(query, provider as "google" | "osm"),
    [provider]
  );

  return { provider, reverseGeocode, forwardGeocode };
}
