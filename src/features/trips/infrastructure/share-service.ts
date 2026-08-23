import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateShareToken, isShareToken, redactBooking } from "../domain/share";
import { itineraryStops } from "../domain/route";
import type { SharedTrip } from "../domain/share";
import type { Booking } from "../domain/booking";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { RouteStop } from "../domain/route";

// ---- Owner side: turning sharing on and off -------------------------------
// These go through the user's own session, so RLS bounds them to their trips.

// Issues a link, or returns the existing one. Re-sharing an already-shared
// trip must not mint a new token: the old link is presumably already sent to
// someone, and silently breaking it is not what "share" means.
export async function shareTrip(tripId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("trips")
    .select("share_token")
    .eq("id", tripId)
    .maybeSingle();

  if (existing?.share_token) return existing.share_token;

  const token = generateShareToken();
  const { error, count } = await supabase
    .from("trips")
    .update(
      { share_token: token, shared_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", tripId);

  // Checked for the same reason deleteTrip checks it: Postgres calls an update
  // that matched nothing a success, so without this a stranger's trip id would
  // come back with a token that was never written.
  if (error || count === 0) {
    if (error) console.error("shareTrip failed:", error.message);
    return null;
  }
  return token;
}

// Revokes the link. Setting the token to null is permanent for that link —
// sharing again mints a different one, and the old URL resolves to nothing.
export async function unshareTrip(tripId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trips")
    .update({ share_token: null, shared_at: null }, { count: "exact" })
    .eq("id", tripId);

  if (error) {
    console.error("unshareTrip failed:", error.message);
    return false;
  }
  return count !== 0;
}

export async function getShareToken(tripId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("share_token")
    .eq("id", tripId)
    .maybeSingle();
  return data?.share_token ?? null;
}

// ---- Public side: reading a shared trip -----------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

// Loads a trip for the public page, by token, already redacted.
//
// This is the app's second and last use of the service-role client, and the
// reason it needs one: the reader has no session at all, so RLS — which is
// written entirely in terms of auth.uid() — would return nothing for them.
//
// The alternative considered and rejected was an RLS policy letting anon read
// any row where share_token is not null. That reads well until you notice it
// also permits `select * from trips where share_token is not null`, which
// enumerates every shared trip in the database and makes the token pointless.
// A server-side lookup by exact token has no such surface: there is no query
// to run without already knowing the answer.
//
// Three properties keep this safe, and all three are load-bearing:
//
//   1. The token is validated as 32 hex characters *before* it reaches the
//      database, so the parameter cannot be a pattern or an injection attempt.
//   2. Only `.eq("share_token", token)` — never a range, a filter on another
//      column, or a listing. One token, at most one trip.
//   3. Everything returned goes through the SharedTrip type, so a column added
//      later is invisible here until someone adds it deliberately.
export async function getSharedTrip(token: string): Promise<SharedTrip | null> {
  if (!isShareToken(token)) return null;

  // createAdminClient throws when the service-role key is absent, and this is
  // the one caller that runs on a page a stranger can reach. An unhandled
  // throw there renders Next's error page — a 500 and, in development, a
  // stack trace — for what the visitor should simply experience as a link
  // that does not resolve. Logged loudly so the misconfiguration is still
  // obvious to whoever deployed it.
  let supabase: AdminClient;
  try {
    supabase = createAdminClient();
  } catch (caught) {
    console.error("getSharedTrip: admin client unavailable:", caught);
    return null;
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date")
    .eq("share_token", token)
    .maybeSingle();

  if (error || !trip) {
    if (error) console.error("getSharedTrip failed:", error.message);
    return null;
  }

  const [itinerary, bookings, stops] = await Promise.all([
    readItinerary(supabase, trip.id),
    readBookings(supabase, trip.id),
    readStops(supabase, trip.id),
  ]);

  return {
    name: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    itinerary,
    bookings: bookings.map(redactBooking),
    stops: withItineraryStops(stops, itinerary),
  };
}


async function readItinerary(
  supabase: AdminClient,
  tripId: string,
): Promise<ItineraryDay[]> {
  const { data } = await supabase
    .from("itinerary_items")
    .select("id, day_number, title, start_label, end_label, note, city")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("position", { ascending: true });

  const byDay = new Map<number, ItineraryDay>();
  for (const row of data ?? []) {
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
      // The public page has no map of its own and no "how do I get there"
      // links, so the fields that feed those are not read at all.
      latitude: null,
      longitude: null,
      travelNote: null,
      travelMinutes: null,
    });
  }
  return [...byDay.values()];
}

async function readBookings(
  supabase: AdminClient,
  tripId: string,
): Promise<Booking[]> {
  const { data } = await supabase
    .from("trip_bookings")
    .select("*")
    .eq("trip_id", tripId)
    .order("starts_at", { ascending: true });
  return (data ?? []) as Booking[];
}

// Cities with coordinates, for the route summary on the shared page. Read from
// the same overview rows the map caches into.
async function readStops(
  supabase: AdminClient,
  tripId: string,
): Promise<Omit<RouteStop, "days" | "nights">[]> {
  const { data } = await supabase
    .from("suggested_destinations")
    .select("city, latitude, longitude, country")
    .eq("trip_id", tripId)
    .eq("category", "overview")
    .not("city", "is", null)
    .order("created_at", { ascending: true });

  const stops: Omit<RouteStop, "days" | "nights">[] = [];
  for (const row of data ?? []) {
    if (!row.city) continue;
    const stored = (row.country as string | null) ?? null;
    const [code, ...nameParts] = stored ? stored.split("|") : [];
    stops.push({
      city: row.city,
      latitude: row.latitude ?? 0,
      longitude: row.longitude ?? 0,
      country: nameParts.length > 0 ? nameParts.join("|") : null,
      countryCode: code || null,
      itemCount: 0,
    });
  }
  return stops;
}

// Attaches each city's days and nights from the itinerary, and drops cities
// the itinerary never visits — a shared plan shows where the trip goes, not
// every place that was considered and set aside.
function withItineraryStops(
  stops: Omit<RouteStop, "days" | "nights">[],
  itinerary: ItineraryDay[],
): RouteStop[] {
  const scheduled = itineraryStops(itinerary);
  const byCity = new Map(stops.map((stop) => [stop.city, stop]));

  return scheduled.flatMap((entry) => {
    const stop = byCity.get(entry.city);
    if (!stop) return [];
    return [{ ...stop, days: entry.days, nights: entry.nights }];
  });
}
