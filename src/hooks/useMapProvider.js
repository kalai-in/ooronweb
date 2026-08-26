import { useSelector } from "react-redux";
import {
  DEFAULT_MAP_PROVIDER,
  isSupportedProvider,
} from "../components/maps/types";

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
 *
 * @returns {{
 *   provider: import("../components/maps/types").MapProvider | null,
 *   rawProvider: unknown,
 *   isLoading: boolean,
 *   isSupported: boolean,
 * }}
 */
export default function useMapProvider() {
  const setting = useSelector((state) => state.Setting.setting);
  const status = useSelector((state) => state.Setting.status);

  // Settings not fetched yet -> treat as loading so we don't flash fallback.
  const isLoading = !setting && status === "loading";

  // Backend may nest it under web settings; accept both top-level and nested.
  const rawProvider =
    setting?.map_provider ??
    setting?.web_settings?.map_provider ??
    null;

  let provider = null;
  if (isSupportedProvider(rawProvider)) {
    provider = rawProvider.toLowerCase();
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
