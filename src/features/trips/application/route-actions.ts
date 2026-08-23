"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { resetTripLocations } from "../infrastructure/route-service";

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
