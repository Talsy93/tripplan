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

import { Fragment, useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
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
function tripDot(hue: string, focused: boolean) {
  const size = focused ? 1.375 : 0.75;
  const px = focused ? 22 : 12;
  return L.divIcon({
    className: "",
    // The focused trip's dots grow and everything else recedes. Two changes at
    // once — size and opacity — because either alone is too quiet at this
    // scale: a world map can put four trips inside one country, and a 2px
    // difference in diameter is not an answer to "which one am I looking at".
    html: `<div style="
      width:${size}rem;height:${size}rem;border-radius:9999px;
      background:${hue};
      border:${focused ? 3 : 2}px solid var(--surface);
      box-shadow:var(--elevation-lift);
      opacity:${focused ? 1 : 0.5};
      transition:opacity 250ms ease;
    "></div>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
}

// Flies the map to whichever trip the deck has centred.
//
// A child of MapContainer rather than a prop on it, for the reason
// route-map-canvas gives about its own MapFocus: `bounds` and `center` are read
// once at construction, and the only way to reach the live Leaflet instance
// afterwards is from inside the tree.
//
// Falls back to the full extent when nothing is focused, so the map opens
// showing everything and returns there rather than staying wherever the last
// card left it.
function DeckFocus({
  focus,
  all,
}: {
  focus: [number, number][] | null;
  all: L.LatLngBoundsExpression;
}) {
  const map = useMap();

  useEffect(() => {
    // Someone who asked for no motion gets the destination without the
    // journey. Leaflet animates by default and this is the one place in the
    // app where a viewport slides several thousand kilometres.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!focus || focus.length === 0) {
      map.flyToBounds(all, { padding: [24, 24], animate: !still, duration: 0.9 });
      return;
    }
    if (focus.length === 1) {
      map.flyTo(focus[0], Math.max(map.getZoom(), 5), {
        animate: !still,
        duration: 0.9,
      });
      return;
    }
    map.flyToBounds(L.latLngBounds(focus).pad(0.4), {
      animate: !still,
      duration: 0.9,
    });
  }, [focus, all, map]);

  return null;
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

export default function TripsMapCanvas({
  trips,
  focusedId = null,
}: {
  trips: MappedTrip[];
  // Which trip the deck has centred. Null means "show everything".
  focusedId?: string | null;
}) {
  const bounds = boundsOf(trips);
  if (!bounds) return null;

  const focused = trips.find((trip) => trip.id === focusedId) ?? null;
  const focusPoints =
    focused?.points.map((p): [number, number] => [p.latitude, p.longitude]) ??
    null;

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

      <DeckFocus focus={focusPoints} all={bounds} />

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
                weight: focusedId === trip.id ? 3 : 2,
                opacity:
                  focusedId === null ? 0.55 : focusedId === trip.id ? 0.9 : 0.25,
                dashArray: "4 6",
              }}
            />
          )}
          {trip.points.map((point) => (
            <Marker
              key={`${trip.id}|${point.city}`}
              position={[point.latitude, point.longitude]}
              icon={tripDot(trip.hue, focusedId === null || focusedId === trip.id)}
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
