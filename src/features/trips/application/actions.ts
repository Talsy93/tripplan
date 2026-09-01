"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createTripSchema, type TripFormState } from "../domain/trip";
import {
  createTrip as insertTrip,
  deleteTrip as removeTrip,
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

// Archiving was built here and removed on 2026-09-01, at the owner's request:
// "why do we even need the archive? I want all my trips shown, always". The
// home screen no longer splits the list, the trip's "עוד" menu no longer has an
// archive row, and `trip_status` no longer has an `archived` value — migration
// 0020 was deleted before it was ever applied, so no row can carry one.
//
// Kept as a note rather than silently vanishing, because the feature was a
// deliberate answer to "law 05 wants a reversible half of destroying a trip",
// and the answer now is that deleting is the only such action and it asks first.
