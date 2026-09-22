"use client";

import { useState } from "react";
import { Button, Card, Dialog, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
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
import { DomainIcon } from "./domain-icon";
import { Check, ChevronDown, Filter, Wallet } from "lucide-react";

export function ExpenseSummary({ bookings }: { bookings: Booking[] }) {
  // Null is "everything" — the state this opens in, and the only one where the
  // totals describe the whole trip.
  const [city, setCity] = useState<string | null>(null);

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Wallet />}
        title="אין עדיין הוצאות"
        description="עלויות טיסות, רכבות ולינה שתזינו למעלה יופיעו כאן."
      />
    );
  }

  const { cities, hasUnassigned } = costedCities(bookings);

  if (cities.length === 0 && !hasUnassigned) {
    return (
      <EmptyState
        icon={<Wallet />}
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

  // Every choice the filter offers, in the order it offers them.
  const options: { value: string | null; label: string }[] = [
    { value: null, label: "כל הטיול" },
    ...cities.map((option) => ({ value: option, label: option })),
    ...(hasUnassigned
      ? [{ value: UNASSIGNED_CITY, label: "כללי לטיול" }]
      : []),
  ];
  const current = options.find((option) => option.value === city) ?? options[0];

  return (
    <div className="flex flex-col gap-3">
      {showFilter && (
        <CityFilter
          bookings={bookings}
          options={options}
          current={current}
          onSelect={setCity}
        />
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
                    <DomainIcon name={BOOKING_KINDS[kind].icon} />
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

// One button that says what is being shown, and a picker behind it.
//
// This was a row of chips, one per destination plus "the whole trip" and
// "general". Reported as everything arriving at once — and on a four-city trip
// that is six chips wrapping over two lines above a summary of two cards, which
// is a filter louder than the thing it filters.
//
// The picker is also the better *answer*, not just the tidier control: a chip
// can only offer a name, so choosing meant picking a city, reading the total,
// picking the next one and remembering the last. Each row here carries its own
// total, so the comparison the filter exists for happens in the list rather
// than through it.
function CityFilter({
  bookings,
  options,
  current,
  onSelect,
}: {
  bookings: Booking[];
  options: { value: string | null; label: string }[];
  current: { value: string | null; label: string };
  onSelect: (city: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted">מציג:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {current.label}
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="איזה חלק מהטיול?">
        {/* A list of choices, so `radio` — the platform's own word for "one of
            these", which also gives arrow-key navigation for free. */}
        <ul role="radiogroup" aria-label="סינון לפי יעד" className="flex flex-col gap-1">
          {options.map((option) => {
            const totals = costTotalsByCurrency(
              filterByCity(bookings, option.value),
            );
            const selected = option.value === current.value;

            return (
              <li key={option.value ?? "all"}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-control border px-3 py-2.5 text-start transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary-tint"
                      : "border-transparent hover:bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {option.label}
                  </span>

                  {/* The reason to open this at all. A destination with
                      nothing priced says so rather than showing a blank, which
                      is itself the useful answer — that is where a number is
                      missing. */}
                  <span className="shrink-0 text-caption tabular-nums text-muted" dir="ltr">
                    {totals.length > 0
                      ? totals
                          .map((entry) =>
                            formatMoney(entry.total, entry.currency),
                          )
                          .join(" · ")
                      : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
