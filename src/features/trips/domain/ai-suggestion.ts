import * as z from "zod";

// ---- Level 1: city / area suggestions (concise) ----------------------------

export const aiSuggestRequestSchema = z.object({
  prompt: z.string().trim().min(3, { error: "יש לתאר את הבקשה." }),
  count: z.number().int().min(1).max(10).optional(),
});
export type AiSuggestRequest = z.infer<typeof aiSuggestRequestSchema>;

export const aiCitySuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
});
export type AiCitySuggestion = z.infer<typeof aiCitySuggestionSchema>;

export const aiCitySuggestionsSchema = z.object({
  cities: z.array(aiCitySuggestionSchema),
});
export type AiCitySuggestions = z.infer<typeof aiCitySuggestionsSchema>;

// ---- Level 2: full city guide (categorized recommendations) ----------------

export const aiCityGuideRequestSchema = z.object({
  city: z.string().trim().min(2, { error: "יש לציין עיר." }),
  context: z.string().trim().optional(),
});
export type AiCityGuideRequest = z.infer<typeof aiCityGuideRequestSchema>;

export const aiRecommendationSchema = z.object({
  name: z.string(),
  description: z.string(),
  tip: z.string(),
});
export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;

export const aiCityGuideSchema = z.object({
  hotels: z.array(aiRecommendationSchema),
  restaurants: z.array(aiRecommendationSchema),
  attractions: z.array(aiRecommendationSchema),
  experiences: z.array(aiRecommendationSchema),
});
export type AiCityGuide = z.infer<typeof aiCityGuideSchema>;

// The four guide categories; also used to request more of a single one.
export const aiCategoryKeySchema = z.enum([
  "hotels",
  "restaurants",
  "attractions",
  "experiences",
]);
export type AiCategoryKey = z.infer<typeof aiCategoryKeySchema>;

// Request for more recommendations in one category, excluding what's shown.
export const aiMoreRecommendationsRequestSchema = z.object({
  city: z.string().trim().min(2, { error: "יש לציין עיר." }),
  category: aiCategoryKeySchema,
  context: z.string().trim().optional(),
  exclude: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(8).optional(),
});
export type AiMoreRecommendationsRequest = z.infer<
  typeof aiMoreRecommendationsRequestSchema
>;

export const aiRecommendationsSchema = z.object({
  recommendations: z.array(aiRecommendationSchema),
});
export type AiRecommendations = z.infer<typeof aiRecommendationsSchema>;
