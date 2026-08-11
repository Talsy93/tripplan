import * as z from "zod";

// Mirrors public.itinerary_items across every migration that touched it:
// 0002 created the table, 0004 added the day/label columns the AI itinerary
// actually writes, and 0006 added the city.
//
// start_time/end_time and destination_id are the original 0002 columns and are
// left unwritten — a trip may have no calendar dates, so the itinerary uses
// day_number plus free-text time labels instead.
export const itineraryItemSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  destination_id: z.uuid().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  position: z.number().int(),
  created_at: z.string(),
  day_number: z.number().int().nullable(),
  title: z.string().nullable(),
  start_label: z.string().nullable(),
  end_label: z.string().nullable(),
  note: z.string().nullable(),
  city: z.string().nullable(),
});
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
