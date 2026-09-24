import { Map as MapIcon } from "lucide-react";
import { googleMapsSearchUrl } from "@/lib/maps";
import { BOOKING_KINDS } from "../domain/booking";
import { nightStayLabel } from "../domain/trip-days";
import type { NightLodging } from "../domain/trip-days";
import { DomainIcon } from "./domain-icon";

// "Where am I sleeping tonight" for one itinerary day.
//
// A server component: it renders text and a link and holds no state, so it
// works unchanged inside the day pager (a client component) and the itinerary.
//
// Drawn as the Pencil design's tonight row (v7): a teal-tint strip with the
// bed on a white tile, the hotel's name, the night's status and address, and
// a round map button.
//
// Renders nothing when the night has no lodging. That is the honest outcome for
// a day nobody has booked yet, and for the final morning of a stay — nagging on
// every uncovered night would make the strip noise rather than information.
export function NightStay({ stay }: { stay: NightLodging | null }) {
  if (!stay) return null;

  const { booking } = stay;
  // The address is what gets you to the door; the city is the fallback.
  const where = booking.address ?? booking.city;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-primary-tint p-3.5">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary"
      >
        <DomainIcon name={BOOKING_KINDS.lodging.icon} className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base leading-6 font-bold text-foreground">
          {booking.title}
        </span>
        <span className="truncate text-xs text-muted">
          {nightStayLabel(stay)}
          {where && ` · ${where}`}
        </span>
      </span>
      <a
        href={googleMapsSearchUrl(
          [booking.title, booking.address, booking.city]
            .filter(Boolean)
            .join(" "),
        )}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`פתח את ${booking.title} ב-Google Maps`}
        title="Google Maps"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapIcon className="h-5 w-5" aria-hidden="true" />
      </a>
    </div>
  );
}
