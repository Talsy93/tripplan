import { createClient } from "@/lib/supabase/server";
import { cityDaysSchema, type CityDays } from "../domain/city-days";

// The per-city day override. Only rows the user actually set exist here — the
// value derived from lodging is never written, so changing a booking keeps
// driving the answer without a backfill (see domain/city-days.ts).

export async function listCityDays(tripId: string): Promise<CityDays[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trip_city_days")
    .select("*")
    .eq("trip_id", tripId);

  if (error || !data) return [];

  // Same tolerance the other services use: a row that fails the schema is
  // dropped rather than taking the whole screen down with it.
  return data.flatMap((row) => {
    const parsed = cityDaysSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function setCityDays(
  tripId: string,
  city: string,
  days: number | null,
) {
  const supabase = await createClient();

  // Null means "stop overriding", which is a delete rather than a stored zero —
  // a zero would read as an explicit "no days here" and keep winning over the
  // booking.
  if (days === null) {
    const { error } = await supabase
      .from("trip_city_days")
      .delete()
      .eq("trip_id", tripId)
      .eq("city", city);

    return { error: error?.message ?? null };
  }

  // Upsert on the natural key, so editing the same city twice does not need a
  // read first and cannot race itself into two rows.
  const { error } = await supabase.from("trip_city_days").upsert(
    { trip_id: tripId, city, days, updated_at: new Date().toISOString() },
    { onConflict: "trip_id,city" },
  );

  return { error: error?.message ?? null };
}
