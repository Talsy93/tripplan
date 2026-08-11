import { createClient } from "@/lib/supabase/server";
import { normaliseName } from "@/lib/text";
import type {
  AiItinerary,
  ItineraryDay,
  SelectedItem,
} from "../domain/ai-suggestion";
import type { TripStatus } from "../domain/trip";

// Coordinates for the trip's destinations, keyed the same way the itinerary
// links back to them (city + normalised name, see getAddedPlaces).
//
// Only rows that actually hold coordinates come back, which in practice means
// the places added from the attractions search — an AI guide item never had
// any. The 'overview' rows are excluded on purpose: they hold the city centre
// under the city's own name, and an entry that happens to share that name
// would otherwise be placed at the centre of town.
async function getEntryCoordinates(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suggested_destinations")
    .select("city, name, latitude, longitude")
    .eq("trip_id", tripId)
    .neq("category", "overview")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  const points = new Map<string, { latitude: number; longitude: number }>();
  for (const row of data ?? []) {
    if (typeof row.latitude === "number" && typeof row.longitude === "number") {
      points.set(coordinateKey(row.city, row.name), {
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }
  return points;
}

function coordinateKey(city: string | null, name: string) {
  return `${city ?? ""}|${normaliseName(name)}`;
}

export async function getItinerary(tripId: string): Promise<ItineraryDay[]> {
  const supabase = await createClient();
  const [{ data, error }, coordinates] = await Promise.all([
    supabase
      .from("itinerary_items")
      .select(
        "id, day_number, position, title, start_label, end_label, note, city",
      )
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })
      .order("position", { ascending: true }),
    getEntryCoordinates(tripId),
  ]);

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
    const point = coordinates.get(coordinateKey(row.city, row.title ?? ""));
    day.items.push({
      id: row.id,
      title: row.title ?? "",
      startLabel: row.start_label ?? "",
      endLabel: row.end_label ?? "",
      note: row.note ?? "",
      city: row.city ?? null,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
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
    selected.map((item) => [normaliseName(item.name), item.city]),
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
      city: cityByName.get(normaliseName(item.name)) ?? null,
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
