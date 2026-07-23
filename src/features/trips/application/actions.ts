"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createTripSchema, type TripFormState } from "../domain/trip";
import { createTrip as insertTrip } from "../infrastructure/trips-service";

export async function createTrip(
  _state: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = createTripSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { error } = await insertTrip(parsed.data.name);

  if (error) {
    return { message: "יצירת הטיול נכשלה. נסו שוב." };
  }

  revalidatePath("/profile");
  return undefined;
}
