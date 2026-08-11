"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { placeSchema } from "../domain/place";
import { addPlaceToTrip } from "../infrastructure/place-service";

// Adds a place found in the attractions search to the trip.
//
// The place round-trips through the client, so it is re-validated here before
// being written; RLS additionally restricts writes to the user's own trips.
export async function addPlace(
  tripId: string,
  city: string,
  place: unknown,
): Promise<boolean> {
  const parsedId = z.uuid().safeParse(tripId);
  const parsed = placeSchema.safeParse(place);
  if (!parsedId.success || !parsed.success) return false;
  if (!city.trim()) return false;

  const ok = await addPlaceToTrip(parsedId.data, city.trim(), parsed.data);
  if (!ok) return false;

  // The trip page renders "what you picked", the route map and the itinerary
  // from server data captured when the page loaded. Without this the addition
  // only appears after a manual refresh — the tabs are separate panels of one
  // server render, not independent pages.
  revalidatePath(`/trips/${parsedId.data}`);
  return true;
}
