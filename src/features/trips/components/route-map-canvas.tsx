"use client";

// The Leaflet map itself. Loaded only in the browser (see route-map.tsx),
// because Leaflet touches `window` at import time.
//
// Tiles come from OpenStreetMap — free, no API key (project rule: no paid
// services). Attribution is required by their tile usage policy.

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { routeBounds, type RoutePlace, type RouteStop } from "../domain/route";
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

// A place, as opposed to a city. Small and unnumbered on purpose: it is not a
// stop on the route, and giving it the same 32px numbered disc as a city would
// make a trip with twelve restaurants unreadable.
//
// These are the map's *accurate* pins — straight from OpenStreetMap, never
// geocoded from a name — so they are drawn on top of the city discs.
function placeIcon(tone: Tone) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:0.75rem;height:0.75rem;border-radius:9999px;
      background:var(--${tone}-ink);
      border:2px solid var(--surface);
      box-shadow:var(--elevation-soft);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

// Moves the map when the chips above it pick a city.
//
// A child of MapContainer rather than a prop on it, because that is the only
// way to reach the Leaflet instance: MapContainer's own `center` is read once
// at mount and ignored afterwards, so re-rendering it with a new centre does
// nothing at all. useMap() is react-leaflet's answer and this is the whole of
// it.
function MapFocus({ target }: { target: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    // flyTo rather than setView: the chips are a way of looking around one
    // route, and an instant jump between two cities loses which direction you
    // just went. 1.1s is Leaflet's default and reads as deliberate rather than
    // slow.
    map.flyTo(target, Math.max(map.getZoom(), 9), { duration: 1.1 });
  }, [map, target]);

  return null;
}

export default function RouteMapCanvas({
  stops,
  places = [],
  focus = null,
}: {
  stops: RouteStop[];
  places?: RoutePlace[];
  // Where to fly to. Null leaves the map wherever the user left it.
  focus?: [number, number] | null;
}) {
  // Bounds are computed from the cities alone. The places sit inside them by
  // definition, and including them would let one mis-tagged point zoom the
  // whole map out to fit it.
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

      <MapFocus target={focus} />

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

      {/* Places first, so a city's numbered disc always draws over them and
          stays the thing you can read at a glance. */}
      {places.map((place) => (
        <Marker
          key={`${place.city}|${place.name}`}
          position={[place.latitude, place.longitude]}
          icon={placeIcon(tones.get(place.city) ?? toneByIndex(0))}
        >
          <Popup>
            <div dir="rtl" className="text-center">
              <strong>{place.name}</strong>
              {place.city && (
                <>
                  <br />
                  {place.city}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

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
