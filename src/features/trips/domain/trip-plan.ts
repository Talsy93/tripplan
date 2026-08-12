import * as z from "zod";
import { aiCategoryKeySchema } from "./ai-suggestion";

// A trip plan extracted from the planning conversation.
//
// The chat itself is prose. This is the structured reading of it — what cities
// were agreed on and what to do in each — produced on demand rather than
// continuously, so the conversation never rewrites the trip on its own.

export const aiPlanItemSchema = z.object({
  name: z.string(),
  // Reuses the city-guide vocabulary: these become guide items, and a second
  // set of categories would mean two things called the same thing.
  category: aiCategoryKeySchema,
  description: z.string(),
});
export type AiPlanItem = z.infer<typeof aiPlanItemSchema>;

export const aiPlanCitySchema = z.object({
  name: z.string(),
  // A sentence about the city. Fills the city's overview row, which is also
  // where the route map caches its coordinates — a city added without one
  // would be re-geocoded on every page load.
  intro: z.string(),
  items: z.array(aiPlanItemSchema),
});
export type AiPlanCity = z.infer<typeof aiPlanCitySchema>;

export const aiTripPlanSchema = z.object({
  // What the model understood the traveller to want, in a sentence or two.
  // Shown above the preview so a wrong reading is obvious before anything is
  // saved.
  summary: z.string(),
  cities: z.array(aiPlanCitySchema),
});
export type AiTripPlan = z.infer<typeof aiTripPlanSchema>;

export const planFromChatRequestSchema = z.object({
  tripId: z.uuid(),
});

// Everything the plan would add, counted for the confirmation prompt.
export function planTotals(plan: AiTripPlan) {
  return {
    cities: plan.cities.length,
    items: plan.cities.reduce((total, city) => total + city.items.length, 0),
  };
}
