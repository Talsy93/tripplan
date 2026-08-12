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
