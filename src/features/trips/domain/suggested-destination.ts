import * as z from "zod";

export const destinationSourceSchema = z.enum(["ai", "manual"]);
export type DestinationSource = z.infer<typeof destinationSourceSchema>;

// Mirrors public.suggested_destinations (see migrations 0002 + 0003).
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
  // Added in 0003 for saved AI city guides.
  city: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  tip: z.string().nullable(),
});
export type SuggestedDestination = z.infer<typeof suggestedDestinationSchema>;
