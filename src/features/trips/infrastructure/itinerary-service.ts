import { cache } from "react";
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
        "id, day_number, position, title, start_label, end_label, note, city, travel_note, travel_minutes",
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
      travelNote: row.travel_note ?? null,
      travelMinutes: row.travel_minutes ?? null,
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

  // Rebuilding replaces the schedule, and that is the point of the button — but
  // travel_note and travel_minutes are not the AI's to replace. They are typed
  // in by hand, one item at a time, precisely because the app cannot work them
  // out, so wiping them on every rebuild would make the feature not worth using.
  // They are carried across by normalised name, the same matching this function
  // already uses to recover an item's city.
  const { data: previous } = await supabase
    .from("itinerary_items")
    .select("title, travel_note, travel_minutes")
    .eq("trip_id", tripId);

  const travelByName = new Map(
    (previous ?? [])
      .filter((row) => row.travel_note !== null || row.travel_minutes !== null)
      .map((row) => [
        normaliseName(row.title ?? ""),
        {
          travel_note: row.travel_note as string | null,
          travel_minutes: row.travel_minutes as number | null,
        },
      ]),
  );

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
      travel_note: travelByName.get(normaliseName(item.name))?.travel_note ?? null,
      travel_minutes:
        travelByName.get(normaliseName(item.name))?.travel_minutes ?? null,
    })),
  );
  if (rows.length === 0) return;

  const { error } = await supabase.from("itinerary_items").insert(rows);
  if (error) {
    console.error("saveItinerary failed:", error.message);
  }
}

// How many days the itinerary covers, without loading it.
//
// The tab layout needs this only to derive the trip's phase, and reading the
// highest day_number off the existing (trip_id, day_number) index is far less
// work than fetching every row and its coordinates.
export const getItineraryDayCount = cache(
  async (tripId: string): Promise<number> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("itinerary_items")
      .select("day_number")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return 0;
    return data.day_number ?? 0;
  },
);

// Retained for an explicit archive action; the app no longer writes status as
// a side effect of generating an itinerary. See ARCHITECTURE.md rule #6.
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

// Edit one entry: its hours, the day it sits on, its note, and how you get to
// it. RLS restricts the update to the user's own trips, so a foreign id matches
// no row — and the count is checked for the same reason deleteTrip checks it:
// Postgres calls an update that matched nothing a success.
//
// `position` is deliberately not touched. Moving an entry to another day leaves
// it at whatever position it had, and getItinerary orders by (day_number,
// position), so it lands among that day's items rather than always at the end.
// Reordering within a day is a separate feature and is not pretended at here.
export async function updateItineraryEntry(
  id: string,
  patch: {
    startLabel: string;
    endLabel: string;
    dayNumber: number;
    note: string | null;
    travelNote: string | null;
    travelMinutes: number | null;
  },
) {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("itinerary_items")
    .update(
      {
        // Empty strings are stored as null: "no time set" is an absence, and
        // the timeline already treats an unparseable label that way.
        start_label: patch.startLabel || null,
        end_label: patch.endLabel || null,
        day_number: patch.dayNumber,
        note: patch.note,
        travel_note: patch.travelNote,
        travel_minutes: patch.travelMinutes,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return { error: error.message };
  if (count === 0) return { error: "not-found" };

  return { error: null };
}
