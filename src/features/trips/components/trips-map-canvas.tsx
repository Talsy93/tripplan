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

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  useMap,
  useMapEvent,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryToneClasses } from "./category-tile";
import { BaseTiles, MapAutosize } from "./map-base";
import type { TripMapPlace } from "../domain/trip-map";

export type MappedTrip = {
  id: string;
  name: string;
  // The trip's resting hue, as a CSS value. Passed in rather than derived: the
  // home screen colours by standing (the trip being lived, the next one out,
  // the rest), which no single trip can work out on its own.
  hue: string;
  // The hue this trip wears while it is the selected one. Separate from `hue`
  // because most trips rest in grey — selecting one has to be able to bring a
  // colour that its resting state does not have.
  activeHue: string;
  // Its place in the panel's list, 1-based. Drawn on the flag only while the
  // trip is selected: one number on the map matching one row is an answer,
  // while every trip's number at once is the collision the flags were chosen
  // to avoid — two trips both starting at "1".
  position: number;
  points: { city: string; latitude: number; longitude: number }[];
  // The home plants one named pill per trip instead of a flag per city (see
  // tripPill). `standing` turns it on; the pill's dot says the standing, so
  // `hue` then only colours the line and the other cities' dots.
  standing?: PinStanding;
  // No longer drawn — the Pencil pins carry no flags — but kept on the type so
  // callers that pass it keep compiling.
  countryCode?: string | null;
};

export type PinStanding = "live" | "next" | "draft" | "past";

// One trip "opened" on the map — the home's second tap on a trip. Its saved
// places, and its cities: a city marker stands for every city, so a trip whose
// places were never located still shows where it goes.
export type OpenedTrip = {
  tripId: string;
  places: TripMapPlace[];
  cities: { city: string; latitude: number; longitude: number }[];
};

