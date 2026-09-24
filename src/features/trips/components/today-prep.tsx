import type { ReactNode } from "react";
import { TwoPane } from "@/components/layout";
import { costTotalsByCurrency } from "../domain/expenses";
import { daysUntil } from "../domain/trip";
import { duePrep, prepProgress } from "../domain/prep";
import type { Booking } from "../domain/booking";
import type { OpenItem } from "../domain/open-items";
import type { PrepItem } from "../domain/prep";
import { OpenItems } from "./open-items";
import { TripSpend } from "./trip-spend";
import { UpNext } from "./up-next";

// The preparations: everything left to do before the trip leaves.
//
// This was the "היום" tab before the trip started, and it is not that any more.
// Reported plainly: before departure that tab "is really a tab that resembles a
// lists page, so just merge them, there is no reason to duplicate". Which was
// right — a countdown, a checklist and a list of what is still open *is* a list
// page, and the app already had one at /more/gear. So the two are one page now,
// and the "היום" tab is not drawn until there is a today to show.
//
// What it holds (Pencil's "לפני היציאה", v7): a countdown card with a
// readiness ring, whatever the app itself still finds open (dates, itinerary,
// lodging), the forecast, and what is coming up. The reminders and the packing
// list moved to the documents tab as one checklist — the prep items are still
// read, for the ring and the countdown's lines.
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
  forecast,
  children,
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
  forecast?: ReactNode;
  // Rendered at the foot of the main column. This is how the packing list joins
  // the preparations instead of living on a page of its own — see the note at
  // the top.
  children?: ReactNode;
}) {
  const days = startDate ? daysUntil(startDate) : null;
  const hasSpend = costTotalsByCurrency(bookings).length > 0;
  const due = duePrep(prepItems, today);
  const progress = prepProgress(prepItems);
  const hasAside = hasSpend || bookings.length > 0;

  const leaving = startDate
    ? new Date(`${startDate}T00:00:00Z`).toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : null;

  return (
    <TwoPane
      aside={
        hasAside ? (
          <>
            {bookings.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base leading-6 font-bold text-foreground">מה קרוב</h2>
                <UpNext bookings={bookings} now={now} cities={cities} />
              </section>
            )}
            {hasSpend && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base leading-6 font-bold text-foreground">הוצאות עד כה</h2>
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
        className="flex min-w-0 items-center justify-between gap-4 rounded-[1.5rem] bg-surface p-5 shadow-card"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[1.75rem] leading-9 font-bold text-foreground">
            {days !== null && days > 0
              ? days === 1
                ? "מחר יוצאים"
                : `עוד ${days} ימים`
              : startDate
                ? "יוצאים היום"
                : "עוד אין תאריך"}
          </span>
          {leaving && days !== null && days > 0 && (
            <span className="text-sm text-muted">יוצאים ב{leaving}</span>
          )}
          {!startDate && (
            <span className="text-sm text-muted">קבעו תאריכים והספירה תתחיל.</span>
          )}
          {progress.total > 0 && (
            <span className="text-sm font-semibold text-success">
              {progress.done} מתוך {progress.total} הכנות סגורות
            </span>
          )}
          <span className="text-xs text-muted">
            {due.length > 0
              ? due.length === 1
                ? "דבר אחד ברשימה מגיע לתאריך היעד שלו"
                : `${due.length} דברים ברשימה מגיעים לתאריך היעד שלהם`
              : open.length > 0
                ? `${open.length} ${open.length === 1 ? "דבר פתוח" : "דברים פתוחים"} בתכנון`
                : "התכנון סגור. נשארה הרשימה."}
          </span>
        </div>
        {progress.total > 0 && <ReadinessRing percent={progress.percent} />}
      </section>

      <OpenItems tripId={tripId} items={open} />

      {/* Self-titled: WeatherForecast heads each city "תחזית ב…", and a
          heading over it here said "weather" twice. */}
      {forecast}

      {children}
    </TwoPane>
  );
}

// How much of the prep list is done, as a ring with the percentage inside.
// Green, because done is what it counts.
function ReadinessRing({ percent }: { percent: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="img"
      aria-label={`${percent}% מההכנות סגורות`}
      className="relative h-[5.5rem] w-[5.5rem] shrink-0"
    >
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="8" className="stroke-surface-sunken" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="stroke-success"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-foreground">
        {percent}%
      </span>
    </div>
  );
}
