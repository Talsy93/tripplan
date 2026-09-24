import Link from "next/link";
import { ChevronLeft, Wallet } from "lucide-react";
import { costTotalsByCurrency, formatMoney } from "../domain/expenses";
import type { Booking } from "../domain/booking";

// What the trip has cost so far, in one row.
//
// `ExpenseSummary` is the full answer — city filters, a breakdown by kind, a
// count of what still has no price on it — and it is 372px too wide for the
// context pane and far more than a glance wants. This is the mockup's version
// of the same fact: an icon, a number, and a way to the breakdown.
//
// The largest currency total rather than a sum across currencies, for the same
// reason TodayStats does it: adding shekels to yen needs a rate, and a made-up
// rate is worse than one honest number.
export function TripSpend({
  tripId,
  bookings,
}: {
  tripId: string;
  bookings: Booking[];
}) {
  const totals = costTotalsByCurrency(bookings);
  const biggest = totals[0] ?? null;
  if (!biggest) return null;

  return (
    <Link
      href={`/trips/${tripId}/more#expenses`}
      className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary"
      >
        <Wallet className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg leading-6 font-bold tabular-nums text-foreground">
          <span dir="ltr">{formatMoney(biggest.total, biggest.currency)}</span>
        </span>
        <span className="block text-xs text-muted">
          {totals.length > 1
            ? `ועוד ${totals.length - 1} ${totals.length - 1 === 1 ? "מטבע" : "מטבעות"}`
            : "טיסות, רכבות ולינה"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
        פירוט
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
