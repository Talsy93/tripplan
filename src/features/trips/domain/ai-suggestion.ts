import * as z from "zod";

// Request the client sends to /api/ai/suggest.
export const aiSuggestRequestSchema = z.object({
  prompt: z.string().trim().min(3, { error: "יש לתאר את הבקשה." }),
  count: z.number().int().min(1).max(10).optional(),
});
export type AiSuggestRequest = z.infer<typeof aiSuggestRequestSchema>;

// A single AI-generated destination suggestion. Maps to the subset of
// suggested_destinations that the model is asked to produce.
export const aiDestinationSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  estimated_duration_minutes: z.number().int(),
});
export type AiDestinationSuggestion = z.infer<
  typeof aiDestinationSuggestionSchema
>;

// The structured shape the model must return (and that we validate).
export const aiSuggestionsSchema = z.object({
  destinations: z.array(aiDestinationSuggestionSchema),
});
export type AiSuggestions = z.infer<typeof aiSuggestionsSchema>;
