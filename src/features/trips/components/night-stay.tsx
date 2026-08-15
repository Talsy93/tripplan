import { Card } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
import { BOOKING_KINDS } from "../domain/booking";
import { nightStayLabel } from "../domain/trip-days";
import type { NightLodging } from "../domain/trip-days";

// "Where am I sleeping tonight" for one itinerary day.
//
// A server component: it renders text and a link and holds no state, so it
// works unchanged inside the day pager (a client component) and the itinerary.
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
    <Card className="flex items-center gap-3 border-s-4 border-s-primary-tint bg-surface-2 p-3">
      <span className="text-xl leading-none" aria-hidden="true">
        {BOOKING_KINDS.lodging.emoji}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {nightStayLabel(stay)}
        </span>
        <span className="truncate text-sm font-bold">{booking.title}</span>
        {where && <span className="truncate text-xs text-muted">{where}</span>}
      </div>
      <a
        href={googleMapsSearchUrl(
          [booking.title, booking.address, booking.city]
            .filter(Boolean)
            .join(" "),
        )}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`פתח את ${booking.title} ב-Google Maps`}
        className="shrink-0 text-muted transition-colors hover:text-foreground"
      >
        🗺️
      </a>
    </Card>
  );
}
