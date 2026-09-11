"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { prepItemFormSchema, type PrepFormState } from "../domain/prep";
import {
  createPrepItems,
  deletePrepItem,
  setPrepDone,
  setPrepUrl,
} from "../infrastructure/prep-service";

const tripIdSchema = z.uuid();

// The typed-in row: a form action, so the field can report its own errors.
export async function addPrepItem(
  _state: PrepFormState,
  formData: FormData,
): Promise<PrepFormState> {
  const tripId = tripIdSchema.safeParse(formData.get("tripId"));
  if (!tripId.success) return { message: "טיול לא תקין." };

  const parsed = prepItemFormSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const ok = await createPrepItems(tripId.data, [
    {
      title: parsed.data.title,
      url: parsed.data.url || null,
      dueDate: parsed.data.dueDate || null,
      kind: null,
    },
  ]);
  if (!ok) return { message: "ההוספה נכשלה. נסו שוב." };

  revalidatePath(`/trips/${tripId.data}`, "layout");
  return {};
}

// Suggestions accepted from the chip row, one or many at once.
const suggestionsSchema = z
  .array(
    z.object({
      kind: z.string().min(1).max(40),
      title: z.string().trim().min(1).max(160),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    }),
  )
  .min(1)
  .max(30);

export async function addPrepSuggestions(
  tripId: string,
  suggestions: unknown,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  const parsed = suggestionsSchema.safeParse(suggestions);
  if (!parsed.success) return false;

  const ok = await createPrepItems(
    tripId,
    parsed.data.map((item) => ({ ...item, url: null })),
  );
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}

export async function togglePrepItem(
  tripId: string,
  id: string,
  done: boolean,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await setPrepDone(id, done);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}

export async function setPrepItemUrl(
  tripId: string,
  id: string,
  url: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const trimmed = url.trim();
  if (trimmed !== "" && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: "קישור מתחיל ב-http:// או https://" };
  }
  if (trimmed.length > 2000) return { ok: false, message: "הקישור ארוך מדי" };

  const ok = await setPrepUrl(id, trimmed || null);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok ? { ok: true } : { ok: false, message: "השמירה נכשלה. נסו שוב." };
}

export async function removePrepItem(
  tripId: string,
  id: string,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await deletePrepItem(id);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}
