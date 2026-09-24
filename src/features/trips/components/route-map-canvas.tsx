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
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BaseTiles, MapAutosize } from "./map-base";
import { routeBounds, type RoutePlace, type RouteStop } from "../domain/route";
import { cityToneMap, toneByIndex, type Tone } from "../domain/tone";
import { stopInk } from "./category-tile";

// Numbered pins, one colour per city, matching the chips and the schedule.
//
// A divIcon avoids Leaflet's default marker images, which don't survive
// bundling. The markup is built outside React's tree, so the .tone-* class
// cannot reach it — the palette variable is named directly instead.
//
// The pin is filled with the tone's *ink* rather than its dot: the dots are
// pale by design and a number on top of one is not readable at 32px. Ink is
// dark enough to carry white text while still saying which city this is.
//
// v5 ("מפה חיה") flattened that to one pin language: every stop is navigation
// blue with a white ring, and the city tone survives only on the small place
// dots. The number is set in the display face — the same face as the number
// beside the row in the panel — which is what lets a reader match the two
// without a legend. `live` is the city the traveller is in right now: amber,
// larger, with a soft halo.
//
// Pencil: 32px discs in a category ink with a 2.5px white ring, the number in
// white bold. The ink is dealt by stop order (stopInk in category-tile.tsx),
// and the drawer and the side pane colour their numbered dots from the same
// function — so pin 3 and row 3 are visibly one thing.
function numberedIcon(position: number, live = false) {
  const size = live ? "2.25rem" : "2rem";
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:${size};height:${size};border-radius:9999px;
      background:${live ? "var(--callout)" : `var(${stopInk(position).cssVar})`};
      color:${live ? "var(--foreground)" : "var(--surface)"};
      border:2.5px solid var(--surface);
      box-shadow:${live ? "0 0 0 8px rgba(245,158,11,0.25), " : ""}var(--elevation-lift);
      font-family:var(--font-rubik),sans-serif;font-weight:700;font-size:0.8125rem;
    ">${position}</div>`,
    iconSize: live ? [36, 36] : [32, 32],
    iconAnchor: live ? [18, 18] : [16, 16],
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
      background:var(--${tone}-dot);
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

// A day's places as numbered pins, fitted to their own bounds.
//
// The route's city discs frame a country; a day is a few streets, and
// routeBounds' city-level zoom stacked four museums a kilometre apart on one
// spot. So the day map fits the pins themselves, and refits when the day
// changes — MapContainer's `center` is read once at mount, the trap MapFocus
// describes. Room is left at the top for the card's floating pills.
export type DayPin = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

const PIN_PADDING_TOP_LEFT: [number, number] = [28, 56];
const PIN_PADDING_BOTTOM_RIGHT: [number, number] = [28, 20];

function fitPins(map: L.Map, points: [number, number][]) {
  const [first] = points;
  if (!first) return;
  if (points.length === 1) {
    map.setView(first, 15, { animate: false });
    return;
  }
  map.fitBounds(L.latLngBounds(points), {
    paddingTopLeft: PIN_PADDING_TOP_LEFT,
    paddingBottomRight: PIN_PADDING_BOTTOM_RIGHT,
    maxZoom: 16,
    animate: false,
  });
}

function pinPoints(pins: DayPin[]): [number, number][] {
  return pins.map((pin) => [pin.latitude, pin.longitude]);
}

// Keyed on a string of the positions rather than on the array, which the
// screen above rebuilds on every render — and read back from it, so the effect
// depends on exactly what it uses.
function FitPins({ signature }: { signature: string }) {
  const map = useMap();

  useEffect(() => {
    const points = signature
      .split("|")
      .filter(Boolean)
      .map((pair) => pair.split(",").map(Number) as [number, number]);
    fitPins(map, points);
  }, [map, signature]);

  return null;
}

function DayPinsMap({ pins }: { pins: DayPin[] }) {
  const line = pinPoints(pins);
  const [first] = line;
  if (!first) return null;

  return (
    <MapContainer
      center={first}
      zoom={14}
      scrollWheelZoom={false}
      // `isolate` for the reason RouteMapCanvas gives below at length.
      className="isolate h-full w-full"
    >
      <BaseTiles />
      {/* A map that mounted in a box of no width fitted to nothing; the first
          real size re-runs the fit. */}
      <MapAutosize refit={(map) => fitPins(map, line)} />
      <FitPins signature={line.map((point) => point.join(",")).join("|")} />

      {line.length > 1 && (
        <Polyline
          positions={line}
          pathOptions={{
            color: "var(--primary)",
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}

      {pins.map((pin, index) => (
        <Marker
          key={pin.id}
          position={[pin.latitude, pin.longitude]}
          icon={numberedIcon(index + 1)}
        >
          <Popup>
            <div dir="rtl" className="text-center">
              <strong>{pin.label}</strong>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function RouteMapCanvas({
  stops,
  places = [],
  focus = null,
  liveCity = null,
  interactive = false,
  pins,
}: {
  stops: RouteStop[];
  places?: RoutePlace[];
  // Where to fly to. Null leaves the map wherever the user left it.
  focus?: [number, number] | null;
  // The city whose pin is drawn live (amber). Null draws every pin the same.
  liveCity?: string | null;
  // Scroll-wheel zoom. Off inside a scrolling page, where the wheel is for
  // the page; on in the workspace, where the map is the screen.
  interactive?: boolean;
  // One day's places, numbered in timeline order. When given, the map draws
  // these instead of the route's cities — see DayPinsMap.
  pins?: DayPin[];
}) {
  if (pins) return <DayPinsMap pins={pins} />;

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
      scrollWheelZoom={interactive}
      // 🐞 `isolate` is the fix for the map covering the phone's bottom bar.
      //
      // Leaflet stacks its own layers with fixed z-indexes, and they are high:
      // panes 200–700, `.leaflet-control` 800, and `.leaflet-top`/`.leaflet-bottom`
      // — the control corners — **1000**. The bar is `fixed z-40`, so on the map
      // tab the map painted straight over it: no tab bar, and on a full-screen
      // map no way back to the rest of the app at all. Reported exactly that way.
      //
      // Isolating here rather than raising the bar's z-index, which is the same
      // argument one number higher and loses it again the next time Leaflet or a
      // dialog picks a bigger one. `isolation: isolate` makes this element a
      // stacking context, so every one of those internal z-indexes is contained
      // and the whole map competes with the page as a single `z-auto` box.
      //
      // On the canvas rather than at the three call sites, so the map tab, the
      // explore pane and the day card all get it.
      className="isolate h-full w-full"
    >
      <BaseTiles />

      {/* No refit: this map is handed an explicit centre and zoom, which do
          not depend on the size of the box, so re-measuring is all it needs. */}
      <MapAutosize />

      <MapFocus target={focus} />

      {line.length > 1 && (
        <Polyline
          positions={line}
          // Pencil draws the route as one solid teal stroke, not the dashed
          // line it was: the pins carry the colour, the line only joins them.
          pathOptions={{
            color: "var(--primary)",
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
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
          icon={numberedIcon(index + 1, stop.city === liveCity)}
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
