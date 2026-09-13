"use client";

import { useEffect, useMemo, useRef, useState, MutableRefObject } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapLoader from "./MapLoader";
import type { MapComponentProps, MapLatLng } from "./types";

// Monotonic counter giving every mounted map a unique container key. Guarantees
// React never reuses a DOM node between two Leaflet instances (Strict Mode
// double-mount, navigation remounts) → kills "Map container is being reused".
let mapInstanceSeq = 0;

/**
 * Leaflet ships its default marker icons as separate asset files that bundlers
 * (webpack/Next) rewrite, breaking the default icon URLs. Point Leaflet at the
 * CDN copies once so markers render. Done lazily inside the component since this
 * module is only ever imported client-side (MapWrapper loads it with ssr:false).
 */
const DEFAULT_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Keep the Leaflet view in sync when center/zoom props change. */
function RecenterController({ center, zoom }: { center: L.LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

/** Bridge Leaflet map clicks to the common onMapClick callback. */
function ClickController({ onMapClick }: { onMapClick?: (coords: MapLatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Recompute Leaflet's size after mount. When the map mounts inside a dialog
 * that animates open (or a flex column that resolves height a tick later), the
 * container is 0-sized at init and tiles render as grey placeholders until a
 * resize. invalidateSize() forces the recalculation. Most visible on mobile,
 * where the dialog open transition lands after first paint.
 */
function ResizeController() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    // A few delayed passes cover the dialog open animation.
    const timers = [0, 150, 400, 800].map((ms) => setTimeout(fix, ms));
    window.addEventListener("resize", fix);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

/**
 * Captures the Leaflet map instance into a ref and fires onReady once.
 *
 * react-leaflet v5 removed MapContainer's `whenCreated` prop; the supported
 * way to reach the map instance is `useMap()` from a child component.
 */
function MapReadyController({
  mapRef,
  onReady,
}: {
  mapRef: MutableRefObject<L.Map | null>;
  onReady?: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    onReady?.();
  }, [map, mapRef, onReady]);
  return null;
}

/** Fit the Leaflet viewport to all given [lat,lng] points. */
function FitBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], map.getZoom());
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/**
 * OpenStreetMap implementation of the common map interface, via react-leaflet.
 */
export default function OpenStreetMapComponent({
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
}: MapComponentProps) {
  // MapContainer must only mount once the component is on the client.
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  // Unique key for this map's DOM container, assigned once per component mount.
  // Lazy useState initializer (not a ref mutated during render) so reading it
  // in the JSX below stays render-pure — see react.dev/reference/react/useRef
  // ("Do not write or read ref.current during rendering").
  const [containerKey] = useState(() => ++mapInstanceSeq);

  useEffect(() => {
    // intentional: flips mounted flag exactly once after mount so MapContainer
    // (client-only) never renders during SSR/first paint — see comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => {
      // Don't call mapRef.current.remove() here: react-leaflet's MapContainer
      // already removes the Leaflet instance on unmount. Removing it ourselves
      // double-frees the container and leaves the DOM node in a half-torn-down
      // state, which the next mount sees as "Map container is being reused by
      // another instance". Just drop our reference.
      mapRef.current = null;
    };
  }, []);

  const center = useMemo(
    () => [Number(latitude), Number(longitude)] as [number, number],
    [latitude, longitude],
  );

  const containerStyle = useMemo(
    () => ({
      width: "100%",
      height: typeof height === "number" ? `${height}px` : height,
    }),
    [height],
  );

  const resolvedMarkers = useMemo(() => {
    if (Array.isArray(markers) && markers.length > 0) return markers;
    if (showCenterMarker)
      return [{ latitude: center[0], longitude: center[1] }];
    return [];
  }, [markers, showCenterMarker, center]);

  const polylinePositions = useMemo(
    () =>
      Array.isArray(polyline)
        ? polyline.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number])
        : [],
    [polyline],
  );

  const polygonPositions = useMemo(
    () =>
      Array.isArray(polygon)
        ? polygon
            .map((p) => [Number(p.lat), Number(p.lng)] as [number, number])
            .filter(([lat, lng]) => !Number.isNaN(lat) && !Number.isNaN(lng))
        : [],
    [polygon],
  );

  const fitPoints = useMemo(() => {
    if (!fitToMarkers) return [];
    return [
      ...resolvedMarkers.map((m) => [Number(m.latitude), Number(m.longitude)] as [number, number]),
      ...polylinePositions,
      ...polygonPositions,
    ].filter(([lat, lng]) => !Number.isNaN(lat) && !Number.isNaN(lng));
  }, [fitToMarkers, resolvedMarkers, polylinePositions, polygonPositions]);

  const leafletPolylineOptions = useMemo(
    () => ({
      color: polylineOptions?.color ?? "#16a34a",
      weight: polylineOptions?.weight ?? 6,
      opacity: polylineOptions?.opacity ?? 0.9,
    }),
    [polylineOptions],
  );

  const leafletPolygonOptions = useMemo(
    () => ({
      color: polygonOptions?.color ?? "#2563eb",
      weight: polygonOptions?.weight ?? 2,
      opacity: polygonOptions?.opacity ?? 0.9,
      fillColor: polygonOptions?.color ?? "#2563eb",
      fillOpacity: polygonOptions?.fillOpacity ?? 0.12,
      interactive: false,
    }),
    [polygonOptions],
  );

  if (!mounted) {
    return <MapLoader height={height} className={className} />;
  }

  return (
    <div className={className} style={{ width: "100%" }}>
      {/* The `leaflet` package ships no type declarations and this project has
          no @types/leaflet either, so react-leaflet's prop interfaces (which
          extend leaflet's untyped MapOptions/TileLayerOptions/MarkerOptions)
          resolve incorrectly and reject props leaflet genuinely supports at
          runtime (center/zoom/attribution/icon). Pre-existing dependency gap,
          outside this migration batch's scope — cast at the JSX boundary only,
          no behavior change. */}
      <MapContainer
        key={`osm-map-${containerKey}`}
        {...({ center, zoom, scrollWheelZoom: true } as object)}
        style={containerStyle}
      >
        <MapReadyController mapRef={mapRef} onReady={onReady} />
        <TileLayer
          {...({
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          } as object)}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeController />
        {fitToMarkers && fitPoints.length > 0 ? (
          <FitBoundsController points={fitPoints} />
        ) : (
          <RecenterController center={center} zoom={zoom} />
        )}
        {onMapClick && <ClickController onMapClick={onMapClick} />}
        {polygonPositions.length >= 3 && (
          <Polygon
            positions={polygonPositions}
            pathOptions={leafletPolygonOptions}
          />
        )}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={leafletPolylineOptions}
          />
        )}
        {resolvedMarkers.map((m, i) => {
          const icon = m.iconUrl
            ? new L.Icon({
                iconUrl: m.iconUrl,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32],
              })
            : DEFAULT_ICON;
          return (
            <Marker
              // Stable key per marker slot. Including lat/lng would remount the
              // marker on every coordinate change, which fights an in-progress
              // drag and snaps the pin back.
              key={`marker-${i}`}
              position={[Number(m.latitude), Number(m.longitude)]}
              {...({ icon, draggable: draggableMarker } as object)}
              eventHandlers={
                draggableMarker
                  ? {
                      dragend: (e: any) => {
                        const { lat, lng } = e.target.getLatLng();
                        onMarkerDragEnd?.({ lat, lng });
                      },
                    }
                  : undefined
              }
            >
              {m.title ? <Popup>{m.title}</Popup> : null}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
