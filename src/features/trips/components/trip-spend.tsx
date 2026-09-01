import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, Glyph } from "@/components/ui";
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
    <Card variant="interactive" padding="none" className="overflow-hidden">
      <Link
        href={`/trips/${tripId}/more/trip`}
        className="flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Glyph>
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </Glyph>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-title font-black tabular-nums">
            {formatMoney(biggest.total, biggest.currency)}
          </span>
          <span className="block text-caption text-muted">
            {totals.length > 1
              ? `ועוד ${totals.length - 1} ${totals.length - 1 === 1 ? "מטבע" : "מטבעות"}`
              : "טיסות, רכבות ולינה"}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary-ink">
          פירוט
        </span>
      </Link>
    </Card>
  );
}
