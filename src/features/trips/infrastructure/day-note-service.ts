import { createClient } from "@/lib/supabase/server";
import { dayNoteSchema, type DayNote, type DayNoteKind } from "../domain/day-notes";

export async function listDayNotes(tripId: string): Promise<DayNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_day_notes")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("listDayNotes failed:", error.message);
    return [];
  }
  // Parsed row by row rather than cast, like every other list in this layer: a
  // `kind` the app no longer knows about should drop one row, not poison the
  // whole day screen.
  return data.flatMap((row) => {
    const parsed = dayNoteSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createDayNote(input: {
  tripId: string;
  dayNumber: number;
  kind: DayNoteKind;
  label: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_day_notes").insert({
    trip_id: input.tripId,
    day_number: input.dayNumber,
    kind: input.kind,
    label: input.label,
  });
  if (error) console.error("createDayNote failed:", error.message);
  return !error;
}

// Correcting one that already exists. A note is typed in a hurry like a
// reminder is — "יום חג" before you have looked up which day it actually falls
// on — and re-adding it to fix a date is not an edit, it is a retype.
export async function updateDayNote(
  id: string,
  input: { dayNumber: number; kind: DayNoteKind; label: string },
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_day_notes")
    .update(
      {
        day_number: input.dayNumber,
        kind: input.kind,
        label: input.label,
      },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) console.error("updateDayNote failed:", error.message);
  return !error && count !== 0;
}

export async function deleteDayNote(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_day_notes")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("deleteDayNote failed:", error.message);
  return !error && count !== 0;
}
