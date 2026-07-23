"use server";

import * as z from "zod";
import { deleteItineraryEntry as deleteEntry } from "../infrastructure/itinerary-service";

export async function deleteItineraryEntry(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  await deleteEntry(id);
}
