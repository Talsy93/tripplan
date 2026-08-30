"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  locateCityByName,
  resetTripLocations,
} from "../infrastructure/route-service";

// Clears the cached coordinates for a trip's cities so the next render
// resolves them again. RLS bounds the update to the caller's own trips, so an
// id that is not theirs matches no row.
export async function resetLocations(tripId: string) {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return false;

  const ok = await resetTripLocations(parsed.data);
  // "layout", not the page: the coordinates feed the map, the weather panel
  // and the attractions search, which are separate routes under the same
  // layout. Revalidating one of them would leave the others on stale pins —
  // the mistake phase B found in seven other calls.
  if (ok) revalidatePath(`/trips/${parsed.data}`, "layout");
  return ok;
}

// Places a city the geocoder could not resolve, from a name the user gives.
//
// Returns a plain result rather than throwing, because the honest outcomes are
// three and the UI says something different for each: it worked, that name did
// not resolve either, or the input was not usable.
export async function locateCity(
  tripId: string,
  city: string,
  alternateName: string,
  tripName?: string,
): Promise<{ ok: boolean; message?: string }> {
  const parsedTrip = z.uuid().safeParse(tripId);
  if (!parsedTrip.success) return { ok: false, message: "טיול לא תקין." };

  const parsedName = z
    .string()
    .trim()
    .min(2, "כתבו לפחות שני תווים")
    .max(120)
    .safeParse(alternateName);
  if (!parsedName.success) {
    return { ok: false, message: "כתבו את שם היעד באנגלית או בשפת המקום." };
  }

  const point = await locateCityByName(
    parsedTrip.data,
    city,
    parsedName.data,
    tripName,
  );

  if (!point) {
    return {
      ok: false,
      message: `לא מצאנו מקום בשם ״${parsedName.data}״. נסו את השם באנגלית, או את השם בשפת המקום.`,
    };
  }

  // Same reasoning as resetLocations: the coordinates feed the map, the weather
  // panel and the attractions search, which are separate routes under one
  // layout.
  revalidatePath(`/trips/${parsedTrip.data}`, "layout");
  return { ok: true };
}
