"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import useMapProvider from "../../hooks/useMapProvider";
import { MAP_PROVIDERS, isSupportedProvider, MapComponentProps, MapProvider } from "./types";
import MapLoader from "./MapLoader";
import MapError from "./MapError";

/**
 * Both provider components are loaded with ssr:false. This is what makes the
 * system SSR-safe in Next.js: Google's loader and Leaflet both touch `window`,
 * so they must never run on the server. `loading` shows the shared spinner.
 */
const GoogleMapComponent = dynamic(() => import("./GoogleMapComponent"), {
  ssr: false,
  loading: () => <MapLoader />,
});

const OpenStreetMapComponent = dynamic(
  () => import("./OpenStreetMapComponent"),
  { ssr: false, loading: () => <MapLoader /> }
);

interface MapWrapperProps extends MapComponentProps {
  /** Override the API-resolved provider (useful for tests / one-off screens). */
  provider?: MapProvider;
}

/**
 * Provider-agnostic map. Picks Google Maps or OpenStreetMap based entirely on
 * the backend `map_provider` setting — no code change or deploy needed to
 * switch. Pass an explicit `provider` prop to override the API value (useful
 * for tests / one-off screens).
 */
export default function MapWrapper({ provider: providerProp, ...props }: MapWrapperProps) {
  const { provider: apiProvider, isLoading, rawProvider } = useMapProvider();

  // Explicit prop wins over the API-resolved provider.
  const provider = providerProp ?? apiProvider;

  const { latitude, longitude, height, className } = props;

  const coordsValid = useMemo(
    () =>
      latitude != null &&
      longitude != null &&
      !Number.isNaN(Number(latitude)) &&
      !Number.isNaN(Number(longitude)),
    [latitude, longitude]
  );

  // Still resolving settings from the API -> show loader, not fallback.
  if (isLoading && !providerProp) {
    return <MapLoader height={height} className={className} />;
  }

  if (!coordsValid) {
    console.error("[MapWrapper] Invalid coordinates:", { latitude, longitude });
    return (
      <MapError
        message="Location coordinates are unavailable."
        height={height}
        className={className}
      />
    );
  }

  if (!isSupportedProvider(provider)) {
    // Missing, null, or unsupported provider value from the API.
    console.error(
      "[MapWrapper] Unsupported map provider:",
      provider ?? rawProvider
    );
    return (
      <MapError
        message="Map is currently unavailable."
        height={height}
        className={className}
      />
    );
  }

  const normalized = provider.toLowerCase();

  if (normalized === MAP_PROVIDERS.GOOGLE) {
    return <GoogleMapComponent {...props} />;
  }

  if (normalized === MAP_PROVIDERS.OSM) {
    return <OpenStreetMapComponent {...props} />;
  }

  // Defensive: should be unreachable due to isSupportedProvider guard above.
  return <MapError height={height} className={className} />;
}
