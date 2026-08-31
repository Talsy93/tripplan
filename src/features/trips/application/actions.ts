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
