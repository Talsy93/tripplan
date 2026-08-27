"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  gearCategorySchema,
  gearFormSchema,
  type GearFormState,
} from "../domain/gear";
import {
  createGearItem,
  createGearItems,
  deleteGearItem,
  resetGearPacked,
  setGearPacked,
} from "../infrastructure/gear-service";

// The packing list's write path.
//
// Every action re-validates its own arguments even though the form already did:
// a Server Action is a public HTTP endpoint, and the client is not a boundary.

const tripIdSchema = z.uuid();

export async function addGearItem(
  _state: GearFormState,
  formData: FormData,
): Promise<GearFormState> {
  const tripId = tripIdSchema.safeParse(formData.get("tripId"));
  if (!tripId.success) return { message: "טיול לא תקין." };

  const parsed = gearFormSchema.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  if (!(await createGearItem({ tripId: tripId.data, ...parsed.data }))) {
    return { message: "ההוספה נכשלה. נסו שוב." };
  }

  revalidatePath(`/trips/${tripId.data}`, "layout");
  // Empty, not undefined: the form distinguishes "never submitted" from
  // "submitted and succeeded" to know when to clear itself, the same way
  // CreateTripForm does.
  return {};
}

// The quick-add buttons. Takes labels rather than a FormData because it is
// called from a click handler and not from a form submission.
export async function addGearItems(
  tripId: string,
  category: string,
  labels: string[],
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  const parsedCategory = gearCategorySchema.safeParse(category);
  if (!parsedTrip.success || !parsedCategory.success) return false;

  // The labels come from GEAR_STARTERS in the browser, so they are trusted only
  // as far as the same rules the typed form applies — length and non-emptiness.
  const parsedLabels = z
    .array(z.string().trim().min(1).max(120))
    .min(1)
    .max(20)
    .safeParse(labels);
  if (!parsedLabels.success) return false;

  const ok = await createGearItems(
    parsedTrip.data,
    parsedLabels.data.map((label) => ({
      label,
      category: parsedCategory.data,
    })),
  );

  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

export async function toggleGearItem(
  tripId: string,
  id: string,
  packed: boolean,
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedTrip.success || !parsedId.success) return false;

  const ok = await setGearPacked(parsedId.data, packed);
  // Revalidated on the trip layout so the counter in the "עוד" menu and the
  // list itself cannot disagree.
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

export async function removeGearItem(
  tripId: string,
  id: string,
): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedTrip.success || !parsedId.success) return false;

  const ok = await deleteGearItem(parsedId.data);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}

export async function uncheckAllGear(tripId: string): Promise<boolean> {
  const parsedTrip = tripIdSchema.safeParse(tripId);
  if (!parsedTrip.success) return false;

  const ok = await resetGearPacked(parsedTrip.data);
  if (ok) revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return ok;
}
