import { sketchRoute } from "../domain/route-sketch";
import type { RouteStop } from "../domain/route";

// The trip's route, drawn over its own light.
//
// This replaced a real tiled map in the hero. The tiles were reported as the
// wrong thing — "that's the actual picture from the map, what you proposed was
// a drawing" — and the drawing turned out to be the better answer rather than
// the cheaper one. See domain/route-sketch.ts for why the two maps in this app
// want opposite treatments.
//
// A server component, and that is most of the win. The tiled version needed
// Leaflet, a dynamic import, a client boundary and a dozen tile requests behind
// the first screen of the app. This is markup: the projection runs on the
// server, the SVG arrives in the HTML, and the home screen makes no map request
// at all.
//
// The graticule is real. Those are lines of constant latitude and longitude at
// the drawing's own scale, not decoration invented to look map-like — which is
// what lets the piece read as a map without a coastline anywhere on it. Faking
// landmasses was the alternative and it would have been drawing a coast that is
// not there.
export function HeroRouteSketch({ stops }: { stops: RouteStop[] }) {
  const sketch = sketchRoute(stops);
  if (!sketch) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* The graticule is CSS, not part of the SVG, and that split is load
          bearing. The route has to be drawn with `meet` so none of it is ever
          cropped — it is the content. A grid drawn in the same viewBox would
          then be letter-boxed with it and float in the middle of the hero
          instead of reaching the edges. Two repeating gradients fill any aspect
          exactly, which is the one thing SVG cannot do here. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.11) 0 1px, transparent 1px 70px), repeating-linear-gradient(to right, rgb(255 255 255 / 0.11) 0 1px, transparent 1px 96px)",
        }}
      />

      <svg
        viewBox={sketch.viewBox}
        // `meet`, not `slice`. The route is the content, and slice crops it: the
        // sketch box is 720x280 and the hero at lg is 1232x208, so covering would
        // scale the drawing to 479px tall and throw away well over half of it —
        // measured, with two of three cities off-frame.
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {sketch.path && (
          <>
            {/* Drawn twice: a soft wide stroke under a crisp dashed one. The
              halo is what keeps the line readable wherever it crosses a bright
              part of the light, without darkening the light itself. */}
            <path
              d={sketch.path}
              fill="none"
              stroke="rgb(20 28 58 / 0.35)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={sketch.path}
              fill="none"
              stroke="rgb(255 255 255 / 0.9)"
              strokeWidth="2.5"
              strokeDasharray="1 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {sketch.points.map((point, index) => (
          <g key={`${point.city}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="11"
              fill="rgb(20 28 58 / 0.55)"
            />
            <circle cx={point.x} cy={point.y} r="6" fill="#ffffff" />
          </g>
        ))}
      </svg>
    </div>
  );
}
