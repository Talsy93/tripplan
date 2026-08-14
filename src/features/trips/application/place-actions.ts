"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { manualPlaceSchema, placeSchema } from "../domain/place";
import { addManualPlace, addPlaceToTrip } from "../infrastructure/place-service";

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
  revalidatePath(`/trips/${parsedId.data}`, "layout");
  return true;
}

// The result of trying to add a hand-typed place. Field errors come back keyed
// by field so the form can put each message next to its own input, rather than
// one generic "something was wrong".
export type ManualPlaceResult = {
  ok: boolean;
  // Set when the place was already in the trip and got marked selected instead
  // of inserted — worth saying, so a click that looks like it did nothing
  // explains itself.
  existed?: boolean;
  errors?: Partial<Record<"name" | "city" | "category" | "address", string>>;
  message?: string;
};

// Adds a place the user typed in, for the things OpenStreetMap has never heard
// of. RLS restricts the write to the caller's own trips.
export async function createManualPlace(
  tripId: string,
  input: unknown,
): Promise<ManualPlaceResult> {
  const parsedId = z.uuid().safeParse(tripId);
  if (!parsedId.success) {
    return { ok: false, message: "טיול לא תקין." };
  }

  const parsed = manualPlaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      errors: {
        name: fieldErrors.name?.[0],
        city: fieldErrors.city?.[0],
        category: fieldErrors.category?.[0] ?? undefined,
        address: fieldErrors.address?.[0],
      },
    };
  }

  const result = await addManualPlace(parsedId.data, parsed.data);
  if (!result.ok) {
    return { ok: false, message: "השמירה נכשלה. נסו שוב." };
  }

  // Same reason as addPlace above: "what you picked", the route map and the
  // itinerary builder are panels of one server render, so the whole layout has
  // to be revalidated or the addition only shows up after a manual refresh.
  revalidatePath(`/trips/${parsedId.data}`, "layout");
  return { ok: true, existed: result.existed };
}
