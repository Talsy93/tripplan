import type { Booking, BookingKind } from "./booking";

// What the trip has spent, split by currency and then by kind. Split rather
// than combined into one number: combining currencies needs an exchange
// rate, and the project has no paid FX service to keep one honest — a made-up
// rate that drifts from reality is worse than showing two totals side by
// side. See migration 0014.
export type CurrencyTotal = {
  currency: string;
  total: number;
  byKind: Partial<Record<BookingKind, number>>;
};

export function costTotalsByCurrency(bookings: Booking[]): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();

  for (const booking of bookings) {
    if (booking.cost_amount === null || !booking.cost_currency) continue;

    const currency = booking.cost_currency;
    const entry = totals.get(currency) ?? { currency, total: 0, byKind: {} };
    entry.total += booking.cost_amount;
    entry.byKind[booking.kind] =
      (entry.byKind[booking.kind] ?? 0) + booking.cost_amount;
    totals.set(currency, entry);
  }

  // Largest total first — the currency that matters most to the trip's cost
  // leads, rather than an alphabetical accident of which code sorts first.
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

// How many bookings carry no price yet, so a total can be labelled "so far"
// instead of read as the trip's full cost.
export function uncostedCount(bookings: Booking[]): number {
  return bookings.filter((booking) => booking.cost_amount === null).length;
}

// A number and a currency code, formatted together. Falls back to a plain
// suffix for a code Intl doesn't recognise — a booking's currency is typed in
// by hand, and a typo shouldn't throw where a total is meant to render.
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
