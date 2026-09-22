"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { dayNoteFormSchema } from "../domain/day-notes";
import {
  createDayNote,
  deleteDayNote,
} from "../infrastructure/day-note-service";

const tripIdSchema = z.uuid();

export type DayNoteResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

// Both screens that show a day, and nothing else. Not the layout: the same
// lesson the prep, expense and reminder actions learned — revalidating the
// whole workspace rebuilds the route, the map and the forecasts to put one
// band on one day.
function revalidateDays(tripId: string) {
  revalidatePath(`/trips/${tripId}/days`);
  revalidatePath(`/trips/${tripId}/today`);
}

export async function addDayNote(
  tripId: string,
  input: unknown,
): Promise<DayNoteResult> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  const parsed = dayNoteFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: Object.fromEntries(
        Object.entries(z.flattenError(parsed.error).fieldErrors).flatMap(
          ([key, messages]) => (messages?.[0] ? [[key, messages[0]]] : []),
        ),
      ),
    };
  }

  const ok = await createDayNote({ tripId, ...parsed.data });
  if (!ok) return { ok: false, message: "ההוספה נכשלה. נסו שוב." };

  revalidateDays(tripId);
  return { ok: true };
}

export async function removeDayNote(
  tripId: string,
  id: string,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await deleteDayNote(id);
  if (ok) revalidateDays(tripId);
  return ok;
}
