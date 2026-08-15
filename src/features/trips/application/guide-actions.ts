"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  aiCategoryKeySchema,
  aiCitySuggestionSchema,
  aiCityGuideSchema,
  aiRecommendationSchema,
} from "../domain/ai-suggestion";
import { selectableCategorySchema } from "../domain/place";
import {
  appendCities,
  deleteCityGuide,
  saveCities as saveCitiesToDb,
  saveCityGuide,
  saveRecommendations,
  setDestinationSelected,
} from "../infrastructure/guide-service";
import type { AiCitySuggestion } from "../domain/ai-suggestion";

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
  await saveRecommendations(
    tripId,
    city,
    parsedCategory.data,
    parsedItems.data,
  );
}

export async function refreshGuide(tripId: string, city: string) {
  await deleteCityGuide(tripId, city);
}

export async function saveCities(tripId: string, cities: unknown) {
  const parsed = z.array(aiCitySuggestionSchema).safeParse(cities);
  if (!parsed.success) return;
  await saveCitiesToDb(tripId, parsed.data);
}

// Adds cities to the trip's suggestions, keeping the ones already there.
//
// Returns the cities that were actually new, so "more destinations" can report
// an empty round rather than looking like it did nothing.
export async function addMoreCities(
  tripId: string,
  cities: unknown,
): Promise<AiCitySuggestion[]> {
  const parsedId = z.uuid().safeParse(tripId);
  const parsed = z.array(aiCitySuggestionSchema).safeParse(cities);
  if (!parsedId.success || !parsed.success) return [];

  const added = await appendCities(parsedId.data, parsed.data);

  // The suggestions are read by the server render of the explore tab, and the
  // route map reads the same rows — so the whole layout has to be revalidated
  // or the additions vanish on the next navigation.
  if (added.length > 0) {
    revalidatePath(`/trips/${parsedId.data}`, "layout");
  }
  return added;
}

export async function setSelected(
  tripId: string,
  city: string,
  category: string,
  name: string,
  selected: boolean,
) {
  // Accepts both category vocabularies — a searched place carries one of the
  // attractions-search categories, not one of the guide's four.
  const parsedCategory = selectableCategorySchema.safeParse(category);
  if (!parsedCategory.success) return;
  await setDestinationSelected(
    tripId,
    city,
    parsedCategory.data,
    name,
    Boolean(selected),
  );

  // Keeps the trip page's other panels honest: removing something here has to
  // reach the attractions tab's "already in your trip" marks and the route
  // map, which are part of the same server render.
  if (z.uuid().safeParse(tripId).success) {
    revalidatePath(`/trips/${tripId}`, "layout");
  }
}
