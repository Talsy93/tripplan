import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatShortDate } from "../domain/trip";

// The heading of a city guide: where you are, for how long, and the way back.
//
// It was a band lit with the trip's aura. v5 ("מפה חיה") has no lit chrome, so
// this is a plain white heading that reaches the edges of the content column
// and closes with a hairline — the same shape as the workspace header above
// it, one level down. `hues` is still accepted so the page compiles until the
// aura assignment is removed from it in slice 4.
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
    <div className="-mx-4 -mt-5 flex min-w-0 flex-col gap-1.5 border-b border-border bg-surface px-4 pb-5 pt-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <Link
        href={`/trips/${tripId}/more/guides`}
        className="flex w-fit items-center gap-1 rounded-control text-caption font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        חזרה למדריכי הערים
      </Link>

      <h1 className="line-clamp-2 min-w-0 font-display text-heading font-semibold wrap-anywhere">
        {city}
      </h1>

      {(stay || dates) && (
        <p className="min-w-0 text-sm font-medium text-muted">
          {[stay, dates].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
