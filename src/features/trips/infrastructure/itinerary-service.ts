import { createClient } from "@/lib/supabase/server";
import type { AiItinerary, ItineraryDay } from "../domain/ai-suggestion";
import type { TripStatus } from "../domain/trip";

export async function getItinerary(tripId: string): Promise<ItineraryDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, day_number, position, title, start_label, end_label, note")
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
export async function saveItinerary(tripId: string, itinerary: AiItinerary) {
  const supabase = await createClient();
  await supabase.from("itinerary_items").delete().eq("trip_id", tripId);

  const rows = itinerary.days.flatMap((day) =>
    day.items.map((item, index) => ({
      trip_id: tripId,
      day_number: day.day,
      position: index,
      title: item.name,
      start_label: item.start_time,
      end_label: item.end_time,
      note: item.note,
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
