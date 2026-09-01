import { createClient } from "@/lib/supabase/server";
import { wallClockToInstant } from "@/lib/datetime";
import { deadlineDate, parseCost, parseDuration } from "../domain/booking";
import { isSchemaOutOfDate } from "@/lib/supabase/schema-errors";
import { APP_TIME_ZONE } from "../domain/weather";
import type {
  Booking,
  CreateBookingInput,
  UpdateBookingInput,
} from "../domain/booking";

// The trip's bookings, earliest first — the order they'll be lived in.
export async function listBookings(tripId: string): Promise<Booking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_bookings")
    .select("*")
    .eq("trip_id", tripId)
    .order("starts_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("listBookings failed:", error.message);
    return [];
  }
  return data as Booking[];
}

// 🐞 The form's times are wall-clock readings with no zone, and the column is
// `timestamptz`. Writing one straight into the other let Postgres read it in
// the session's zone — UTC on Supabase — so a departure typed as 22:20 was
// stored as 22:20 UTC and read back in Asia/Jerusalem as 00:20 the next day.
//
// The shift was visible in the list, and it also moved the booking to the wrong
// calendar day everywhere that buckets by date (bookingsByDay, lodgingByDay,
// travelDayCount). Converting here, at the one boundary where a typed time
// becomes an instant, fixes all of them at once. See lib/datetime.ts.
function toInstant(wall: string): string | null {
  return wallClockToInstant(wall, APP_TIME_ZONE);
}

// 0020's column, spread into a write only when there is a value for it.
//
// Migrations here are applied by hand (README), so between a deploy and the
// person running the SQL there is a window where the column does not exist. An
// unconditional `duration_minutes: null` in the payload would fail every insert
// and update in that window — turning "the new duration field does not save" into
// "no booking can be saved at all", which is the difference between a feature
// waiting and the screen being broken.
//
// A booking that does carry a duration still fails in that window, and that is
// correct: the alternative is dropping what the user typed and reporting success.
// The action names migration 0020 in the message — see isSchemaOutOfDate.
function durationColumn(value: string | undefined) {
  const minutes = parseDuration(value);
  return minutes === null ? {} : { duration_minutes: minutes };
}

export async function createBooking(input: CreateBookingInput) {
  const startsAt = toInstant(input.startsAt);
  // The schema guarantees a well-formed string, so this is unreachable in
  // practice — but storing an unconverted value would silently reintroduce the
  // two-hour shift, which is worse than refusing the write.
  if (!startsAt) {
    console.error("createBooking: unparseable startsAt", input.startsAt);
    return { error: "failed" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("trip_bookings").insert({
    trip_id: input.tripId,
    kind: input.kind,
    title: input.title,
    // Empty strings from an untouched form field are nulls, not values.
    origin: input.origin || null,
    destination: input.destination || null,
    city: input.city || null,
    starts_at: startsAt,
    ends_at: input.endsAt ? toInstant(input.endsAt) : null,
    address: input.address || null,
    confirmation: input.confirmation || null,
    note: input.note || null,
    // 0011. The two dates are `date` columns, so they are stored as the plain
    // YYYY-MM-DD the form produced — deliberately not turned into timestamps,
    // because a deadline is a calendar date and no time-of-day is correct for
    // it in every timezone.
    free_cancellation_until: deadlineDate(input.freeCancellationUntil),
    // A booking deadline only means anything for something not yet booked.
    // Storing one against a real reservation would leave a row that says "book
    // this by Tuesday" about a ticket already in hand.
    book_by: input.booked === false ? deadlineDate(input.bookBy) : null,
    booked: input.booked !== false,
    // Null means "use the app default" — an explicit choice is stored, silence
    // is not turned into a number.
    reminder_days_before: input.reminderDaysBefore ?? null,
    // 0014. The schema already guarantees these travel together — either both
    // present or both absent — so there is nothing further to reconcile here.
    // Both or neither. The currency picker always submits a code (it has a
    // default), so a booking with no price must not be stored as "EUR, amount
    // unknown" — that would put it in the filter's currency list with nothing
    // in it.
    cost_amount: parseCost(input.costAmount),
    cost_currency: parseCost(input.costAmount) === null ? null : input.costCurrency || null,
    // Spread rather than a plain key, so a booking with no duration sends no
    // `duration_minutes` at all — which is what keeps every existing flow
    // working on a database where migration 0020 has not been run yet. Only a
    // booking that actually carries one can hit the missing column, and that
    // failure is reported by name below.
    ...durationColumn(input.durationMinutes),
  });

  // A boolean until now. It reports a kind instead, so the one failure a
  // reader can actually do something about — the 0020 column not being there
  // yet — can say so rather than arriving as "try again", which is advice that
  // does not work.
  if (error) {
    console.error("createBooking failed:", error.message);
    return { error: isSchemaOutOfDate(error.message) ? "schema" : "failed" };
  }
  return { error: null };
}

// Same fields as createBooking, targeted at an existing row instead of a new
// one. RLS restricts the update to the user's own trips, so a foreign id
// matches no row — checked the same way updateItineraryEntry checks it,
// because Postgres calls an update that matched nothing a success.
export async function updateBooking(input: UpdateBookingInput) {
  const startsAt = toInstant(input.startsAt);
  if (!startsAt) {
    console.error("updateBooking: unparseable startsAt", input.startsAt);
    return { error: "invalid-time" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_bookings")
    .update(
      {
        kind: input.kind,
        title: input.title,
        origin: input.origin || null,
        destination: input.destination || null,
        city: input.city || null,
        starts_at: startsAt,
        ends_at: input.endsAt ? toInstant(input.endsAt) : null,
        address: input.address || null,
        confirmation: input.confirmation || null,
        note: input.note || null,
        free_cancellation_until: deadlineDate(input.freeCancellationUntil),
        book_by: input.booked === false ? deadlineDate(input.bookBy) : null,
        booked: input.booked !== false,
        reminder_days_before: input.reminderDaysBefore ?? null,
        cost_amount: parseCost(input.costAmount),
        cost_currency: input.costCurrency || null,
        ...durationColumn(input.durationMinutes),
      },
      { count: "exact" },
    )
    .eq("id", input.id);

  if (error) {
    return { error: isSchemaOutOfDate(error.message) ? "schema" : error.message };
  }
  if (count === 0) return { error: "not-found" };
  return { error: null };
}

// RLS restricts this to the user's own trips, so the id alone is enough.
export async function deleteBooking(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_bookings").delete().eq("id", id);
  if (error) {
    console.error("deleteBooking failed:", error.message);
    return false;
  }
  return true;
}
