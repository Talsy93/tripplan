import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AuraField } from "@/components/ui";
import { formatShortDate } from "../domain/trip";

// The band a city guide opens with.
//
// Every other screen inside a trip opens with the trip's light — that is what
// made the redesign reach ten screens instead of one — and the city guide was
// the last one that did not. It opened with a plain text back link and a black
// heading on grey, which is why T7's sweep flagged it as the one screen still
// opening differently from the rest.
//
// It is the trip's light rather than a light of its own. A city is not a second
// identity: the mockup draws this band in the same colours as the band on the
// tabs behind it, and a per-city palette would put a fourth colour system on
// the screen next to the city tones that already identify it in every list.
//
// Shorter than the trip band (11rem) at 9.5rem: that one introduces a screen
// about the whole trip, this one introduces one city's guide, and the guide is
// long.
export function CityBand({
  tripId,
  city,
  hues = [],
  // How long the trip stays here, from the itinerary. Null when the city has no
  // days yet — a city can be in the trip before anything is scheduled in it.
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
  const dates = from && to ? `${formatShortDate(from)}–${formatShortDate(to)}` : null;

  return (
    // The negative margins undo AppShell's padding at each breakpoint, and -mt-5
    // cancels its top padding so the band meets the app bar — the same treatment
    // TripAuraBand uses, because it is the same band one level down.
    <div className="relative -mx-4 -mt-5 flex min-h-[9.5rem] flex-col overflow-hidden rounded-b-[1.75rem] bg-aura-base md:-mx-6 lg:-mx-8">
      <AuraField hues={hues} />

      <div className="relative mt-auto flex min-w-0 flex-col gap-1.5 px-5 pb-5 pt-8 text-white sm:px-7 sm:pb-6">
        {/* On the light rather than above it, which is where the mockup puts it
            — and it is the only control the band carries, so it does not compete
            with anything. RTL: back points right. */}
        <Link
          href={`/trips/${tripId}/more/guides`}
          className="flex w-fit items-center gap-1 rounded-control text-caption font-semibold text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          חזרה למדריכי הערים
        </Link>

        {/* line-clamp-2 with wrap-anywhere: a city name is whatever the user or
            the AI typed, and truncate in RTL clips the start of a Latin string
            with the ellipsis off screen. */}
        <h1 className="line-clamp-2 min-w-0 text-display font-black wrap-anywhere">
          {city}
        </h1>

        {(stay || dates) && (
          <p className="min-w-0 text-sm font-semibold text-white/80">
            {[stay, dates].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
