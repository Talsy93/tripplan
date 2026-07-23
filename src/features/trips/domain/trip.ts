import * as z from "zod";

// Trip state machine — see ARCHITECTURE.md iron rule #6.
export const tripStatusSchema = z.enum([
  "planning",
  "executing",
  "completed",
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

// Mirrors public.trips (see src/db/migrations/0002_trips.sql).
export const tripSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().min(1),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: tripStatusSchema,
  created_at: z.string(),
});
export type Trip = z.infer<typeof tripSchema>;
