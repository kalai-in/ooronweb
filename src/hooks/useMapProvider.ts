import { useSelector } from "react-redux";
import {
  DEFAULT_MAP_PROVIDER,
  isSupportedProvider,
} from "../components/maps/types";

// Supported map providers, mirroring components/maps/types.js's MapProvider typedef.
type MapProvider = "google" | "osm";

/**
 * Resolve which map provider to render from the backend settings.
 *
 * The settings object is fetched once and stored in `state.Setting.setting`
 * (see Layout.jsx / settingSlice.js). The backend returns a `map_provider`
 * field there, e.g. `{ map_provider: "google" }` or `{ map_provider: "osm" }`.
 *
 * Returns a normalized, lowercased provider string when supported, otherwise
 * `null` so callers can render the fallback UI. No hardcoding of a single
 * provider — the value comes entirely from the API response.
 */
export default function useMapProvider(): {
  provider: MapProvider | null;
  rawProvider: unknown;
  isLoading: boolean;
  isSupported: boolean;
} {
  const setting = useSelector((state: any) => state.Setting.setting);
  const status = useSelector((state: any) => state.Setting.status);

  // Settings not fetched yet -> treat as loading so we don't flash fallback.
  const isLoading = !setting && status === "loading";

  // Backend may nest it under web settings; accept both top-level and nested.
  const rawProvider =
    setting?.map_provider ??
    setting?.web_settings?.map_provider ??
    null;

  let provider: MapProvider | null = null;
  if (isSupportedProvider(rawProvider)) {
    provider = rawProvider.toLowerCase() as MapProvider;
  } else if (rawProvider == null && !isLoading) {
    // Missing/null provider: fall back to default (or null to force fallback UI).
    provider = DEFAULT_MAP_PROVIDER;
  }

  return {
    provider,
    rawProvider,
    isLoading,
    isSupported: isSupportedProvider(rawProvider),
  };
}
