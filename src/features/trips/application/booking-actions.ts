"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createBookingSchema, type BookingFormState } from "../domain/booking";
import {
  createBooking,
  deleteBooking as deleteBookingRow,
} from "../infrastructure/booking-service";

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
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0];
    return {
      error: firstError ?? "הפרטים אינם תקינים.",
      fieldErrors,
    };
  }

  if (!(await createBooking(parsed.data))) {
    return { error: "השמירה נכשלה. נסו שוב." };
  }

  revalidatePath(`/trips/${parsed.data.tripId}`);
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
