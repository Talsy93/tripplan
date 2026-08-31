import { Map as MapIcon } from "lucide-react";
import { Glyph, iconButtonClasses, ListRow } from "@/components/ui";
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
    <ListRow
      accent="action"
      leading={<Glyph>{BOOKING_KINDS.lodging.emoji}</Glyph>}
      title={
        <>
          <span className="font-normal text-muted">
            {nightStayLabel(stay)} ·{" "}
          </span>
          {booking.title}
        </>
      }
      subtitle={where ?? undefined}
      trailing={
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
          className={iconButtonClasses("ghost", "sm")}
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
        </a>
      }
      className="bg-surface-2"
    />
  );
}
