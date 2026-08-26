/**
 * Common interface shared by every map provider component.
 *
 * Both GoogleMapComponent and OpenStreetMapComponent accept exactly this
 * shape, so MapWrapper can swap providers without callers caring which one
 * renders. Keep this file as the single source of truth for map props.
 *
 * @typedef {Object} MapMarker
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [title]    Tooltip / popup label for the marker.
 * @property {string} [iconUrl]  Optional custom marker image URL.
 *
 * @typedef {Object} MapComponentProps
 * @property {number} latitude              Center latitude.
 * @property {number} longitude             Center longitude.
 * @property {number} [zoom=13]             Initial zoom level.
 * @property {MapMarker[]} [markers]        Markers to render. Defaults to a
 *                                          single marker at [latitude,longitude].
 * @property {boolean} [showCenterMarker=true]  Render a marker at the center
 *                                          when `markers` is omitted.
 * @property {string|number} [height="360px"]   CSS height of the map container.
 * @property {string} [className]           Extra classes for the container.
 * @property {boolean} [draggableMarker=false]  Allow dragging the center marker.
 * @property {(coords:{lat:number,lng:number})=>void} [onMarkerDragEnd]
 *                                          Fired after a draggable marker moves.
 * @property {(coords:{lat:number,lng:number})=>void} [onMapClick]
 *                                          Fired when the map surface is clicked.
 * @property {()=>void} [onReady]           Fired once the map finished init.
 * @property {MapMarker[]} [polyline]       Ordered points to connect with a
 *                                          line (e.g. rider -> user path).
 * @property {{color?:string,weight?:number,opacity?:number}} [polylineOptions]
 *                                          Styling for the polyline.
 * @property {{lat:number,lng:number}[]} [polygon]
 *                                          Closed area to shade (e.g. a
 *                                          delivery zone boundary). Needs at
 *                                          least 3 points to render.
 * @property {{color?:string,weight?:number,opacity?:number,fillOpacity?:number}} [polygonOptions]
 *                                          Styling for the polygon.
 * @property {boolean} [fitToMarkers=false] Auto-fit the viewport to all
 *                                          markers + polyline points.
 */

/**
 * Supported provider identifiers as returned by the backend `map_provider`
 * field. Anything outside this set is treated as unsupported.
 * @typedef {"google"|"osm"} MapProvider
 */

export const MAP_PROVIDERS = Object.freeze({
  GOOGLE: "google",
  OSM: "osm",
});

export const SUPPORTED_PROVIDERS = Object.freeze([
  MAP_PROVIDERS.GOOGLE,
  MAP_PROVIDERS.OSM,
]);

/**
 * Provider used when the API value is missing/null but we still want a map.
 * Set to null to instead show the fallback message on a missing provider.
 * @type {MapProvider}
 */
export const DEFAULT_MAP_PROVIDER = MAP_PROVIDERS.GOOGLE;

/**
 * @param {unknown} provider
 * @returns {provider is MapProvider}
 */
export const isSupportedProvider = (provider) =>
  typeof provider === "string" &&
  SUPPORTED_PROVIDERS.includes(provider.toLowerCase());
