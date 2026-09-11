"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { dayReminderFormSchema } from "../domain/day-reminders";
import {
  createDayReminder,
  deleteDayReminder,
  setDayReminderDone,
} from "../infrastructure/reminder-service";

const tripIdSchema = z.uuid();

export type ReminderResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function addDayReminder(
  tripId: string,
  input: unknown,
): Promise<ReminderResult> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  const parsed = dayReminderFormSchema.safeParse(input);
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
  const ok = await createDayReminder({ tripId, ...parsed.data });
  if (!ok) return { ok: false, message: "ההוספה נכשלה. נסו שוב." };

  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

export async function toggleDayReminder(
  tripId: string,
  id: string,
  done: boolean,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await setDayReminderDone(id, done);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}

export async function removeDayReminder(
  tripId: string,
  id: string,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await deleteDayReminder(id);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}
