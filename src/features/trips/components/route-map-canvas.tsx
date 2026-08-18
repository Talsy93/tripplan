"use client";

// The Leaflet map itself. Loaded only in the browser (see route-map.tsx),
// because Leaflet touches `window` at import time.
//
// Tiles come from OpenStreetMap — free, no API key (project rule: no paid
// services). Attribution is required by their tile usage policy.

import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { routeBounds, type RouteStop } from "../domain/route";
import { cityToneMap, toneByIndex, type Tone } from "../domain/tone";

// Numbered pins, one colour per city, matching the chips and the schedule.
//
// A divIcon avoids Leaflet's default marker images, which don't survive
// bundling. The markup is built outside React's tree, so the .tone-* class
// cannot reach it — the palette variable is named directly instead.
//
// The pin is filled with the tone's *ink* rather than its dot: the dots are
// pale by design and a number on top of one is not readable at 32px. Ink is
// dark enough to carry white text while still saying which city this is.
function numberedIcon(position: number, tone: Tone) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:2rem;height:2rem;border-radius:9999px;
      background:var(--${tone}-ink);color:var(--primary-foreground);
      border:2px solid var(--surface);
      box-shadow:var(--elevation-lift);
      font-weight:700;font-size:0.875rem;
    ">${position}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export default function RouteMapCanvas({ stops }: { stops: RouteStop[] }) {
  const bounds = routeBounds(stops);
  // Built from the same city list, in the same order, as every other surface —
  // that is what keeps a city one colour across the app.
  const tones = cityToneMap(stops.map((stop) => stop.city));
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
      className="h-full w-full"
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
          icon={numberedIcon(
            index + 1,
            tones.get(stop.city) ?? toneByIndex(index),
          )}
        >
          <Popup>
            <div dir="rtl" className="text-center">
              <strong>{stop.city}</strong>
              <br />
              {stop.itemCount === 1
                ? "דבר אחד שבחרתם"
                : `${stop.itemCount} דברים שבחרתם`}
              {stop.nights > 0 && (
                <>
                  <br />
                  {stop.nights === 1 ? "לילה אחד" : `${stop.nights} לילות`}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
