import * as z from "zod";

// Mirrors public.itinerary_items (see src/db/migrations/0002_trips.sql).
export const itineraryItemSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  destination_id: z.uuid().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  position: z.number().int(),
  created_at: z.string(),
});
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
