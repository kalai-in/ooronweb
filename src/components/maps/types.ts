/**
 * Common interface shared by every map provider component.
 *
 * Both GoogleMapComponent and OpenStreetMapComponent accept exactly this
 * shape, so MapWrapper can swap providers without callers caring which one
 * renders. Keep this file as the single source of truth for map props.
 */

export interface MapMarker {
  latitude: number;
  longitude: number;
  /** Tooltip / popup label for the marker. */
  title?: string;
  /** Optional custom marker image URL. */
  iconUrl?: string;
}

export interface MapLineStyleOptions {
  color?: string;
  weight?: number;
  opacity?: number;
}

export interface MapPolygonStyleOptions extends MapLineStyleOptions {
  fillOpacity?: number;
}

export interface MapLatLng {
  lat: number;
  lng: number;
}

export interface MapComponentProps {
  /** Center latitude. */
  latitude: number;
  /** Center longitude. */
  longitude: number;
  /** Initial zoom level. Default 13. */
  zoom?: number;
  /** Markers to render. Defaults to a single marker at [latitude,longitude]. */
  markers?: MapMarker[];
  /** Render a marker at the center when `markers` is omitted. Default true. */
  showCenterMarker?: boolean;
  /** CSS height of the map container. Default "360px". */
  height?: string | number;
  /** Extra classes for the container. */
  className?: string;
  /** Allow dragging the center marker. Default false. */
  draggableMarker?: boolean;
  /** Fired after a draggable marker moves. */
  onMarkerDragEnd?: (coords: MapLatLng) => void;
  /** Fired when the map surface is clicked. */
  onMapClick?: (coords: MapLatLng) => void;
  /** Fired once the map finished init. */
  onReady?: () => void;
  /** Ordered points to connect with a line (e.g. rider -> user path). */
  polyline?: MapMarker[];
  /** Styling for the polyline. */
  polylineOptions?: MapLineStyleOptions;
  /** Closed area to shade (e.g. a delivery zone boundary). Needs at least 3 points to render. */
  polygon?: MapLatLng[];
  /** Styling for the polygon. */
  polygonOptions?: MapPolygonStyleOptions;
  /** Auto-fit the viewport to all markers + polyline points. Default false. */
  fitToMarkers?: boolean;
}

/**
 * Supported provider identifiers as returned by the backend `map_provider`
 * field. Anything outside this set is treated as unsupported.
 */
export type MapProvider = "google" | "osm";

export const MAP_PROVIDERS = Object.freeze({
  GOOGLE: "google",
  OSM: "osm",
} as const);

export const SUPPORTED_PROVIDERS = Object.freeze([
  MAP_PROVIDERS.GOOGLE,
  MAP_PROVIDERS.OSM,
]);

/**
 * Provider used when the API value is missing/null but we still want a map.
 * Set to null to instead show the fallback message on a missing provider.
 */
export const DEFAULT_MAP_PROVIDER: MapProvider = MAP_PROVIDERS.GOOGLE;

export const isSupportedProvider = (provider: unknown): provider is MapProvider =>
  typeof provider === "string" &&
  (SUPPORTED_PROVIDERS as readonly string[]).includes(provider.toLowerCase());
