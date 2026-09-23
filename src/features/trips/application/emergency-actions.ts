"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { emergencyContactFormSchema } from "../domain/emergency";
import {
  createEmergencyContact,
  deleteEmergencyContact,
  updateEmergencyContact,
} from "../infrastructure/emergency-service";

const tripIdSchema = z.uuid();

export type EmergencyResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

// The documents tab is the only screen that shows these.
function revalidateDocuments(tripId: string) {
  revalidatePath(`/trips/${tripId}/more`);
}

function fieldErrors(
  error: z.ZodError<z.infer<typeof emergencyContactFormSchema>>,
): Record<string, string> {
  const flat: Partial<Record<string, string[]>> =
    z.flattenError(error).fieldErrors;
  return Object.fromEntries(
    Object.entries(flat).flatMap(([key, messages]) =>
      messages?.[0] ? [[key, messages[0]]] : [],
    ),
  );
}

export async function saveEmergencyContact(
  tripId: string,
  id: string | null,
  input: unknown,
): Promise<EmergencyResult> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  if (id !== null && !z.uuid().safeParse(id).success) return { ok: false };

  const parsed = emergencyContactFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const ok =
    id === null
      ? await createEmergencyContact(tripId, parsed.data)
      : await updateEmergencyContact(id, parsed.data);
  if (!ok) {
    return {
      ok: false,
      message:
        "השמירה נכשלה. אם זו הפעם הראשונה — ודאו שהורצה ב-Supabase המיגרציה 0026_documents_hub.sql.",
    };
  }

  revalidateDocuments(tripId);
  return { ok: true };
}

export async function removeEmergencyContact(
  tripId: string,
  id: string,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await deleteEmergencyContact(id);
  if (ok) revalidateDocuments(tripId);
  return ok;
}
