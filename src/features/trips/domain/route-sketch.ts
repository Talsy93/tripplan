import type { RouteStop } from "./route";

// Turning a trip's coordinates into a drawing.
//
// The hero used to show real OpenStreetMap tiles. It was reported, fairly, as
// the wrong thing: "that's actually the picture from the map, and what you
// proposed was a drawing". The proposal *was* a drawing, because an artifact
// cannot render tiles — so the mockup set an expectation the build did not
// keep.
//
// Correcting it turned out to be the better design rather than a compromise,
// because the two maps in this app are answering different questions:
//
//   the all-trips map   is information. You are asking how far Prague is from
//                       Tokyo, and real geography is the whole point.
//   the hero            is atmosphere. It sits behind a countdown and a name,
//                       and every road, label and town in a real tile is
//                       competing with them for the same rectangle.
//
// So this projects the stops itself and the hero draws them over the trip's own
// light. No tiles, no labels, no Leaflet, and no network request at all — which
// also settles the performance cost that was flagged twice while building the
// tiled version.

export type SketchPoint = { city: string; x: number; y: number };

export type RouteSketch = {
  points: SketchPoint[];
  // The polyline through every point, as an SVG path. Empty for a single stop,
  // which has no line to draw.
  path: string;
  viewBox: string;
};

// Web Mercator, normalised to the unit square.
//
// The same projection every slippy map uses, so the drawn shape of a route
// matches the shape of it on the real map tab — a trip that looks like a hook
// there does not look like a straight line here.
//
// Latitude is clamped to ±85.05°, Mercator's own limit: the transform goes to
// infinity at the poles, and one bad coordinate would otherwise collapse every
// other point to a line.
function project(latitude: number, longitude: number): { x: number; y: number } {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (lat * Math.PI) / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

// How much of the box is left as margin on the tighter axis. The route should
// read as a shape with air around it, not as something pressed to the edges.
const PADDING = 0.14;

// Fits the stops into a box, keeping the route's real proportions.
//
// The scale is the *smaller* of the two axes' fits, not each axis independently
// — stretching each to fill would turn a north-south trip into a wide one and a
// two-city hop into a full-width line. A trip's shape is the only thing this
// drawing carries, so distorting it would leave it carrying nothing.
//
// Returns null when there is nothing to draw, which the caller reads as "show
// the light alone".
export function sketchRoute(
  stops: RouteStop[],
  width = 720,
  height = 280,
): RouteSketch | null {
  if (stops.length === 0) return null;

  const projected = stops.map((stop) => ({
    city: stop.city,
    ...project(stop.latitude, stop.longitude),
  }));

  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);

  const boxW = width * (1 - PADDING * 2);
  const boxH = height * (1 - PADDING * 2);

  // A single stop, or several in the same place, has no span to scale by. Any
  // finite number works; 1 keeps the arithmetic below unchanged and the point
  // lands in the centre.
  const scale =
    spanX === 0 && spanY === 0
      ? 1
      : Math.min(
          spanX === 0 ? Infinity : boxW / spanX,
          spanY === 0 ? Infinity : boxH / spanY,
        );

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  const points: SketchPoint[] = projected.map((p) => ({
    city: p.city,
    x: offsetX + (p.x - Math.min(...xs)) * scale,
    y: offsetY + (p.y - Math.min(...ys)) * scale,
  }));

  const path =
    points.length > 1
      ? points
          .map(
            (p, index) =>
              `${index === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
          )
          .join(" ")
      : "";

  return { points, path, viewBox: `0 0 ${width} ${height}` };
}
