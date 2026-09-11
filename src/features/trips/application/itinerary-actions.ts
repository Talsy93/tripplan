"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  applyTimeChanges,
  deleteItineraryEntry as deleteEntry,
  updateItineraryEntry as updateEntry,
} from "../infrastructure/itinerary-service";
import { setCityDays as writeCityDays } from "../infrastructure/city-days-service";
import { setCityDaysSchema } from "../domain/city-days";
import {
  updateItineraryEntrySchema,
  type UpdateEntryResult,
} from "../domain/itinerary-edit";

export async function deleteItineraryEntry(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  await deleteEntry(id);
}

// The day re-timed around where you are (domain/reflow.ts computes the
// changes on the client from the day it already has; this persists them).
const timeChangesSchema = z
  .array(
    z.object({
      id: z.uuid(),
      startLabel: z.string().max(5),
      endLabel: z.string().max(5),
    }),
  )
  .min(1)
  .max(60);

export async function applyDayReflow(
  tripId: string,
  changes: unknown,
): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(tripId).success) return { ok: false };
  const parsed = timeChangesSchema.safeParse(changes);
  if (!parsed.success) return { ok: false, message: "השינויים לא תקינים." };

  const { error } = await applyTimeChanges(tripId, parsed.data);
  if (error) return { ok: false, message: "העדכון נכשל. נסו שוב." };

  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

// Zod validates and normalises in one pass — the times that come back are
// already HH:MM, so the caller stores exactly what the timeline can draw.
export async function updateItineraryEntry(
  input: unknown,
): Promise<UpdateEntryResult> {
  const parsed = updateItineraryEntrySchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      errors: Object.fromEntries(
        Object.entries(fieldErrors).flatMap(([key, messages]) =>
          messages?.[0] ? [[key, messages[0]]] : [],
        ),
      ),
    };
  }

  const { id, ...patch } = parsed.data;
  const { error } = await updateEntry(id, patch);

  if (error) return { ok: false, message: "השמירה נכשלה. נסו שוב." };

  // "layout" and not the default: seven revalidatePath calls in this project
  // needed it for the same reason — a page-scoped revalidation only matches the
  // redirect at /trips/[id] and every tab quietly stops refreshing.
  revalidatePath("/trips/[id]", "layout");
  return { ok: true };
}

export async function setCityDays(
  tripId: string,
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!z.uuid().safeParse(tripId).success) return { ok: false };

  const parsed = setCityDaysSchema.safeParse(input);
  if (!parsed.success) {
    const first = z.flattenError(parsed.error).fieldErrors.days?.[0];
    return { ok: false, error: first ?? "המספר לא תקין" };
  }

  const { error } = await writeCityDays(
    tripId,
    parsed.data.city,
    parsed.data.days,
  );
  if (error) return { ok: false, error: "השמירה נכשלה. נסו שוב." };

  revalidatePath("/trips/[id]", "layout");
  return { ok: true };
}
