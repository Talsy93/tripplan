import { createClient } from "@/lib/supabase/server";
import { wallClockToInstant } from "@/lib/datetime";
import { deadlineDate, parseCost, parseDuration } from "../domain/booking";
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

export async function createBooking(input: CreateBookingInput) {
  const startsAt = toInstant(input.startsAt);
  // The schema guarantees a well-formed string, so this is unreachable in
  // practice — but storing an unconverted value would silently reintroduce the
  // two-hour shift, which is worse than refusing the write.
  if (!startsAt) {
    console.error("createBooking: unparseable startsAt", input.startsAt);
    return false;
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
    duration_minutes: parseDuration(input.durationMinutes),
  });

  if (error) {
    console.error("createBooking failed:", error.message);
    return false;
  }
  return true;
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
        duration_minutes: parseDuration(input.durationMinutes),
      },
      { count: "exact" },
    )
    .eq("id", input.id);

  if (error) return { error: error.message };
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
