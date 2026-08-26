"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  GoogleMap,
  MarkerF,
  Polygon,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useSelector } from "react-redux";
import { MAP_CONFIG } from "../../utils/mapConfig";
import { darkThemeStyles } from "../../utils/mapColor";
import MapLoader from "./MapLoader";
import MapError from "./MapError";

/**
 * Google Maps implementation of the common map interface.
 * Reuses the existing MAP_CONFIG / @react-google-maps/api setup.
 *
 * @param {import("./types").MapComponentProps} props
 */
export default function GoogleMapComponent({
  latitude,
  longitude,
  zoom = 13,
  markers,
  showCenterMarker = true,
  height = "360px",
  className = "",
  draggableMarker = false,
  onMarkerDragEnd,
  onMapClick,
  onReady,
  polyline,
  polylineOptions,
  polygon,
  polygonOptions,
  fitToMarkers = false,
}) {
  const theme = useSelector((state) => state.Theme.theme);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader(MAP_CONFIG);

  const center = useMemo(
    () => ({ lat: Number(latitude), lng: Number(longitude) }),
    [latitude, longitude]
  );

  const containerStyle = useMemo(
    () => ({
      width: "100%",
      height: typeof height === "number" ? `${height}px` : height,
    }),
    [height]
  );

  const options = useMemo(
    () => ({
      disableDefaultUI: false,
      // Map type ("layers") control defaults to the top-left corner, where
      // callers commonly place their own overlay badges (e.g. LiveTrackingModal's
      // "Rider is on the way" pill) — not useful for a small embedded tracker.
      mapTypeControl: false,
      clickableIcons: false,
      styles: theme === "dark" ? darkThemeStyles : undefined,
    }),
    [theme]
  );

  const resolvedMarkers = useMemo(() => {
    if (Array.isArray(markers) && markers.length > 0) return markers;
    if (showCenterMarker)
      return [{ latitude: center.lat, longitude: center.lng }];
    return [];
  }, [markers, showCenterMarker, center.lat, center.lng]);

  const polylinePath = useMemo(
    () =>
      Array.isArray(polyline)
        ? polyline.map((p) => ({
            lat: Number(p.latitude),
            lng: Number(p.longitude),
          }))
        : [],
    [polyline]
  );

  const gPolylineOptions = useMemo(
    () => ({
      strokeColor: polylineOptions?.color ?? "#16a34a",
      strokeOpacity: polylineOptions?.opacity ?? 0.9,
      strokeWeight: polylineOptions?.weight ?? 6,
    }),
    [polylineOptions]
  );

  const polygonPath = useMemo(
    () =>
      Array.isArray(polygon)
        ? polygon
            .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
            .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng))
        : [],
    [polygon]
  );

  const gPolygonOptions = useMemo(
    () => ({
      strokeColor: polygonOptions?.color ?? "#2563eb",
      strokeOpacity: polygonOptions?.opacity ?? 0.9,
      strokeWeight: polygonOptions?.weight ?? 2,
      fillColor: polygonOptions?.color ?? "#2563eb",
      fillOpacity: polygonOptions?.fillOpacity ?? 0.12,
      clickable: false,
    }),
    [polygonOptions]
  );

  // Auto-fit the viewport to every marker + polyline point.
  const fitBounds = useCallback(
    (map) => {
      if (!fitToMarkers || !map || !window.google?.maps) return;
      const pts = [
        ...resolvedMarkers.map((m) => ({
          lat: Number(m.latitude),
          lng: Number(m.longitude),
        })),
        ...polylinePath,
        ...polygonPath,
      ].filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
      if (pts.length === 0) return;
      const bounds = new window.google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);
    },
    [fitToMarkers, resolvedMarkers, polylinePath, polygonPath]
  );

  const handleLoad = useCallback(
    (map) => {
      mapRef.current = map;
      fitBounds(map);
      onReady?.();
    },
    [onReady, fitBounds]
  );

  // Re-fit when markers/polyline change after initial load (e.g. rider moves).
  useEffect(() => {
    if (mapRef.current) fitBounds(mapRef.current);
  }, [fitBounds]);

  // Proper cleanup on unmount: drop the map ref so GC can reclaim it.
  const handleUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback(
    (e) => {
      if (!onMapClick || !e?.latLng) return;
      onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [onMapClick]
  );

  const handleDragEnd = useCallback(
    (e) => {
      if (!onMarkerDragEnd || !e?.latLng) return;
      onMarkerDragEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [onMarkerDragEnd]
  );

  if (loadError) {
    // Log for debugging, show friendly fallback instead of crashing the page.
    console.error("[MapWrapper] Google Maps failed to load:", loadError);
    return <MapError height={height} className={className} />;
  }

  if (!isLoaded) {
    return <MapLoader height={height} className={className} />;
  }

  return (
    <div className={className} style={{ width: "100%" }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={options}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        onClick={handleMapClick}
      >
        {polygonPath.length >= 3 && (
          <Polygon paths={polygonPath} options={gPolygonOptions} />
        )}
        {polylinePath.length >= 2 && (
          <Polyline path={polylinePath} options={gPolylineOptions} />
        )}
        {resolvedMarkers.map((m, i) => (
          <MarkerF
            key={`${m.latitude}-${m.longitude}-${i}`}
            position={{ lat: Number(m.latitude), lng: Number(m.longitude) }}
            title={m.title}
            // A bare URL string renders the image at its native pixel size —
            // scaledSize caps it so a large source image doesn't dwarf the map.
            icon={
              m.iconUrl
                ? {
                    url: m.iconUrl,
                    scaledSize: new window.google.maps.Size(36, 36),
                  }
                : undefined
            }
            draggable={draggableMarker}
            onDragEnd={draggableMarker ? handleDragEnd : undefined}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
