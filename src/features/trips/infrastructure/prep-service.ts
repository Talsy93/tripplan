import { createClient } from "@/lib/supabase/server";
import { prepItemSchema, type PrepItem } from "../domain/prep";

export async function listPrepItems(tripId: string): Promise<PrepItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_prep_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("listPrepItems failed:", error.message);
    return [];
  }
  return data.flatMap((row) => {
    const parsed = prepItemSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createPrepItems(
  tripId: string,
  items: {
    title: string;
    dueDate: string | null;
    url: string | null;
    kind: string | null;
  }[],
): Promise<boolean> {
  if (items.length === 0) return true;
  const supabase = await createClient();
  const { error } = await supabase.from("trip_prep_items").insert(
    items.map((item) => ({
      trip_id: tripId,
      title: item.title,
      due_date: item.dueDate,
      url: item.url,
      kind: item.kind,
    })),
  );
  if (error) console.error("createPrepItems failed:", error.message);
  return !error;
}

export async function setPrepDone(id: string, done: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_prep_items")
    .update({ done }, { count: "exact" })
    .eq("id", id);
  if (error) console.error("setPrepDone failed:", error.message);
  return !error && count !== 0;
}

export async function setPrepUrl(
  id: string,
  url: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_prep_items")
    .update({ url }, { count: "exact" })
    .eq("id", id);
  if (error) console.error("setPrepUrl failed:", error.message);
  return !error && count !== 0;
}

export async function deletePrepItem(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_prep_items")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("deletePrepItem failed:", error.message);
  return !error && count !== 0;
}
