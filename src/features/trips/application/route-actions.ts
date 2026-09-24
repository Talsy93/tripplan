"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  locateCityByName,
  resetTripLocations,
} from "../infrastructure/route-service";
import { locateTripPlace } from "../infrastructure/place-location-service";

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

// Places one destination the map could not pin — a saved place or a schedule
// entry. Without `address`, searches for the place itself inside its city;
// with it, places the address the traveller typed. See place-location-service.
//
// The three failures read differently on purpose: "we could not find it" asks
// for an address, "the database is behind" is not something an address fixes.
export async function locatePlace(
  tripId: string,
  input: { name: string; city: string | null; itemId?: string; address?: string },
  tripName?: string,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = z
    .object({
      tripId: z.uuid(),
      name: z.string().trim().min(1).max(200),
      city: z.string().trim().max(120).nullable(),
      itemId: z.uuid().optional(),
      address: z
        .string()
        .trim()
        .min(3, "כתבו כתובת או שם מלא יותר")
        .max(200)
        .optional(),
    })
    .safeParse({ tripId, ...input });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "הבקשה לא תקינה." };
  }

  const { tripId: id, ...target } = parsed.data;
  const result = await locateTripPlace(id, target, tripName);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not-found"
          ? target.address
            ? "לא מצאנו את הכתובת הזאת בעיר. נסו רחוב ומספר, או את השם באנגלית."
            : "לא מצאנו את המקום בחיפוש. כתבו כתובת ונציג אותו במפה."
          : result.reason === "migration"
            ? "כדי לשמור מיקום לפריט הזה צריך להריץ את מיגרציה 0027 ב-Supabase."
            : "משהו השתבש בשמירה. לא נמחק כלום — נסו שוב.",
    };
  }

  revalidatePath(`/trips/${id}`, "layout");
  return { ok: true };
}
