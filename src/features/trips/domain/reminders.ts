import { reminderDays } from "./booking";
import type { Booking } from "./booking";

// Which reminders are due to be pushed right now.
//
// The rule the user asked for, and the one thing this file exists to guarantee:
// a reminder fires ONCE, at the lead time they chose — not on every run while
// the deadline sits inside the window. "Remind me 3 days before" means one
// notification, not three.
//
// That is enforced by the row remembering it was sent (`cancel_notified_at` /
// `book_by_notified_at`, migration 0011) rather than by the schedule. A job that
// runs twice, retries after a failure, or overlaps itself still cannot produce a
// second notification, because the question is "has this been sent" and not
// "is today the right day".
//
// The window is `days <= lead` rather than `days === lead` for the same reason.
// If the scheduler misses its run — an outage, a cold start, a day the cron
// simply did not fire — an exact match would skip the reminder silently and
// forever. Catching up on the next run is the behaviour that fails safe: still
// exactly one notification, just possibly a day late instead of never.

export type ReminderKind = "cancellation" | "to_book";

export type DueReminder = {
  bookingId: string;
  kind: ReminderKind;
  // What the notification says. Built here rather than in the sender so the
  // wording is testable without a browser or a push service.
  title: string;
  body: string;
};

// Days from `today` to `deadline`, both plain YYYY-MM-DD. Negative once the
// deadline has passed.
//
// String dates compared as dates, with no Date parsing in between: `new
// Date("2026-09-10")` is UTC midnight and would shift the answer by a day for
// any reader west of Greenwich. Both values are already calendar dates, so the
// arithmetic is done on them directly.
function daysUntil(today: string, deadline: string): number | null {
  const a = toUtcMillis(today);
  const b = toUtcMillis(deadline);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

// Both dates are interpreted in the *same* fixed frame, so the offset cancels
// out and only the difference in days survives.
function toUtcMillis(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(at) ? null : at;
}

function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}.${match[2]}` : date;
}

function daysPhrase(days: number): string {
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  return `בעוד ${days} ימים`;
}

export function dueReminders(
  bookings: Booking[],
  // Today as YYYY-MM-DD, stamped by the caller in a fixed zone rather than read
  // from the clock — the same rule every other date function here follows.
  today: string,
): DueReminder[] {
  const due: DueReminder[] = [];

  for (const booking of bookings) {
    const lead = reminderDays(booking);

    // --- free cancellation -------------------------------------------------
    // Only while cancelling is still free. Once the deadline has passed there
    // is nothing left to do, and a notification about it is pure noise.
    if (booking.free_cancellation_until && !booking.cancel_notified_at) {
      const days = daysUntil(today, booking.free_cancellation_until);
      if (days !== null && days >= 0 && days <= lead) {
        due.push({
          bookingId: booking.id,
          kind: "cancellation",
          title: "ביטול חינם עומד להסתיים",
          body: `${booking.title} — אפשר לבטל בחינם עד ${formatDate(
            booking.free_cancellation_until,
          )} (${daysPhrase(days)}). אם לא נשארים שם, כדאי לבטל עכשיו.`,
        });
      }
    }

    // --- still needs booking ----------------------------------------------
    // Unlike a cancellation, a missed booking deadline is still actionable —
    // the train does not book itself — so an overdue one is included rather
    // than dropped.
    if (!booking.booked && booking.book_by && !booking.book_by_notified_at) {
      const days = daysUntil(today, booking.book_by);
      if (days !== null && days <= lead) {
        due.push({
          bookingId: booking.id,
          kind: "to_book",
          title: days < 0 ? "עבר מועד ההזמנה" : "צריך להזמין",
          body:
            days < 0
              ? `${booking.title} — מועד ההזמנה היה ${formatDate(booking.book_by)} וטרם הוזמן.`
              : `${booking.title} — להזמין עד ${formatDate(booking.book_by)} (${daysPhrase(days)}).`,
        });
      }
    }
  }

  return due;
}
