"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { aiTripPlanSchema } from "../domain/trip-plan";
import { clearChat } from "../infrastructure/chat-service";
import { savePlanFromChat } from "../infrastructure/trip-plan-service";

// Writes a plan the user has looked at and confirmed.
//
// The plan round-trips through the client, so it's re-validated here. RLS
// additionally restricts writes to the user's own trips.
export async function applyPlan(tripId: string, plan: unknown) {
  const parsedId = z.uuid().safeParse(tripId);
  const parsedPlan = aiTripPlanSchema.safeParse(plan);
  if (!parsedId.success || !parsedPlan.success) return false;

  const ok = await savePlanFromChat(parsedId.data, parsedPlan.data);
  if (ok) revalidatePath(`/trips/${parsedId.data}`, "layout");
  return ok;
}

export async function resetChat(tripId: string) {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return false;

  const ok = await clearChat(parsed.data);
  if (ok) revalidatePath(`/trips/${parsed.data}`, "layout");
  return ok;
}
