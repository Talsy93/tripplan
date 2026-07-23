import * as z from "zod";

export const destinationSourceSchema = z.enum(["ai", "manual"]);
export type DestinationSource = z.infer<typeof destinationSourceSchema>;

// Mirrors public.suggested_destinations (see src/db/migrations/0002_trips.sql).
export const suggestedDestinationSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  name: z.string().min(1),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  estimated_duration_minutes: z.number().int().nullable(),
  source: destinationSourceSchema,
  selected: z.boolean(),
  created_at: z.string(),
});
export type SuggestedDestination = z.infer<typeof suggestedDestinationSchema>;
