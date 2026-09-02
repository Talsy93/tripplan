import { cn } from "@/lib/cn";
import { airlineLabel, airlineTone, findAirline } from "../domain/airlines";
import { toneClass } from "../domain/tone";

// Which airline a flight is on, as a code tile and a name.
//
// The code is the tile, not an icon, and that is the whole design of this
// component. A logo would be the obvious thing to put there and the app cannot
// have one: airline logos are trademarks, and every source that serves them is
// paid, key-gated, or an undocumented CDN with no terms granting their use.
// This app also dropped destination photographs on purpose in favour of light
// (trip-aura-band.tsx), so bitmaps from a third party would be reversing a
// decision it already made deliberately.
//
// Two letters in the carrier's own tone does the job a logo does here — it makes
// the row recognisable before it is read — with nothing to load, nothing to
// break, and nobody's mark being used.
//
// Latin and forced LTR: IATA codes are Latin, and "LY" in an RTL run beside a
// Hebrew name is a bidi reordering waiting to happen.
export function AirlineChip({
  code,
  className,
}: {
  code: string | null | undefined;
  className?: string;
}) {
  const label = airlineLabel(code);
  if (!code || !label) return null;

  const normalised = code.trim().toUpperCase();
  // A code the list does not know still gets a tile and its own colour — it is
  // a real airline the app has not been told about, not a broken value. Only
  // the name falls back, to the code itself, which is what the ticket says.
  const known = findAirline(normalised);

  return (
    <span
      className={cn(
        toneClass(airlineTone(normalised)),
        "inline-flex min-w-0 shrink-0 items-center gap-1.5",
        className,
      )}
    >
      <span
        dir="ltr"
        className="rounded-control bg-tone px-1.5 py-0.5 text-caption font-black tracking-latin text-tone-ink"
      >
        {normalised}
      </span>
      {/* The name only when it adds something. For an unknown code the label is
          the code, and printing it twice beside itself reads as a rendering
          bug rather than as a carrier nobody has heard of. */}
      {known && (
        <span className="min-w-0 truncate text-caption text-muted">
          {known.name}
        </span>
      )}
    </span>
  );
}
