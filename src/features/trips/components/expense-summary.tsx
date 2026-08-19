import { Card, EmptyState } from "@/components/ui";
import { BOOKING_KINDS } from "../domain/booking";
import { costTotalsByCurrency, formatMoney, uncostedCount } from "../domain/expenses";
import type { Booking, BookingKind } from "../domain/booking";

export function ExpenseSummary({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon="💰"
        title="אין עדיין הוצאות"
        description="עלויות טיסות, רכבות ולינה שתזינו למעלה יופיעו כאן."
      />
    );
  }

  const totals = costTotalsByCurrency(bookings);
  const missing = uncostedCount(bookings);

  if (totals.length === 0) {
    return (
      <EmptyState
        icon="💰"
        title="אין עדיין עלויות"
        description="הוסיפו סכום ומטבע להזמנות למעלה כדי לראות כאן סיכום."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
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

      {missing > 0 && (
        <p className="text-caption text-muted">
          {missing === 1
            ? "להזמנה אחת אין עדיין מחיר — "
            : `ל-${missing} הזמנות אין עדיין מחיר — `}
          הסכום למעלה הוא מה שהוזן עד כה, לא בהכרח העלות המלאה של הטיול.
        </p>
      )}
    </div>
  );
}
