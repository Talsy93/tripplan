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
