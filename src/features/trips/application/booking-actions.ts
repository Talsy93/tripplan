"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  combineDuration,
  createBookingSchema,
  updateBookingSchema,
  type BookingFormState,
} from "../domain/booking";
import {
  createBooking,
  deleteBooking as deleteBookingRow,
  updateBooking as updateBookingRow,
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
  "freeCancellationUntil",
  "bookBy",
  "booked",
  "reminderDaysBefore",
  "costAmount",
  "costCurrency",
  "durationMinutes",
  "airline",
] as const;

// The one write failure a reader can act on, named. Everything else keeps the
// generic message: "the column is missing" is actionable ("run the migration"),
// and a network blip or an RLS refusal is not.
//
// Migrations in this project are applied by hand in the Supabase SQL editor
// (README), so the window between deploying a column and running its SQL is
// real and a reader can be standing in it.
function bookingWriteError(kind: string, fallback: string): string {
  return kind === "schema"
    ? "אחד השדות ״משך הנסיעה״ או ״חברת תעופה״ עדיין לא קיים במסד הנתונים. הריצו את המיגרציות 0020_booking_duration.sql ו-0021_booking_airline.sql, או השאירו את השדות ריקים."
    : fallback;
}

// A checkbox is absent from FormData when unticked, present as "on" when
// ticked. Absent therefore means false — but only for a form that actually
// contains the field, which is why the caller passes the flag explicitly rather
// than letting `undefined` stand in for both "unticked" and "not asked".
function checkboxValue(formData: FormData, field: string): boolean {
  return formData.get(field) !== null;
}

// The reminder lead time arrives as a string, or as "" from an untouched field.
// Undefined keeps the column null, which the domain reads as "use the default" —
// distinct from 0, which is a real choice meaning "only on the day itself".
function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function submittedValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const field of FORM_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value !== "") values[field] = value;
  }
  // Recorded either way, unlike every other field. An unticked checkbox is
  // simply absent, so leaving it out would let the form fall back to its own
  // default — silently turning "not booked yet" back into "booked" when a
  // rejected submission is handed back for correction.
  values.booked = formData.get("booked") !== null ? "on" : "off";

  // The loop above copied the `durationMinutes` *input*, which since the field
  // became two boxes holds only the minutes part. Echoing that would hand back
  // "25" for a submitted 11h25m and the hours would vanish on the one
  // submission that has to keep them. The echo carries the combined figure,
  // which is also the shape the form splits apart again.
  const combined = combineDuration(
    formData.get("durationHours")?.toString(),
    formData.get("durationMinutes")?.toString(),
  );
  if (combined) values.durationMinutes = combined;
  else delete values.durationMinutes;

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
    freeCancellationUntil: formData.get("freeCancellationUntil") || undefined,
    bookBy: formData.get("bookBy") || undefined,
    booked: checkboxValue(formData, "booked"),
    reminderDaysBefore: optionalNumber(formData.get("reminderDaysBefore")),
    costAmount: formData.get("costAmount") || undefined,
    // Two boxes in, one figure out. The form asks for hours and minutes
    // because 685 is not a number anybody reads off a ticket; the column and
    // every reader of it still hold total minutes. See combineDuration.
    durationMinutes: combineDuration(
      formData.get("durationHours")?.toString(),
      formData.get("durationMinutes")?.toString(),
    ),
    costCurrency: formData.get("costCurrency") || undefined,
    airline: formData.get("airline") || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: submittedValues(formData),
    };
  }

  const created = await createBooking(parsed.data);
  if (created.error) {
    // A save that failed for reasons outside the form still keeps the input —
    // retyping a flight is nobody's idea of error recovery.
    return {
      error: bookingWriteError(created.error, "השמירה נכשלה. נסו שוב."),
      values: submittedValues(formData),
    };
  }

  revalidatePath(`/trips/${parsed.data.tripId}`, "layout");
  // No values: this is what lets the form clear itself on success.
  return {};
}

export async function editBooking(
  _state: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const parsed = updateBookingSchema.safeParse({
    id: formData.get("id"),
    tripId: formData.get("tripId"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    origin: formData.get("origin") ?? undefined,
    destination: formData.get("destination") ?? undefined,
    city: formData.get("city") ?? undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    address: formData.get("address") ?? undefined,
    confirmation: formData.get("confirmation") ?? undefined,
    note: formData.get("note") ?? undefined,
    freeCancellationUntil: formData.get("freeCancellationUntil") || undefined,
    bookBy: formData.get("bookBy") || undefined,
    booked: checkboxValue(formData, "booked"),
    reminderDaysBefore: optionalNumber(formData.get("reminderDaysBefore")),
    costAmount: formData.get("costAmount") || undefined,
    // Two boxes in, one figure out. The form asks for hours and minutes
    // because 685 is not a number anybody reads off a ticket; the column and
    // every reader of it still hold total minutes. See combineDuration.
    durationMinutes: combineDuration(
      formData.get("durationHours")?.toString(),
      formData.get("durationMinutes")?.toString(),
    ),
    costCurrency: formData.get("costCurrency") || undefined,
    airline: formData.get("airline") || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: submittedValues(formData),
    };
  }

  const { error } = await updateBookingRow(parsed.data);
  if (error) {
    return {
      error: bookingWriteError(error, "העדכון נכשל. נסו שוב."),
      values: submittedValues(formData),
    };
  }

  revalidatePath(`/trips/${parsed.data.tripId}`, "layout");
  return {};
}

export async function removeBooking(tripId: string, id: string) {
  const parsedTrip = z.uuid().safeParse(tripId);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedTrip.success || !parsedId.success) return false;

  const ok = await deleteBookingRow(parsedId.data);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}
