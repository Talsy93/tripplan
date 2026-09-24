"use server";

import * as z from "zod";
import { getTripMapPlaces } from "../infrastructure/trip-map-service";
import type { TripMapPlace } from "../domain/trip-map";

// The destinations of one trip, fetched when the home map opens it (the second
// tap on a trip). Null when the id is not a uuid or the read failed — the map
// says so rather than drawing an empty trip.
export async function loadTripMapPlaces(
  tripId: string,
): Promise<TripMapPlace[] | null> {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return null;
  return getTripMapPlaces(parsed.data);
}
