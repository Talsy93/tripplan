"use client";

// Every trip on one map. Loaded in the browser only, like the route canvas —
// Leaflet touches `window` at import time.
//
// A separate canvas from route-map-canvas.tsx rather than a mode on it, and the
// reason is the line. That component draws *one* trip: a numbered sequence of
// cities joined in visiting order, which is exactly what a route is. Passing it
// several trips' cities would join Prague to Tokyo because they happen to be
// adjacent in an array — a line that asserts a journey nobody took. The two
// components answer different questions and only share a library.
//
// Tiles come from OpenStreetMap, free and keyless, the same as everywhere else
// in this app. Attribution is required by their usage policy.

import { Fragment } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MappedTrip = {
  id: string;
  name: string;
  // The trip's lead aura hue, as a CSS value — `var(--aura-ember-1)` and so on.
  // Passed in rather than derived: the palette is assigned across the whole
  // screen at once (see domain/aura.ts), so no single trip can work out on its
  // own which colour it ended up with.
  hue: string;
  points: { city: string; latitude: number; longitude: number }[];
};

// A disc, not a numbered pin.
//
// The route map numbers its pins because the order is the information there.
// Here the order within a trip is not the point and the numbers of two
// different trips would collide at "1" — so the colour carries the identity and
// the legend beside the map carries the names.
//
// No text inside, which also sidesteps a contrast problem rather than losing to
// it: the aura leads run from #4fe0cc to #ffd75e, and there is no single ink
// that stays readable on all eight.
function tripDot(hue: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:0.875rem;height:0.875rem;border-radius:9999px;
      background:${hue};
      border:3px solid var(--surface);
      box-shadow:var(--elevation-lift);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Fits every point on screen at once.
//
// Deliberately not routeBounds: that one is built for a single trip's stops and
// picks a zoom from their span, which at world scale — Prague, Tokyo and Rome
// in one view — would need a different curve anyway. Leaflet's own `bounds`
// prop does the fitting properly, including across the antimeridian, and this
// map never needs to know the number it chose.
function boundsOf(trips: MappedTrip[]): L.LatLngBoundsExpression | null {
  const all = trips.flatMap((trip) =>
    trip.points.map((p): [number, number] => [p.latitude, p.longitude]),
  );
  if (all.length === 0) return null;
  return L.latLngBounds(all).pad(0.25);
}

export default function TripsMapCanvas({ trips }: { trips: MappedTrip[] }) {
  const bounds = boundsOf(trips);
  if (!bounds) return null;

  return (
    <MapContainer
      bounds={bounds}
      // Still, for the reason the hero's map is still: this sits in a page that
      // scrolls vertically, and a draggable map inside one takes every swipe
      // that was meant for the page. The legend beside it is what you click.
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      // `isolate` for the same reason route-map-canvas gives: Leaflet's internal
      // z-indexes go up to 1000, and without a stacking context of its own this
      // map would paint over the phone's fixed navigation bar.
      className="isolate h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {trips.map((trip) => (
        // A Fragment, not a div: react-leaflet children attach themselves to the
        // map through context, so a wrapper element would add a stray node to
        // the map pane without grouping anything.
        <Fragment key={trip.id}>
          {/* One faint line per trip, joining only its own cities. Thin and
              low-opacity: at world scale several routes at the route map's
              weight would read as a scribble over the continents. */}
          {trip.points.length > 1 && (
            <Polyline
              positions={trip.points.map((p): [number, number] => [
                p.latitude,
                p.longitude,
              ])}
              pathOptions={{
                color: trip.hue,
                weight: 2,
                opacity: 0.55,
                dashArray: "4 6",
              }}
            />
          )}
          {trip.points.map((point) => (
            <Marker
              key={`${trip.id}|${point.city}`}
              position={[point.latitude, point.longitude]}
              icon={tripDot(trip.hue)}
              interactive={false}
              // The map is decoration for a list that already names everything.
              // Announcing every pin would read the same trips out twice.
              alt=""
            />
          ))}
        </Fragment>
      ))}
    </MapContainer>
  );
}
