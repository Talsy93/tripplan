"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  setTripDatesSchema,
  type TripDatesFormState,
} from "../domain/trip";
import { updateTripDates } from "../infrastructure/trips-service";

export async function setTripDates(
  _state: TripDatesFormState,
  formData: FormData,
): Promise<TripDatesFormState> {
  const parsed = setTripDatesSchema.safeParse({
    tripId: formData.get("tripId"),
    start_date: formData.get("start_date"),
    // A blank return-date field arrives as "" — normalise to null.
    end_date: formData.get("end_date") || null,
  });

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0];
    return { error: firstError ?? "התאריכים אינם תקינים." };
  }

  const { tripId, start_date, end_date } = parsed.data;
  const { error } = await updateTripDates(tripId, start_date, end_date ?? null);

  if (error) {
    return { error: "שמירת התאריכים נכשלה. נסו שוב." };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/profile");
  return { ok: true };
}