// The home pins of the Pencil design (design/pencil/exports/home-desktop): a
// white pill per trip with a dot and the trip name. The dot says the standing
// — terracotta for the trip being lived or the next one out, green for one
// already taken, grey for an idea — so the pill reads without a legend. The
// Stitch discs carried a flag image here; the design has no flags.
const PILL_DOT: Record<PinStanding, string> = {
  live: "var(--cta)",
  next: "var(--cta)",
  draft: "var(--outline)",
  past: "var(--success)",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function tripPill(
  name: string,
  standing: PinStanding,
  { selected, dimmed }: { selected: boolean; dimmed: boolean },
): L.DivIcon {
  const ring = selected
    ? "box-shadow:0 0 0 2px var(--primary),var(--elevation-lift);"
    : "box-shadow:var(--elevation-card);";
  const live =
    standing === "live"
      ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${PILL_DOT.live};opacity:.35;animation:ping 1.4s cubic-bezier(0,0,.2,1) infinite"></span>`
      : "";
  // A zero-size icon with the pill centred on it by transform: the pill is as
  // wide as the name, which Leaflet cannot know in advance.
  return L.divIcon({
    className: "",
    html: `<div dir="rtl" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%)${selected ? " scale(1.08)" : ""};display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:9999px;background:var(--surface);${ring}white-space:nowrap;font:600 13px/1 var(--font-sans),system-ui;color:var(--foreground);transition:transform .15s;${dimmed ? "opacity:.45;" : ""}">
      <span style="position:relative;width:9px;height:9px;flex:none;border-radius:9999px;background:${PILL_DOT[standing]}">${live}</span>
      <span style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(name)}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// The other cities of a disc trip: a small dot in the line's colour, so the
// trip keeps its shape without a second flag competing with the first.
function cityDot(hue: string, dimmed: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:10px;height:10px;border-radius:9999px;background:${hue};box-shadow:0 0 0 2px #fff;${dimmed ? "opacity:.4" : ""}"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

// A flag planted at each city — the pole's foot is the coordinate. A dot said
// "something is here"; a flag says "we were / will be here", which is what a
// map of your trips is about, and it reads from across the room.
//
// Three states, because the map now has to answer "which of these is the one I
// just tapped": resting (what it has always drawn), selected (larger, in the
// trip's active hue, carrying its number and a halo at the foot), and dimmed —
// everything that is not the selection while there is one.
//
// The number sits in a white disc rather than straight on the banner. The
// banner is blue for one trip and amber for another, and no single ink stays
// readable on both; a disc makes the contrast the same everywhere and costs a
// little of the colour, which the halo and the line give back.
function tripFlag(
  hue: string,
  {
    selected,
    dimmed,
    position,
  }: { selected: boolean; dimmed: boolean; position: number },
): L.DivIcon {
  const shadow = "filter:drop-shadow(0 2px 3px rgba(12,20,36,.35))";

  if (selected) {
    return L.divIcon({
      className: "",
      html: `<svg width="36" height="42" viewBox="0 0 36 42" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;${shadow}">
        <circle cx="8" cy="39" r="9" fill="${hue}" opacity="0.22"/>
        <path d="M8 3 L8 40" stroke="var(--foreground)" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M9 4 H33 L28 13 L33 22 H9 Z" fill="${hue}" stroke="var(--surface)" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="19" cy="13" r="6.6" fill="var(--surface)"/>
        <text x="19" y="13" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="var(--foreground)" style="font-family:var(--font-display),system-ui">${position}</text>
        <circle cx="8" cy="40" r="2.4" fill="var(--foreground)"/>
      </svg>`,
      iconSize: [36, 42],
      iconAnchor: [8, 40],
    });
  }

  return L.divIcon({
    className: "",
    html: `<svg width="26" height="30" viewBox="0 0 26 30" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;${shadow}${dimmed ? ";opacity:.4" : ""}">
      <path d="M6 2 L6 29" stroke="var(--foreground)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M7 3 H23 L19 9.5 L23 16 H7 Z" fill="${hue}" stroke="var(--surface)" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="6" cy="29" r="2.2" fill="var(--foreground)"/>
    </svg>`,
    iconSize: [26, 30],
    iconAnchor: [6, 29],
  });
}

// Fits every point on screen at once.
//
// Deliberately not routeBounds: that one is built for a single trip's stops and
// picks a zoom from their span, which at world scale — Prague, Tokyo and Rome
// in one view — would need a different curve anyway. Leaflet's own `bounds`
// prop does the fitting properly, including across the antimeridian, and this
// map never needs to know the number it chose.
function boundsOf(trips: MappedTrip[]): L.LatLngBounds | null {
  const all = trips.flatMap((trip) =>
    trip.points.map((p): [number, number] => [p.latitude, p.longitude]),
  );
  if (all.length === 0) return null;
  return L.latLngBounds(all).pad(0.25);
}

// A trip with one city gives bounds of zero size, and fitting those asks for
// the deepest zoom the tiles have — a street corner in Kyoto, which is not
// where a trip is. Every fit here is capped.
const MAX_FIT_ZOOM = 9;
const EDGE = 24;

// The panel is not a window onto the map, it sits on top of it — a column over
// one side from lg up, a sheet over the bottom below it. A fit that centres a
// trip in the map's *box* therefore centres it under the panel: on a phone the
// flag you just asked to see ends up behind the sheet, and the map looks like
// it ignored you. So every fit is told which part of its box is covered.
//
// Leaflet works in screen pixels, so `insetLeft` is the literal left edge —
// which is where the panel is, because the document is RTL and the sheet is
// pinned to its `end`.
// The most of a dimension the panel is ever allowed to claim. Padding that
// comes out wider than the map leaves Leaflet a negative viewport to fit into,
// and what it returns for that is NaN — which surfaces as "Invalid LatLng
// object: (NaN, NaN)" from somewhere else entirely. The clamp is the fix, and
// half is also the point at which a fit stops being useful anyway.
const MAX_INSET_SHARE = 0.5;

function fitOptions(
  map: L.Map | null,
  insetLeft: number,
  insetBottomShare: number,
  maxZoom: number = MAX_FIT_ZOOM,
): L.FitBoundsOptions {
  // No map yet — the view MapContainer is built with. The insets are left out
  // rather than guessed at, because there is no size here to clamp them
  // against; MapAutosize refits with the real ones on the first measurement.
  if (!map) return { maxZoom, padding: [EDGE, EDGE] };

  const size = map.getSize();
  const left = Math.min(insetLeft, size.x * MAX_INSET_SHARE);
  const bottom = size.y * Math.min(insetBottomShare, MAX_INSET_SHARE);

  return {
    maxZoom,
    paddingTopLeft: [EDGE + Math.round(left), EDGE],
    paddingBottomRight: [EDGE, EDGE + Math.round(bottom)],
  };
}

// Flies the view to whatever is in focus: the selected trip, or all of them
// once the selection is cleared.
//
// Skips the first run. The map's opening view already came from these bounds
// (MapContainer's `bounds` prop), so flying to them on mount would be a swoop
// from the view to itself.
//
// The fly waits a frame and re-measures first: opening a trip also makes the
// home's map taller, and a fit computed against the old height would land the
// destinations under the preview card.
function MapFocus({
  bounds,
  insetLeft,
  insetBottomShare,
  maxZoom,
}: {
  bounds: L.LatLngBounds;
  insetLeft: number;
  insetBottomShare: number;
  maxZoom: number;
}) {
  const map = useMap();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      map.flyToBounds(bounds, {
        duration: 0.8,
        ...fitOptions(map, insetLeft, insetBottomShare, maxZoom),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, bounds, insetLeft, insetBottomShare, maxZoom]);

  return null;
}

// Pan and zoom, switched after the map exists. MapContainer reads its handler
// props once, at creation, so a map that starts still and becomes explorable —
// the home map, once a trip is opened on it — has to flip them by hand.
//
// The wheel stays off even then: the map sits in a page that scrolls, and the
// zoom buttons and a pinch are the ways in.
function MapInteractivity({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    const handlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
    ];
    if (!enabled) return;
    for (const handler of handlers) handler?.enable();
    const zoom = L.control.zoom({
      position: "topleft",
      zoomInTitle: "התקרבות",
      zoomOutTitle: "התרחקות",
    });
    zoom.addTo(map);
    return () => {
      zoom.remove();
      for (const handler of handlers) handler?.disable();
    };
  }, [map, enabled]);
  return null;
}

// ---- an opened trip: its destinations ------------------------------------

// Names appear only once there is room for them. A place label at country
// scale is a pile of overlapping pills; a city name is useful much earlier.
const PLACE_LABEL_ZOOM = 13;
const CITY_LABEL_ZOOM = 5;
// Deep enough to tell two places on one street apart when a trip is a single
// neighbourhood; the world view keeps its own, much lower, cap.
const OPENED_MAX_ZOOM = 15;

// The category's ink, from the mapping the category tiles use (category-tile)
// rather than a copy of it: the tone class is already in the stylesheet
// because those tiles use it, and the dot paints with `currentColor`. A
// category neither vocabulary knows — or none, a destination chosen in
// planning mode — gets the brand teal rather than the neutral grey.
const UNKNOWN_TONE = categoryToneClasses("");
function toneClass(category: string | null): string | null {
  const classes = categoryToneClasses(category ?? "");
  return classes === UNKNOWN_TONE ? null : classes;
}

// A white pill above the dot. Zero-size icons with absolutely placed content,
// like tripPill: the label is as wide as the name, which Leaflet cannot know.
function labelPill(text: string, bold: boolean): string {
  return `<span dir="auto" style="position:absolute;left:50%;bottom:10px;transform:translateX(-50%);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 8px;border-radius:9999px;background:var(--surface);box-shadow:var(--elevation-card);font:${bold ? 700 : 600} ${bold ? 12 : 11}px/1.25 var(--font-sans),system-ui;color:var(--foreground)">${escapeHtml(text)}</span>`;
}

function placeMarker(place: TripMapPlace, showLabel: boolean): L.DivIcon {
  const tone = toneClass(place.category);
  const fill = tone ? "currentColor" : "var(--primary)";
  return L.divIcon({
    className: "",
    // The tone class also sets a tint background; the wrapper has no size, so
    // only its colour (the ink) reaches the dot.
    html: `<span class="${tone ?? ""}" style="position:absolute;left:0;top:0;width:0;height:0">
      <span style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:9999px;background:${fill};box-shadow:0 0 0 2px #fff,0 1px 3px rgba(12,20,36,.35)"></span>
      ${showLabel ? labelPill(place.name, false) : ""}
    </span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function cityMarker(city: string, showLabel: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="position:absolute;left:0;top:0;width:0;height:0">
      <span style="position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:9999px;background:var(--primary);box-shadow:0 0 0 3px #fff,0 1px 4px rgba(12,20,36,.4)"></span>
      ${showLabel ? labelPill(city, true) : ""}
    </span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function boundsOfOpened(opened: OpenedTrip): L.LatLngBounds | null {
  const all: [number, number][] = [
    ...opened.places.map((p): [number, number] => [p.latitude, p.longitude]),
    ...opened.cities.map((c): [number, number] => [c.latitude, c.longitude]),
  ];
  if (all.length === 0) return null;
  return L.latLngBounds(all).pad(0.15);
}

function OpenedTripLayer({ opened }: { opened: OpenedTrip }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvent("zoomend", () => setZoom(map.getZoom()));

  const placeLabels = zoom >= PLACE_LABEL_ZOOM;
  // A city's name gives way to its places' names once those are showing — the
  // city dot sits among them and its pill would cover theirs.
  const citiesWithPlaces = useMemo(
    () => new Set(opened.places.map((place) => place.city)),
    [opened.places],
  );

  return (
    <>
      {opened.cities.length > 1 && (
        <Polyline
          positions={opened.cities.map((c): [number, number] => [
            c.latitude,
            c.longitude,
          ])}
          pathOptions={{
            color: "var(--primary)",
            weight: 2,
            opacity: 0.5,
            dashArray: "4 6",
          }}
        />
      )}
      {opened.cities.map((city) => (
        <Marker
          key={`city|${city.city}`}
          position={[city.latitude, city.longitude]}
          icon={cityMarker(
            city.city,
            zoom >= CITY_LABEL_ZOOM &&
              !(placeLabels && citiesWithPlaces.has(city.city)),
          )}
          interactive={false}
          keyboard={false}
          alt=""
        />
      ))}
      {opened.places.map((place, index) => (
        <Marker
          key={`place|${index}|${place.name}`}
          position={[place.latitude, place.longitude]}
          icon={placeMarker(place, placeLabels)}
          // Above the city dots, so a place on the city's centre stays visible.
          zIndexOffset={500}
          // A hover name at any zoom for the desktop; the label is the phone's.
          title={place.name}
          keyboard={false}
          alt=""
        />
      ))}
    </>
  );
}

// A tap on the map itself, away from any flag, clears the selection. Leaflet
// stops a marker's click from reaching the map, so this only ever fires on
// empty land and sea.
function MapClickAway({ onClear }: { onClear: () => void }) {
  useMapEvent("click", onClear);
  return null;
}

export default function TripsMapCanvas({
  trips,
  // Pan and zoom. Off inside a card in a scrolling page; on when the map is
  // the screen (the v5 home).
  interactive = false,
  // The trip the panel beside the map is pointing at, or null. Drives the
  // colour of every flag on the map, and the view itself.
  selectedId = null,
  // Where the view goes when nothing is selected — the home map opens on the
  // trip its preview card names, as the export does, without dimming the rest.
  focusId = null,
  // Present when the map is allowed to answer back: flags become clickable and
  // empty map clears the selection. Absent — the compact world map inside a
  // scrolling page — and the map stays the still picture it has always been.
  onSelect,
  // How much of the map's box the panel over it is covering: a fixed column on
  // the left in px, and a share of the height at the bottom (the sheet's snap
  // point is a share of the screen, so a share is what it honestly is). Zero
  // for a map with nothing on top of it.
  insetLeft = 0,
  insetBottomShare = 0,
  // A trip opened on the map (the home's second tap): its destinations replace
  // every trip pin, the view fits them at street depth, names appear as the map
  // zooms in, and a still map becomes one you can pan and zoom.
  opened = null,
}: {
  trips: MappedTrip[];
  interactive?: boolean;
  selectedId?: string | null;
  focusId?: string | null;
  onSelect?: (id: string | null) => void;
  insetLeft?: number;
  insetBottomShare?: number;
  opened?: OpenedTrip | null;
}) {
  const openedBounds = useMemo(
    () => (opened ? boundsOfOpened(opened) : null),
    [opened],
  );
  // A trip whose cities were never located can still open, when its places
  // carry their own coordinates — so the opened trip alone is enough to draw.
  const bounds = useMemo(
    () => boundsOf(trips) ?? openedBounds,
    [trips, openedBounds],
  );

  // What the view should be showing. A selected trip with no located city is
  // not a focus — there is nothing to fly to — so the map holds still on
  // everything and the panel is what says why.
  const focus = useMemo(() => {
    if (openedBounds) return openedBounds;
    const target = trips.find((trip) => trip.id === (selectedId ?? focusId));
    return (target ? boundsOf([target]) : bounds) ?? bounds;
  }, [trips, selectedId, focusId, bounds, openedBounds]);
  const maxZoom = openedBounds ? OPENED_MAX_ZOOM : MAX_FIT_ZOOM;
  const showTrips = !opened;

  if (!bounds || !focus) return null;

  return (
    <MapContainer
      bounds={bounds}
      // The opening view is the same fit as every later one, panel and all.
      // `map` is null here — there is no map yet to measure — so the bottom
      // inset starts at zero and MapAutosize's first real measurement is what
      // puts it in.
      boundsOptions={fitOptions(null, insetLeft, insetBottomShare)}
      // Still, for the reason the hero's map is still: this sits in a page that
      // scrolls vertically, and a draggable map inside one takes every swipe
      // that was meant for the page. The legend beside it is what you click.
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      scrollWheelZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      zoomControl={interactive}
      // `isolate` for the same reason route-map-canvas gives: Leaflet's internal
      // z-indexes go up to 1000, and without a stacking context of its own this
      // map would paint over the phone's fixed navigation bar.
      className="isolate h-full w-full"
    >
      <BaseTiles />

      {/* Refit, unlike the route map: this one's view *is* the bounds, and
          Leaflet picked the zoom from whatever width the box had at mount. A
          world map that came up in a box of 40px fitted every trip into one
          tile and stayed there.

          It refits to `focus` rather than to everything, so a box that settles
          late cannot throw away a selection already made. */}
      <MapAutosize
        refit={(map) =>
          map.fitBounds(
            focus,
            fitOptions(map, insetLeft, insetBottomShare, maxZoom),
          )
        }
      />
      <MapFocus
        bounds={focus}
        insetLeft={insetLeft}
        insetBottomShare={insetBottomShare}
        maxZoom={maxZoom}
      />
      {/* Only a map that started still needs switching; one built interactive
          already has its handlers and its zoom buttons. */}
      <MapInteractivity enabled={!interactive && Boolean(opened)} />
      {/* No click-away while a trip is open: that map is being explored, and a
          tap between two places is not a request to leave it. */}
      {onSelect && !opened && <MapClickAway onClear={() => onSelect(null)} />}
      {opened && <OpenedTripLayer opened={opened} />}

      {showTrips && trips.map((trip) => {
        const selected = trip.id === selectedId;
        const dimmed = selectedId !== null && !selected;
        const hue = selected ? trip.activeHue : trip.hue;

        return (
          // A Fragment, not a div: react-leaflet children attach themselves to the
          // map through context, so a wrapper element would add a stray node to
          // the map pane without grouping anything.
          <Fragment key={trip.id}>
            {/* One faint line per trip, joining only its own cities. Thin and
                low-opacity: at world scale several routes at the route map's
                weight would read as a scribble over the continents. The
                selected one goes solid and opaque — that line is the shape of
                the trip, and the shape is what the tap asked to see. */}
            {trip.points.length > 1 && (
              <Polyline
                positions={trip.points.map((p): [number, number] => [
                  p.latitude,
                  p.longitude,
                ])}
                pathOptions={{
                  color: hue,
                  weight: selected ? 3 : 2,
                  opacity: selected ? 0.9 : dimmed ? 0.18 : 0.55,
                  dashArray: selected ? undefined : "4 6",
                }}
              />
            )}
            {trip.points.map((point, index) => (
              <Marker
                key={`${trip.id}|${point.city}`}
                position={[point.latitude, point.longitude]}
                icon={
                  trip.standing
                    ? index === 0
                      ? tripPill(trip.name, trip.standing, { selected, dimmed })
                      : cityDot(hue, dimmed)
                    : tripFlag(hue, {
                        selected,
                        dimmed,
                        position: trip.position,
                      })
                }
                interactive={Boolean(onSelect)}
                eventHandlers={
                  onSelect ? { click: () => onSelect(trip.id) } : undefined
                }
                // The selected trip's flags belong above everyone else's, or a
                // grey one drawn later covers the answer.
                zIndexOffset={selected ? 1000 : 0}
                // Not in the tab order, even when clickable. There are as many
                // flags as there are cities across every trip, and tabbing
                // through all of them to reach the panel would be a trap; the
                // panel's rows are the keyboard path to the same selection.
                keyboard={false}
                title={onSelect ? trip.name : undefined}
                // The map is decoration for a list that already names everything.
                // Announcing every pin would read the same trips out twice.
                alt=""
              />
            ))}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
