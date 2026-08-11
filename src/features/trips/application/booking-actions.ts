"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createBookingSchema, type BookingFormState } from "../domain/booking";
import {
  createBooking,
  deleteBooking as deleteBookingRow,
} from "../infrastructure/booking-service";

// Everything the form submits, as plain strings, so a rejected attempt can be
// handed back to the fields it came from.
const FORM_FIELDS = [
  "kind",
  "title",
  "origin",
  "destination",
  "city",
  "startsAt",
  "endsAt",
  "address",
  "confirmation",
  "note",
] as const;

function submittedValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const field of FORM_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value !== "") values[field] = value;
  }
  return values;
}

export async function addBooking(
  _state: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const parsed = createBookingSchema.safeParse({
    tripId: formData.get("tripId"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    origin: formData.get("origin") ?? undefined,
    destination: formData.get("destination") ?? undefined,
    city: formData.get("city") ?? undefined,
    startsAt: formData.get("startsAt"),
    // A blank end field arrives as "" — undefined, so the optional check and
    // the "after the start" refinement both skip it.
    endsAt: formData.get("endsAt") || undefined,
    address: formData.get("address") ?? undefined,
    confirmation: formData.get("confirmation") ?? undefined,
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: submittedValues(formData),
    };
  }

  if (!(await createBooking(parsed.data))) {
    // A save that failed for reasons outside the form still keeps the input —
    // retyping a flight is nobody's idea of error recovery.
    return {
      error: "השמירה נכשלה. נסו שוב.",
      values: submittedValues(formData),
    };
  }

  revalidatePath(`/trips/${parsed.data.tripId}`);
  // No values: this is what lets the form clear itself on success.
  return {};
}

export async function removeBooking(tripId: string, id: string) {
  const parsedTrip = z.uuid().safeParse(tripId);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedTrip.success || !parsedId.success) return false;

  const ok = await deleteBookingRow(parsedId.data);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`);
  return ok;
}
