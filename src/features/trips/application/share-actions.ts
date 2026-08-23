"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { shareTrip, unshareTrip } from "../infrastructure/share-service";

export async function enableSharing(tripId: string): Promise<string | null> {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return null;

  const token = await shareTrip(parsed.data);
  if (token) revalidatePath(`/trips/${parsed.data}`, "layout");
  return token;
}

export async function disableSharing(tripId: string): Promise<boolean> {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return false;

  const ok = await unshareTrip(parsed.data);
  if (ok) revalidatePath(`/trips/${parsed.data}`, "layout");
  return ok;
}
