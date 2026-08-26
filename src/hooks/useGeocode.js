import { useCallback } from "react";
import useMapProvider from "./useMapProvider";
import {
  reverseGeocode as reverseGeocodeImpl,
  forwardGeocode as forwardGeocodeImpl,
} from "@/utils/geocode";

/**
 * Provider-bound geocoding. Reads the active `map_provider` once and returns
 * reverse/forward fns that route to Google or OSM automatically, so callers
 * never branch on the provider.
 *
 * @returns {{
 *   provider: import("@/components/maps/types").MapProvider | null,
 *   reverseGeocode: (lat:number,lng:number)=>Promise<object|null>,
 *   forwardGeocode: (query:string)=>Promise<{lat:number,lng:number}|null>,
 * }}
 */
export default function useGeocode() {
  const { provider } = useMapProvider();

  const reverseGeocode = useCallback(
    (lat, lng) => reverseGeocodeImpl(lat, lng, provider),
    [provider]
  );

  const forwardGeocode = useCallback(
    (query) => forwardGeocodeImpl(query, provider),
    [provider]
  );

  return { provider, reverseGeocode, forwardGeocode };
}
