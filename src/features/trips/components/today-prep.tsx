import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { TwoPane } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { costTotalsByCurrency } from "../domain/expenses";
import { daysUntil, formatShortDate } from "../domain/trip";
import { duePrep } from "../domain/prep";
import type { Booking } from "../domain/booking";
import type { OpenItem } from "../domain/open-items";
import type { PrepItem, PrepSuggestion } from "../domain/prep";
import { OpenItems } from "./open-items";
import { PrepList } from "./prep-list";
import { TripSpend } from "./trip-spend";
import { UpNext } from "./up-next";

// The "היום" tab before the trip has started.
//
// It used to show what would be today's screen with nothing in it. Before
// departure the question is not "what now" but "what is left to do", so this
// is a countdown, the to-do list with the app's suggestions, whatever the app
// itself still finds open (dates, itinerary, lodging), and what is coming up.
export function TodayPrep({
  tripId,
  tripName,
  startDate,
  today,
  bookings,
  now,
  cities,
  open,
  prepItems,
  suggestions,
  forecast,
}: {
  tripId: string;
  tripName: string;
  startDate: string | null;
  today: string;
  bookings: Booking[];
  now: string;
  cities: string[];
  open: OpenItem[];
  prepItems: PrepItem[];
  suggestions: PrepSuggestion[];
  forecast?: ReactNode;
}) {
  const days = startDate ? daysUntil(startDate) : null;
  const hasSpend = costTotalsByCurrency(bookings).length > 0;
  const due = duePrep(prepItems, today);
  const hasAside = Boolean(forecast) || hasSpend || bookings.length > 0;

  return (
    <TwoPane
      aside={
        hasAside ? (
          <>
            {bookings.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeading level="section">מה קרוב</SectionHeading>
                <UpNext bookings={bookings} now={now} cities={cities} />
              </section>
            )}
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

      <section
        aria-label="ספירה לאחור"
        className="flex items-center gap-4 rounded-card border border-border bg-surface p-4"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink">
          <CalendarClock className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {days !== null && days > 0 ? (
            <span className="flex items-baseline gap-2">
              <span className="font-display text-display font-bold leading-none text-primary">
                {days}
              </span>
              <span className="text-sm font-semibold text-muted">
                {days === 1 ? "יום ליציאה" : "ימים ליציאה"}
                {startDate && ` · ${formatShortDate(startDate)}`}
              </span>
            </span>
          ) : (
            <span className="text-base font-semibold">
              {startDate ? "יוצאים היום" : "עוד לא נקבע תאריך יציאה"}
            </span>
          )}
          <span className="text-caption text-muted">
            {due.length > 0
              ? due.length === 1
                ? `דבר אחד ברשימה מגיע לתאריך היעד שלו`
                : `${due.length} דברים ברשימה מגיעים לתאריך היעד שלהם`
              : open.length > 0
                ? `${open.length} ${open.length === 1 ? "דבר פתוח" : "דברים פתוחים"} בתכנון`
                : "התכנון סגור. נשארה הרשימה."}
          </span>
        </div>
      </section>

      <PrepList
        tripId={tripId}
        items={prepItems}
        suggestions={suggestions}
        today={today}
      />

      <OpenItems tripId={tripId} items={open} />
    </TwoPane>
  );
}
