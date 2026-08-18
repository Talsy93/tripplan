import { cache } from "react";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import { tripSchema, type Trip } from "../domain/trip";

export async function createTrip(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "not-authenticated" };
  }

  const { error } = await supabase
    .from("trips")
    .insert({ user_id: user.id, name });

  return { error: error?.message ?? null };
}

export async function updateTripDates(
  tripId: string,
  startDate: string,
  endDate: string | null,
) {
  const supabase = await createClient();
  // RLS scopes the update to the owner; a non-owner matches no row.
  const { error } = await supabase
    .from("trips")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", tripId);

  return { error: error?.message ?? null };
}

// Deduped per request: the tab layout and the tab page both need the trip, and
// without this a single page load would fetch it twice.
export const getTrip = cache(async (id: string): Promise<Trip | null> => {
  const supabase = await createClient();
  // RLS ensures only the owner's trip is returned; anything else yields null.
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return tripSchema.parse(data);
});

export async function listTrips(): Promise<Trip[]> {
  const supabase = await createClient();
  // RLS limits rows to the current user's trips.
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return z.array(tripSchema).parse(data);
}

// Deleting a trip deletes everything hanging off it, and that happens in the
// database rather than here: every child table declares
// `trip_id ... references public.trips (id) on delete cascade` —
// suggested_destinations and itinerary_items (0002), trip_bookings (0008),
// trip_phrasebooks (0009) and trip_chat_messages (0010). Doing it in five
// statements from here would be slower, non-atomic, and would silently miss the
// sixth table the day one is added.
//
// RLS scopes the delete to the owner ("Users manage own trips" is `for all`), so
// a non-owner's id matches no row. That is why the count is checked: Postgres
// reports a delete that matched nothing as a success, and treating "not yours"
// as "deleted" would tell the user their trip is gone when it is not.
export async function deleteTrip(tripId: string) {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trips")
    .delete({ count: "exact" })
    .eq("id", tripId);

  if (error) return { error: error.message };
  if (count === 0) return { error: "not-found" };

  return { error: null };
}
