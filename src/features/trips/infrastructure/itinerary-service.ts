import { createClient } from "@/lib/supabase/server";
import type {
  AiItinerary,
  ItineraryDay,
  SelectedItem,
} from "../domain/ai-suggestion";
import type { TripStatus } from "../domain/trip";

// Name matching has to survive the AI echoing a name back with different
// spacing or punctuation, which it does often enough to matter.
function normalise(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function getItinerary(tripId: string): Promise<ItineraryDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_number, position, title, start_label, end_label, note, city",
    )
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("position", { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  const byDay = new Map<number, ItineraryDay>();
  for (const row of data) {
    const dayNumber = row.day_number ?? 1;
    let day = byDay.get(dayNumber);
    if (!day) {
      day = { day: dayNumber, items: [] };
      byDay.set(dayNumber, day);
    }
    day.items.push({
      id: row.id,
      title: row.title ?? "",
      startLabel: row.start_label ?? "",
      endLabel: row.end_label ?? "",
      note: row.note ?? "",
      city: row.city ?? null,
    });
  }
  return [...byDay.values()];
}

// Remove a single itinerary entry (RLS restricts to the user's own trips).
export async function deleteItineraryEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("deleteItineraryEntry failed:", error.message);
  }
}

// Replace the trip's itinerary with a freshly built one.
//
// `selected` is the list the AI was asked to schedule. The AI returns entries
// by name, so matching those names back against the list is what recovers each
// item's city — the itinerary is otherwise fully denormalised. An entry the AI
// renamed simply gets no city (see ItineraryEntry).
export async function saveItinerary(
  tripId: string,
  itinerary: AiItinerary,
  selected: SelectedItem[],
) {
  const supabase = await createClient();
  await supabase.from("itinerary_items").delete().eq("trip_id", tripId);

  const cityByName = new Map(
    selected.map((item) => [normalise(item.name), item.city]),
  );

  const rows = itinerary.days.flatMap((day) =>
    day.items.map((item, index) => ({
      trip_id: tripId,
      day_number: day.day,
      position: index,
      title: item.name,
      start_label: item.start_time,
      end_label: item.end_time,
      note: item.note,
      city: cityByName.get(normalise(item.name)) ?? null,
    })),
  );
  if (rows.length === 0) return;

  const { error } = await supabase.from("itinerary_items").insert(rows);
  if (error) {
    console.error("saveItinerary failed:", error.message);
  }
}

export async function setTripStatus(tripId: string, status: TripStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", tripId);
  if (error) {
    console.error("setTripStatus failed:", error.message);
  }
}
