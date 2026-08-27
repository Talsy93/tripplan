import { createClient } from "@/lib/supabase/server";
import {
  gearItemSchema,
  normalizeCategory,
  type GearCategory,
  type GearItem,
} from "../domain/gear";

// The packing list (migration 0017). RLS bounds every call below to the caller's
// own trips, so none of them filter on the user themselves.

export async function listGear(tripId: string): Promise<GearItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trip_gear")
    .select("*")
    .eq("trip_id", tripId)
    // Insertion order inside each category, matching the index. Grouping is
    // done in the domain so the order the UI renders is the order this returns.
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.flatMap((row) => {
    // The category is normalised *before* validation rather than after: the
    // column is free text, so a value outside the enum is a legal database row
    // and must not cost the user their whole list. Everything else is strict.
    const parsed = gearItemSchema.safeParse({
      ...row,
      category: normalizeCategory(row.category),
    });
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createGearItem(input: {
  tripId: string;
  label: string;
  category: GearCategory;
}): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.from("trip_gear").insert({
    trip_id: input.tripId,
    label: input.label,
    category: input.category,
  });

  if (error) console.error("createGearItem failed:", error.message);
  return !error;
}

// Adds several rows in one round trip, for the quick-add buttons.
//
// Separate from createGearItem rather than a loop over it: tapping four
// suggestions is four inserts and four RLS checks, and the list has to come back
// complete either way. Partial success is not possible — one statement.
export async function createGearItems(
  tripId: string,
  items: { label: string; category: GearCategory }[],
): Promise<boolean> {
  if (items.length === 0) return true;
  const supabase = await createClient();

  const { error } = await supabase.from("trip_gear").insert(
    items.map((item) => ({
      trip_id: tripId,
      label: item.label,
      category: item.category,
    })),
  );

  if (error) console.error("createGearItems failed:", error.message);
  return !error;
}

// Ticks or un-ticks one item.
//
// `count` is checked for the reason the whole codebase now checks it: Postgres
// reports an update that matched no rows as a success, so without this an id
// belonging to somebody else's trip — filtered out by RLS, not by an error —
// would come back as a completed toggle and the checkbox would spring back only
// on the next reload.
export async function setGearPacked(
  id: string,
  packed: boolean,
): Promise<boolean> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trip_gear")
    .update({ packed }, { count: "exact" })
    .eq("id", id);

  if (error) console.error("setGearPacked failed:", error.message);
  return !error && count !== 0;
}

// Un-ticks everything in one trip, for "start over" before the next trip.
// Deliberately not a delete: the list itself is worth keeping.
export async function resetGearPacked(tripId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("trip_gear")
    .update({ packed: false })
    .eq("trip_id", tripId)
    .eq("packed", true);

  if (error) console.error("resetGearPacked failed:", error.message);
  return !error;
}

export async function deleteGearItem(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("trip_gear")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) console.error("deleteGearItem failed:", error.message);
  return !error && count !== 0;
}
