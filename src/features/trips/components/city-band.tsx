import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatShortDate } from "../domain/trip";

// The heading of a city guide: where you are, for how long, and the way back.
//
// Pencil draws it as a solid terracotta band — the must-see ink — reaching the
// edges of the content column: a round back chevron, the city at 30px bold in
// white, and the stay as a pill on a 15% white veil at the far end. The tab
// pills are the band's last line in the design; they belong to CityGuide
// (they are its state), which draws them in a strip of the same fill directly
// under this one.
//
// `hues` is still accepted so the page compiles until the aura assignment is
// removed from it in slice 4.
export function CityBand({
  tripId,
  city,
  nights,
  from,
  to,
}: {
  tripId: string;
  city: string;
  hues?: string[];
  nights: number | null;
  from: string | null;
  to: string | null;
}) {
  const stay =
    nights === null
      ? null
      : nights === 0
        ? "יום אחד"
        : `${nights} ${nights === 1 ? "לילה" : "לילות"}`;
  const dates =
    from && to ? `${formatShortDate(from)}–${formatShortDate(to)}` : null;

  return (
    // -mt-5 cancels <main>'s top padding so the band meets the top of the
    // column; the safe-area inset keeps the chevron clear of a notch now that
    // no app bar sits above it.
    <div className="-mx-4 -mt-5 flex min-w-0 items-center gap-2 bg-cat-mustsee-ink px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <Link
        href={`/trips/${tripId}/more/guides`}
        aria-label="חזרה למדריכי הערים"
        className="-ms-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {/* RTL: "back" points the way the text runs. */}
        <ChevronRight className="h-6 w-6" aria-hidden="true" />
      </Link>

      <h1 className="line-clamp-2 min-w-0 flex-1 text-[1.875rem] font-bold leading-9 wrap-anywhere">
        {city}
      </h1>

      {(stay || dates) && (
        <p className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-caption font-semibold tabular-nums">
          {[stay, dates].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
