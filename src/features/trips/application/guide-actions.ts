"use server";

import * as z from "zod";
import {
  aiCategoryKeySchema,
  aiCitySuggestionSchema,
  aiCityGuideSchema,
  aiRecommendationSchema,
} from "../domain/ai-suggestion";
import {
  deleteCityGuide,
  saveCities as saveCitiesToDb,
  saveCityGuide,
  saveRecommendations,
} from "../infrastructure/guide-service";

// Persist a freshly generated guide. Validated so a client can't write junk;
// RLS additionally restricts writes to the user's own trips.
export async function saveGuide(tripId: string, city: string, guide: unknown) {
  const parsed = aiCityGuideSchema.safeParse(guide);
  if (!parsed.success) return;
  await saveCityGuide(tripId, city, parsed.data);
}

export async function saveMore(
  tripId: string,
  city: string,
  category: string,
  items: unknown,
) {
  const parsedCategory = aiCategoryKeySchema.safeParse(category);
  const parsedItems = z.array(aiRecommendationSchema).safeParse(items);
  if (!parsedCategory.success || !parsedItems.success) return;
  await saveRecommendations(tripId, city, parsedCategory.data, parsedItems.data);
}

export async function refreshGuide(tripId: string, city: string) {
  await deleteCityGuide(tripId, city);
}

export async function saveCities(tripId: string, cities: unknown) {
  const parsed = z.array(aiCitySuggestionSchema).safeParse(cities);
  if (!parsed.success) return;
  await saveCitiesToDb(tripId, parsed.data);
}
