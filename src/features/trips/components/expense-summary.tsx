"use client";

import { useState } from "react";
import { Card, Chip, EmptyState } from "@/components/ui";
import { BOOKING_KINDS } from "../domain/booking";
import {
  costTotalsByCurrency,
  costedCities,
  filterByCity,
  formatMoney,
  UNASSIGNED_CITY,
  uncostedCount,
} from "../domain/expenses";
import type { Booking, BookingKind } from "../domain/booking";

export function ExpenseSummary({ bookings }: { bookings: Booking[] }) {
  // Null is "everything" — the state this opens in, and the only one where the
  // totals describe the whole trip.
  const [city, setCity] = useState<string | null>(null);

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon="💰"
        title="אין עדיין הוצאות"
        description="עלויות טיסות, רכבות ולינה שתזינו למעלה יופיעו כאן."
      />
    );
  }

  const { cities, hasUnassigned } = costedCities(bookings);

  if (cities.length === 0 && !hasUnassigned) {
    return (
      <EmptyState
        icon="💰"
        title="אין עדיין עלויות"
        description="הוסיפו סכום ומטבע להזמנות למעלה כדי לראות כאן סיכום."
      />
    );
  }

  const shown = filterByCity(bookings, city);
  const totals = costTotalsByCurrency(shown);
  const missing = uncostedCount(shown);

  // One destination and nothing unassigned means the filter can only ever say
  // what the unfiltered view already says.
  const showFilter = cities.length + (hasUnassigned ? 1 : 0) > 1;

  return (
    <div className="flex flex-col gap-3">
      {showFilter && (
        <div className="flex flex-wrap gap-2">
          <Chip active={city === null} onClick={() => setCity(null)}>
            כל הטיול
          </Chip>
          {cities.map((option) => (
            <Chip
              key={option}
              active={city === option}
              onClick={() => setCity(option)}
            >
              {option}
            </Chip>
          ))}
          {hasUnassigned && (
            <Chip
              active={city === UNASSIGNED_CITY}
              onClick={() => setCity(UNASSIGNED_CITY)}
            >
              כללי לטיול
            </Chip>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {totals.map((entry) => (
          <Card key={entry.currency} className="flex flex-col gap-2">
            <span className="text-caption text-muted">{entry.currency}</span>
            <span className="text-heading font-bold tabular-nums" dir="ltr">
              {formatMoney(entry.total, entry.currency)}
            </span>
            <div className="flex flex-col gap-1 border-t border-dashed border-border pt-2 text-sm text-muted">
              {(Object.keys(entry.byKind) as BookingKind[]).map((kind) => (
                <span key={kind} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true">{BOOKING_KINDS[kind].emoji}</span>
                    {BOOKING_KINDS[kind].label}
                  </span>
                  <span dir="ltr" className="tabular-nums">
                    {formatMoney(entry.byKind[kind] ?? 0, entry.currency)}
                  </span>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* A filter that lands on nothing priced is not an error — it just has
          no total to show, and saying so beats an empty grid. */}
      {totals.length === 0 && (
        <p className="text-sm text-muted">
          אין עדיין מחירים למה שסיננתם.
        </p>
      )}

      {missing > 0 && (
        <p className="text-caption text-muted">
          {missing === 1
            ? "להזמנה אחת אין עדיין מחיר — "
            : `ל-${missing} הזמנות אין עדיין מחיר — `}
          הסכום למעלה הוא מה שהוזן עד כה, לא בהכרח העלות המלאה.
        </p>
      )}
    </div>
  );
}
