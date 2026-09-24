"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  addItineraryEntry as addEntry,
  applyTimeChanges,
  deleteItineraryEntry as deleteEntry,
  getItinerary,
  setEntriesFixed,
  updateItineraryEntry as updateEntry,
} from "../infrastructure/itinerary-service";
import { setCityDays as writeCityDays } from "../infrastructure/city-days-service";
import { getSelectedDestinations } from "../infrastructure/guide-service";
import { planPlacements } from "../domain/schedule-new";
import { setCityDaysSchema } from "../domain/city-days";
import {
  updateItineraryEntrySchema,
  type UpdateEntryResult,
} from "../domain/itinerary-edit";
import { addTransferSchema, transferEntry } from "../domain/airport-transfer";

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

// Which entries of a day are anchored, set together from the lock dialog.
const anchorsSchema = z
  .array(z.object({ id: z.uuid(), fixed: z.boolean() }))
  .min(1)
  .max(60);

export async function setItineraryAnchors(
  tripId: string,
  changes: unknown,
): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(tripId).success) return { ok: false };
  const parsed = anchorsSchema.safeParse(changes);
  if (!parsed.success) return { ok: false, message: "השינויים לא תקינים." };

  const { error } = await setEntriesFixed(tripId, parsed.data);
  if (error) return { ok: false, message: "השמירה נכשלה. נסו שוב." };

  revalidatePath(`/trips/${tripId}/today`);
  revalidatePath(`/trips/${tripId}/days`);
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

// The airport transfer, once a traveller has picked one of the offered ways in.
//
// The option itself is re-validated here rather than trusted: it arrived from
// the model, went out to the browser and came back, so by the time it reaches a
// write it is ordinary user input.
export async function addAirportTransfer(
  tripId: string,
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(tripId).success) return { ok: false };

  const parsed = addTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "הפרטים לא תקינים." };

  const {
    dayNumber,
    dayCount,
    airport,
    destination,
    landingMinutes,
    city,
    option,
  } = parsed.data;
  const entry = transferEntry(option, { airport, destination, landingMinutes });

  // A late landing pushes the whole transfer onto the next day — clearing a
  // 23:30 arrival puts you outside the terminal at 01:00, and the schedule
  // continues there. Clamped to the trip's own length so a landing on the last
  // night cannot create a day the trip does not have.
  const day = Math.min(dayNumber + entry.dayOffset, dayCount);

  const { error } = await addEntry(tripId, {
    dayNumber: day,
    title: entry.title,
    startLabel: entry.startLabel,
    endLabel: entry.endLabel,
    note: entry.note,
    // The city the transfer lands in, so the entry colours and maps like every
    // other item on that day rather than falling out of the route.
    city: city ?? null,
    travelNote: entry.travelNote,
    travelMinutes: entry.travelMinutes,
  });

  if (error) return { ok: false, message: "ההוספה נכשלה. נסו שוב." };

  revalidatePath("/trips/[id]", "layout");
  return { ok: true };
}

// "שיבוץ לימים" — the places chosen since the schedule was built, into the
// days that already exist (see domain/schedule-new.ts for the rule). No model
// call: with no schedule yet, the answer is needsBuild and the button sends
// the traveller to מסלול, where the build is.
export async function scheduleNewPlaces(tripId: string): Promise<{
  ok: boolean;
  placed: number;
  unplaced: number;
  needsBuild?: boolean;
}> {
  if (!z.uuid().safeParse(tripId).success) return { ok: false, placed: 0, unplaced: 0 };

  const [days, selected] = await Promise.all([
    getItinerary(tripId),
    getSelectedDestinations(tripId),
  ]);
  if (days.length === 0) return { ok: true, placed: 0, unplaced: 0, needsBuild: true };

  const { placements, unplaced } = planPlacements(selected, days);
  let placed = 0;
  for (const placement of placements) {
    const { error } = await addEntry(tripId, {
      dayNumber: placement.dayNumber,
      title: placement.name,
      startLabel: "",
      endLabel: "",
      note: null,
      city: placement.city,
      travelNote: null,
      travelMinutes: null,
    });
    if (!error) placed++;
  }

  if (placed > 0) revalidatePath("/trips/[id]", "layout");
  return { ok: placed === placements.length, placed, unplaced: unplaced.length };
}
