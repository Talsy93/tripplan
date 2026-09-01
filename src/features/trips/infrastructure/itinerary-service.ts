import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normaliseName } from "@/lib/text";
import { isSchemaOutOfDate } from "@/lib/supabase/schema-errors";
import type {
  AiItinerary,
  ItineraryDay,
  SelectedItem,
} from "../domain/ai-suggestion";

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

const ITINERARY_COLUMNS =
  "id, day_number, position, title, start_label, end_label, note, city";
const TRAVEL_COLUMNS = ", travel_note, travel_minutes";

export async function getItinerary(tripId: string): Promise<ItineraryDay[]> {
  const supabase = await createClient();

  const read = (columns: string) =>
    supabase
      .from("itinerary_items")
      .select(columns)
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })
      .order("position", { ascending: true });

  const [first, coordinates] = await Promise.all([
    read(ITINERARY_COLUMNS + TRAVEL_COLUMNS),
    getEntryCoordinates(tripId),
  ]);

  let { data, error } = first;

  // Code can reach production before its migration is run — that is exactly what
  // happened with 0013 — and two optional display columns must not be able to
  // blank an itinerary that is sitting in the database perfectly intact. When
  // the travel columns are missing, the same query runs without them and the
  // fields simply read as null until the migration lands.
  if (error && isSchemaOutOfDate(error.message)) {
    console.error(
      "getItinerary: travel columns missing, migration 0013 not applied yet",
    );
    ({ data, error } = await read(ITINERARY_COLUMNS));
  }

  if (error) {
    console.error("getItinerary failed:", error.message);
    return [];
  }
  if (!data || data.length === 0) {
    return [];
  }

  const byDay = new Map<number, ItineraryDay>();
  // The two reads below return different column sets, so the row type is widened
  // deliberately and each field is narrowed as it is read.
  for (const row of data as unknown as Record<string, unknown>[]) {
    const dayNumber = (row.day_number as number | null) ?? 1;
    let day = byDay.get(dayNumber);
    if (!day) {
      day = { day: dayNumber, items: [] };
      byDay.set(dayNumber, day);
    }
    const city = (row.city as string | null) ?? null;
    const title = (row.title as string | null) ?? "";
    const point = coordinates.get(coordinateKey(city, title));
    day.items.push({
      id: row.id as string,
      title,
      startLabel: (row.start_label as string | null) ?? "",
      endLabel: (row.end_label as string | null) ?? "",
      note: (row.note as string | null) ?? "",
      city,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      travelNote: (row.travel_note as string | null) ?? null,
      travelMinutes: (row.travel_minutes as number | null) ?? null,
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
  //
  // `select("*")` and not a column list, deliberately. This snapshot is also the
  // rollback below, so it has to succeed whichever columns the database happens
  // to have — naming travel_note here made the whole function fail on a database
  // where migration 0013 had not been run yet, and because the delete had
  // already happened by then, a failed rebuild destroyed the schedule.
  const { data: previous, error: snapshotError } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", tripId);

  if (snapshotError) {
    return { error: snapshotError.message };
  }

  const snapshot = previous ?? [];

  const travelByName = new Map(
    snapshot
      .filter(
        (row) =>
          row.travel_note != null || row.travel_minutes != null,
      )
      .map((row) => [
        normaliseName(row.title ?? ""),
        {
          travel_note: (row.travel_note ?? null) as string | null,
          travel_minutes: (row.travel_minutes ?? null) as number | null,
        },
      ]),
  );

  const { error: deleteError } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("trip_id", tripId);

  if (deleteError) {
    return { error: deleteError.message };
  }

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
  if (rows.length === 0) return { error: null };

  const { error } = await supabase.from("itinerary_items").insert(rows);

  if (error) {
    // The old rows are already gone, so a failed insert leaves the trip with no
    // schedule at all. Putting the snapshot back is best-effort — there is no
    // multi-statement transaction through this client — but losing the user's
    // itinerary because a write failed is the worse outcome by a wide margin.
    //
    // This used to be a console.error and nothing else, which is how a missing
    // migration turned into "I pressed build and nothing happened".
    if (snapshot.length > 0) {
      await supabase.from("itinerary_items").insert(snapshot);
    }
    return { error: error.message };
  }

  return { error: null };
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
