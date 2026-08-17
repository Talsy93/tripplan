import { createClient } from "@/lib/supabase/server";
import { deadlineDate } from "../domain/booking";
import type { Booking, CreateBookingInput } from "../domain/booking";

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

export async function createBooking(input: CreateBookingInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_bookings").insert({
    trip_id: input.tripId,
    kind: input.kind,
    title: input.title,
    // Empty strings from an untouched form field are nulls, not values.
    origin: input.origin || null,
    destination: input.destination || null,
    city: input.city || null,
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
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
  });

  if (error) {
    console.error("createBooking failed:", error.message);
    return false;
  }
  return true;
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
