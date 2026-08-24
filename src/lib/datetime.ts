// Wall-clock times and the instants behind them.
//
// A `datetime-local` input produces "2026-11-01T22:20" — a wall-clock reading
// with no timezone. `trip_bookings.starts_at` is `timestamptz`, an instant. The
// two are different kinds of thing, and the app was writing one into the other
// without converting: Postgres reads a timezone-less string in the session's
// zone (UTC on Supabase), so a departure typed as 22:20 was stored as 22:20 UTC
// and then read back in Asia/Jerusalem — where it is 00:20 the next morning.
//
// The two hours were visible in the list, but the same shift also moved the
// booking to the wrong *day* in bookingsByDay, lodgingByDay and travelDayCount,
// all of which bucket by calendar date in APP_TIME_ZONE.
//
// So: a time the user types is wall-clock in the trip's zone, and these two
// functions are the only places that cross between that and an instant.
//
// No library. Intl already knows every zone's offset including its DST history,
// which is the only hard part; date-fns-tz would be a dependency to re-expose
// it.

// The offset of `zone` from UTC at a given instant, in milliseconds.
//
// Works by asking Intl what the wall clock reads there, rebuilding that reading
// as if it were UTC, and taking the difference. Positive east of Greenwich.
function offsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  // hour12:false renders midnight as 24 in some engines; 24 % 24 is the 0 we
  // want, and every other hour is unchanged.
  const asIfUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return asIfUtc - instant.getTime();
}

// "2026-11-01T22:20" read as a wall clock in `zone` → the ISO instant it names.
//
// The offset has to be looked up at the answer, not at the question, and the
// answer is what we are solving for — so it is applied once and then checked.
// The second pass matters only at a DST transition, where the first guess can
// land on the wrong side of the jump; away from one the two agree and it is a
// no-op.
//
// Returns null for anything that is not a usable wall-clock string, so a caller
// can reject rather than store an Invalid Date.
export function wallClockToInstant(wall: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(wall)) return null;

  const asUtc = new Date(`${wall.slice(0, 16)}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;

  const firstGuess = new Date(asUtc.getTime() - offsetMs(asUtc, zone));
  const corrected = new Date(asUtc.getTime() - offsetMs(firstGuess, zone));
  return corrected.toISOString();
}

// The reverse: an instant → the "YYYY-MM-DDTHH:mm" a datetime-local input
// wants, read in `zone`. What the edit form pre-fills with, so a booking opens
// showing the time that was typed rather than a shifted one.
export function instantToWallClock(iso: string, zone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = String(Number(value("hour")) % 24).padStart(2, "0");

  return `${value("year")}-${value("month")}-${value("day")}T${hour}:${value("minute")}`;
}

// A booking's time for display, always in the trip's zone rather than the
// reader's.
//
// Deliberately not the viewer's local time, which is what toLocaleString does
// by default and what the booking list used to do. A flight leaves at 22:20
// where it leaves from; showing 21:20 to someone reading in London would be
// describing the same instant and answering a question nobody asked.
export function formatInZone(iso: string, zone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;

  return instant.toLocaleString("he-IL", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
