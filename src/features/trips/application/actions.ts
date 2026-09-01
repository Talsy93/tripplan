"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createTripSchema, type TripFormState } from "../domain/trip";
import {
  createTrip as insertTrip,
  deleteTrip as removeTrip,
  setTripStatus as writeTripStatus,
} from "../infrastructure/trips-service";

export async function createTrip(
  _state: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = createTripSchema.safeParse({
    name: formData.get("name"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { error } = await insertTrip(
    parsed.data.name,
    parsed.data.start_date ?? null,
    parsed.data.end_date ?? null,
  );

  if (error) {
    return { message: "יצירת הטיול נכשלה. נסו שוב." };
  }

  revalidatePath("/profile");
  return undefined;
}

// Irreversible, and the confirmation lives in the UI (see DeleteTripButton) —
// there is no soft delete and no undo. `revalidatePath` rather than `redirect`:
// the caller is the trips list itself, so it only needs the list refetched.
export async function deleteTrip(tripId: string): Promise<{ ok: boolean }> {
  const { error } = await removeTrip(tripId);

  if (error) return { ok: false };

  revalidatePath("/profile");
  return { ok: true };
}

// Archiving, which is the reverse of deleting rather than a milder version of
// it: the trip and everything hanging off it stay exactly where they are, and
// the only thing that changes is whether the home screen is about it.
//
// One action for both directions, because "put away" and "bring back" are one
// switch and two actions would be two places for the revalidation to drift.
//
// The owner is the only one who can do it, enforced by the existing
// `trips_update_own` RLS policy rather than by a check here — a member with the
// editor role can change the trip's contents but not whether its owner still
// wants to see it. See migration 0020.
export async function setTripArchived(
  tripId: string,
  archived: boolean,
): Promise<{ ok: boolean }> {
  const ok = await writeTripStatus(tripId, archived ? "archived" : "planning");
  if (!ok) return { ok: false };

  // Both, and that is not belt-and-braces: the home screen's list changes, and
  // so does the "עוד" menu of the trip itself, which is where the row that was
  // just pressed lives.
  revalidatePath("/profile");
  revalidatePath(`/trips/${tripId}/more`);
  return { ok: true };
}
