"use server";

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
  const parsed = placeSchema.safeParse(place);
  if (!parsed.success) return false;
  if (!city.trim()) return false;

  return addPlaceToTrip(tripId, city.trim(), parsed.data);
}
