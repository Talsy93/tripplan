"use client";

// What every map in the app shares: the tiles under it, and the two habits of
// Leaflet that make a map "sometimes not load properly".
//
// Both are the same class of problem — Leaflet measures and fetches once and
// never looks again — and both are fixed here rather than at each canvas, so
// the route map and the world map behave the same way.

import { useEffect, useRef } from "react";
import type L from "leaflet";
import { TileLayer, useMap } from "react-leaflet";

// OpenStreetMap: free and keyless, the project rule everywhere else too.
// Attribution is required by their tile usage policy.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// A tile that fails is a hole in the map, forever.
//
// Leaflet asks for each tile exactly once. When a request is dropped — a phone
// coming back from sleep, a flaky café network, OSM shedding load — the <img>
// errors, Leaflet marks the tile done and moves on, and that square stays
// blank until something else makes the map re-request it. That is what "the
// map doesn't always load" looks like: most of the world, with grey rectangles
// in it, which a reload fixes.
//
// So: re-request a failed tile, twice, backing off. Re-assigning the same src
// is not reliably a new request, so the element is pointed at a blank pixel
// first and then back at the tile.
const TILE_RETRIES = 2;
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type RetryingTile = HTMLImageElement & { _retries?: number };

function retryTile(event: L.TileErrorEvent) {
  const tile = event.tile as RetryingTile;
  const attempts = tile._retries ?? 0;
  if (attempts >= TILE_RETRIES) return;
  tile._retries = attempts + 1;

  const url = tile.src;
  tile.src = BLANK;
  window.setTimeout(() => {
    // The tile may have been panned out of the map by now and detached.
    if (tile.isConnected) tile.src = url;
  }, 600 * (attempts + 1));
}

export function BaseTiles() {
  return (
    <TileLayer
      attribution={TILE_ATTRIBUTION}
      url={TILE_URL}
      eventHandlers={{ tileerror: retryTile }}
    />
  );
}

// Below this, in either direction, the box is not a map anyone is looking at —
// it is the folded strip of the side pane, or a container the layout has not
// given a size to yet.
const DEGENERATE = 80;

/**
 * Keeps the map the size of the box it is in.
 *
 * Leaflet reads its container's size when it starts and then only on a window
 * `resize`. Every map in this app lives in a box that changes without the
 * window changing: the trip's map pane folds from 26rem to 44px and back, the
 * phone's sheet slides over it, and both canvases mount inside a layout that
 * is still settling. Leaflet keeps the old number, so it draws and fetches
 * tiles for a map that is no longer there — a correct-looking patch of map
 * with grey around it, until you happen to resize the window.
 *
 * A ResizeObserver on the container is the whole answer: the box reports its
 * own changes, including every frame of the pane's width transition.
 *
 * `refit` is for the other half of it. A map that came up inside a box of no
 * width fitted its pins to nothing, and `invalidateSize` alone keeps that
 * wrong view — it preserves the centre, which is the right thing when the map
 * was already readable. So the first real size after a degenerate one re-runs
 * the caller's fit. Only maps whose view is size-dependent (bounds) need it;
 * a map given an explicit centre and zoom is already correct.
 */
export function MapAutosize({ refit }: { refit?: (map: L.Map) => void }) {
  const map = useMap();

  // Held in a ref so a caller can pass an inline arrow without re-subscribing
  // the observer on every render. Written in an effect of its own, which runs
  // before the one below on mount and after every later render.
  const refitRef = useRef(refit);
  useEffect(() => {
    refitRef.current = refit;
  }, [refit]);

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    // Whether the map has been measured at a size worth drawing. Starts false
    // so the first measurement counts as the arrival of a real size.
    let sized = false;

    const measure = () => {
      frame = 0;
      const { width, height } = container.getBoundingClientRect();
      // Hidden, not resized — `display:none` somewhere above. Measuring zero
      // would only teach Leaflet a size it has to unlearn.
      if (width === 0 || height === 0) return;

      map.invalidateSize({ animate: false });

      const real = width >= DEGENERATE && height >= DEGENERATE;
      if (real && !sized) refitRef.current?.(map);
      sized = real;
    };

    const observer = new ResizeObserver(() => {
      // Coalesced to one measurement a frame. The pane's fold fires this
      // observer on every frame of a 250ms transition, and invalidateSize
      // walks the tile grid each time.
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [map]);

  return null;
}
