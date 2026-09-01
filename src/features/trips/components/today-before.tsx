import type { ReactNode } from "react";
import { TwoPane } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { costTotalsByCurrency } from "../domain/expenses";
import type { Booking } from "../domain/booking";
import type { OpenItem } from "../domain/open-items";
import { OpenItems } from "./open-items";
import { TripSpend } from "./trip-spend";
import { UpNext } from "./up-next";

// The day screen before the trip leaves.
//
// It is a component rather than JSX inside the page for one reason: the harness
// cannot render the page — the page reads the database — so a composition left
// in the page is a composition no scene can check. This is the layout that was
// measured as **817px of nothing** at 1911px, and the whole point of the fix is
// that it can be looked at.
//
// Why the split by phase at all: two months out there is no "now" and no
// current day, so the two cards this screen used to render were both false and
// the column rendered a screen-reader heading and stopped. Everything the
// screen did have was in the 372px pane beside it. So the column carries what
// does exist — what is coming, and what is still open — and "מה קרוב" moves out
// of the pane into it.
export function TodayBefore({
  tripId,
  tripName,
  bookings,
  now,
  cities,
  open,
  // The forecast, when one exists for these dates. A node rather than the trip,
  // because it fans out one request per city and the page owns that boundary —
  // and because passing it in is what lets a scene draw this layout with fixed
  // data instead of going to Open-Meteo.
  forecast,
}: {
  tripId: string;
  tripName: string;
  bookings: Booking[];
  // Stamped by the server, so "in 3 hours" cannot disagree between the server
  // render and hydration.
  now: string;
  cities: string[];
  open: OpenItem[];
  forecast?: ReactNode;
}) {
  const hasSpend = costTotalsByCurrency(bookings).length > 0;
  const hasAside = Boolean(forecast) || hasSpend;

  return (
    <TwoPane
      // Undefined, not an empty fragment: TwoPane collapses to one centred
      // column when there is no pane, and an empty 372px strip beside the
      // content reads as something that failed to load.
      aside={
        hasAside ? (
          <>
            {forecast && (
              <section className="flex flex-col gap-3">
                <SectionHeading level="section">מזג האוויר</SectionHeading>
                {forecast}
              </section>
            )}
            {hasSpend && (
              <section className="flex flex-col gap-3">
                <SectionHeading level="section">הוצאות עד כה</SectionHeading>
                <TripSpend tripId={tripId} bookings={bookings} />
              </section>
            )}
          </>
        ) : undefined
      }
    >
      <h1 className="sr-only">{tripName}</h1>

      {/* First, because it is the only thing on this screen with a clock on it.
          Everything below is a task; this is an appointment. */}
      <section className="flex flex-col gap-3">
        <SectionHeading level="section">מה קרוב</SectionHeading>
        <UpNext bookings={bookings} now={now} cities={cities} />
      </section>

      <OpenItems tripId={tripId} items={open} />
    </TwoPane>
  );
}
