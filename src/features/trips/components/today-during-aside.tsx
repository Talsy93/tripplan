import type { ReactNode } from "react";
import { SectionHeading } from "@/components/ui";
import type { Booking } from "../domain/booking";
import type { OpenItem } from "../domain/open-items";
import { OpenItems } from "./open-items";
import { TripSpend } from "./trip-spend";
import { UpNext } from "./up-next";

// The context pane on the day screen, while the trip is running.
//
// It carried "מה קרוב" alone until now — one card beside a full column, which is
// the same imbalance T1 fixed at the other end of the trip. The mockup draws
// four things here, and this is their order: where today's places are, what the
// weather is doing there, what needs attention, what it has cost.
//
// A component rather than JSX in the page, for the reason TodayBefore is one:
// the harness cannot render a page that reads the database, so a composition
// left there is one no scene can check.
//
// The two panels that go to the network arrive as nodes. Each has its own
// <Suspense> at the call site — resolving the route may need to geocode a city
// and the forecast is a second host, and neither may hold up the "now" card
// above, which is the part somebody actually opened the app for.
export function TodayDuringAside({
  tripId,
  bookings,
  // Stamped by the server, so "in 3 hours" cannot disagree between the server
  // render and hydration.
  now,
  cities,
  // Only the urgent ones. The full list is the before-departure screen's
  // subject; here it is an interruption, and a pane of "worth knowing" rows
  // beside a live day is noise.
  urgent,
  stops,
  forecast,
}: {
  tripId: string;
  bookings: Booking[];
  now: string;
  cities: string[];
  urgent: OpenItem[];
  stops?: ReactNode;
  forecast?: ReactNode;
}) {
  return (
    <>
      {stops}
      {forecast}

      {urgent.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading level="section">דורש תשומת לב</SectionHeading>
          <OpenItems tripId={tripId} items={urgent} />
        </section>
      )}

      {/* "What is coming" is the thing you glance at and then go straight back
          to the schedule — two taps on a phone, none beside it. On anything
          narrower than xl it falls back to where it has always been: below the
          day. */}
      <section className="flex flex-col gap-3">
        <SectionHeading level="section">מה קרוב</SectionHeading>
        <UpNext bookings={bookings} now={now} cities={cities} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">הוצאות עד כה</SectionHeading>
        <TripSpend tripId={tripId} bookings={bookings} />
      </section>
    </>
  );
}
