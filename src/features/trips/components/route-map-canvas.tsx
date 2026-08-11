"use client";

// The Leaflet map itself. Loaded only in the browser (see route-map.tsx),
// because Leaflet touches `window` at import time.
//
// Tiles come from OpenStreetMap — free, no API key (project rule: no paid
// services). Attribution is required by their tile usage policy.

import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { routeBounds, type RouteStop } from "../domain/route";

// Numbered pins in the app's palette. A divIcon avoids Leaflet's default
// marker images, which don't survive bundling.
function numberedIcon(position: number) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:2rem;height:2rem;border-radius:9999px;
      background:var(--primary);color:var(--primary-foreground);
      border:2px solid var(--surface);
      box-shadow:0 4px 12px rgba(59,47,42,0.35);
      font-weight:700;font-size:0.875rem;
    ">${position}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export default function RouteMapCanvas({ stops }: { stops: RouteStop[] }) {
  const bounds = routeBounds(stops);
  if (!bounds) return null;

  const line = stops.map((stop): [number, number] => [
    stop.latitude,
    stop.longitude,
  ]);

  return (
    <MapContainer
      center={bounds.center}
      zoom={bounds.zoom}
      scrollWheelZoom={false}
      className="h-[26rem] w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {line.length > 1 && (
        <Polyline
          positions={line}
          pathOptions={{
            color: "var(--primary)",
            weight: 3,
            dashArray: "8 10",
            opacity: 0.8,
          }}
        />
      )}

      {stops.map((stop, index) => (
        <Marker
          key={stop.city}
          position={[stop.latitude, stop.longitude]}
          icon={numberedIcon(index + 1)}
        >
          <Popup>
            <div dir="rtl" className="text-center">
              <strong>{stop.city}</strong>
              <br />
              {stop.itemCount === 1
                ? "דבר אחד שבחרתם"
                : `${stop.itemCount} דברים שבחרתם`}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
